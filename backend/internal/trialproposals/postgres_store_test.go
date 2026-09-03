package trialproposals

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/applications"
	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/hiteshchundi/branch-out/backend/internal/openings"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
	"github.com/hiteshchundi/branch-out/backend/internal/safety"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresTrialProposalLifecycle(t *testing.T) {
	databaseURL := os.Getenv("BRANCH_OUT_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BRANCH_OUT_TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)

	queries := database.New(pool)
	authStore := auth.NewPostgresStore(queries)
	profileService := profile.NewService(profile.NewPostgresStore(queries))
	openingManager := openings.NewManager(openings.NewPostgresRepository(queries), profileService)
	applicationManager := applications.NewManager(applications.NewPostgresStore(queries), profileService)
	trialStore := NewPostgresStore(queries)
	manager := NewManager(trialStore)
	safetyManager := safety.NewManager(safety.NewPostgresStore(queries))

	identifier := time.Now().UnixNano()
	owner := createTrialTestUser(t, ctx, authStore, profileService, identifier, "Trial Owner")
	applicant := createTrialTestUser(t, ctx, authStore, profileService, identifier+1, "Accepted Applicant")
	otherApplicant := createTrialTestUser(t, ctx, authStore, profileService, identifier+2, "Other Applicant")
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM safety_reports WHERE reporter_user_id = ANY($1)", []int64{owner.ID, applicant.ID, otherApplicant.ID})
		_, _ = pool.Exec(context.Background(), "DELETE FROM trial_feedback WHERE author_user_id = ANY($1)", []int64{owner.ID, applicant.ID, otherApplicant.ID})
		_, _ = pool.Exec(context.Background(), "DELETE FROM trial_outcomes WHERE submitted_by_user_id = ANY($1)", []int64{owner.ID, applicant.ID, otherApplicant.ID})
		_, _ = pool.Exec(context.Background(), "DELETE FROM trial_check_ins WHERE author_user_id = ANY($1)", []int64{owner.ID, applicant.ID, otherApplicant.ID})
		_, _ = pool.Exec(context.Background(), "DELETE FROM trial_proposals WHERE applicant_user_id = ANY($1)", []int64{applicant.ID, otherApplicant.ID})
		_, _ = pool.Exec(context.Background(), "DELETE FROM applications WHERE applicant_user_id = ANY($1)", []int64{applicant.ID, otherApplicant.ID})
		_, _ = pool.Exec(context.Background(), "DELETE FROM project_openings WHERE owner_user_id = $1", owner.ID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = ANY($1)", []int64{owner.ID, applicant.ID, otherApplicant.ID})
	})

	opening, err := openingManager.CreateDraft(ctx, owner.ID, openings.DraftInput{
		ProjectName: "Private trial proposal", Problem: "Test accepted-applicant trial proposal persistence and isolation.",
		Role: "Backend engineer", Skills: []string{"Go", "PostgreSQL"}, Commitment: "6–8 hrs/week",
		Duration: "2–4 weeks", Timezone: "UTC to UTC+4", Compensation: "Fixed bounty",
		FirstMilestone:    "Build and test one bounded private trial proposal workflow.",
		OwnerContribution: "The opening, review criteria, and test environment are prepared.", Confidentiality: "Public",
	})
	if err != nil {
		t.Fatalf("CreateDraft() error = %v", err)
	}
	opening, err = openingManager.PublishDraft(ctx, owner.ID, opening.ID)
	if err != nil {
		t.Fatalf("PublishDraft() error = %v", err)
	}

	if _, err := manager.SaveOwnDraft(ctx, applicant.ID, opening.ID, validTrialInput()); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("pre-acceptance SaveOwnDraft() error = %v, want ErrUnavailable", err)
	}
	application, err := applicationManager.SaveDraft(ctx, applicant.ID, opening.ID, validApplicationInput())
	if err != nil {
		t.Fatalf("application SaveDraft() error = %v", err)
	}
	application, err = applicationManager.Submit(ctx, applicant.ID, opening.ID)
	if err != nil {
		t.Fatalf("application Submit() error = %v", err)
	}
	if _, err := applicationManager.Decide(ctx, owner.ID, opening.ID, application.ID, "accepted"); err != nil {
		t.Fatalf("application Decide() error = %v", err)
	}

	proposal, err := manager.SaveOwnDraft(ctx, applicant.ID, opening.ID, validTrialInput())
	if err != nil || proposal.Status != "draft" || proposal.ApplicationID != application.ID {
		t.Fatalf("SaveOwnDraft() = %#v, %v", proposal, err)
	}
	loaded, err := manager.GetOwn(ctx, applicant.ID, opening.ID)
	if err != nil || loaded.ID != proposal.ID {
		t.Fatalf("GetOwn() = %#v, %v", loaded, err)
	}
	updatedInput := validTrialInput()
	updatedInput.WeeklyHours = 10
	updated, err := manager.SaveOwnDraft(ctx, applicant.ID, opening.ID, updatedInput)
	if err != nil || updated.ID != proposal.ID || updated.Input.WeeklyHours != 10 {
		t.Fatalf("updated SaveOwnDraft() = %#v, %v", updated, err)
	}
	if _, err := manager.GetOwn(ctx, otherApplicant.ID, opening.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("other applicant GetOwn() error = %v, want ErrNotFound", err)
	}
	if _, err := manager.SaveOwnDraft(ctx, otherApplicant.ID, opening.ID, validTrialInput()); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("other applicant SaveOwnDraft() error = %v, want ErrUnavailable", err)
	}

	sent, err := manager.SendOwn(ctx, applicant.ID, opening.ID)
	if err != nil || sent.Status != "sent" || sent.SentAt == nil || sent.DecidedAt != nil {
		t.Fatalf("SendOwn() = %#v, %v", sent, err)
	}
	if _, err := manager.SaveOwnDraft(ctx, applicant.ID, opening.ID, validTrialInput()); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("sent SaveOwnDraft() error = %v, want ErrUnavailable", err)
	}
	if _, err := manager.SendOwn(ctx, applicant.ID, opening.ID); !errors.Is(err, ErrSendUnavailable) {
		t.Fatalf("repeated SendOwn() error = %v, want ErrSendUnavailable", err)
	}
	review, err := manager.ListForOwner(ctx, owner.ID, opening.ID)
	if err != nil || len(review) != 1 || review[0].ID != proposal.ID || review[0].Applicant.DisplayName != "Accepted Applicant" {
		t.Fatalf("ListForOwner() = %#v, %v", review, err)
	}
	if _, err := manager.ListForOwner(ctx, otherApplicant.ID, opening.ID); !errors.Is(err, ErrReviewNotFound) {
		t.Fatalf("non-owner ListForOwner() error = %v, want ErrReviewNotFound", err)
	}
	if _, err := manager.Decide(ctx, otherApplicant.ID, opening.ID, proposal.ID, "accepted"); !errors.Is(err, ErrReviewNotFound) {
		t.Fatalf("non-owner Decide() error = %v, want ErrReviewNotFound", err)
	}
	accepted, err := manager.Decide(ctx, owner.ID, opening.ID, proposal.ID, "accepted")
	if err != nil || accepted.Status != "accepted" || accepted.DecidedAt == nil {
		t.Fatalf("Decide() = %#v, %v", accepted, err)
	}
	if _, err := manager.Decide(ctx, owner.ID, opening.ID, proposal.ID, "declined"); !errors.Is(err, ErrDecisionUnavailable) {
		t.Fatalf("repeated Decide() error = %v, want ErrDecisionUnavailable", err)
	}
	loaded, err = manager.GetOwn(ctx, applicant.ID, opening.ID)
	if err != nil || loaded.Status != "accepted" || loaded.DecidedAt == nil {
		t.Fatalf("accepted GetOwn() = %#v, %v", loaded, err)
	}
	if _, err := manager.ListCheckIns(ctx, otherApplicant.ID, proposal.ID); !errors.Is(err, ErrWorkspaceNotFound) {
		t.Fatalf("non-participant ListCheckIns() error = %v, want ErrWorkspaceNotFound", err)
	}
	if _, err := manager.AddCheckIn(ctx, otherApplicant.ID, proposal.ID, CheckInInput{
		Kind: "progress", Update: "Attempted to add an update outside the accepted collaboration.",
	}); !errors.Is(err, ErrWorkspaceNotFound) {
		t.Fatalf("non-participant AddCheckIn() error = %v, want ErrWorkspaceNotFound", err)
	}
	applicantCheckIn, err := manager.AddCheckIn(ctx, applicant.ID, proposal.ID, CheckInInput{
		Kind: "progress", Update: "Completed the API boundary and added focused integration tests.",
		EvidenceURL: "https://github.com/example/comparison/pull/12",
	})
	if err != nil || applicantCheckIn.AuthorRole != "applicant" || applicantCheckIn.Author.DisplayName != "Accepted Applicant" {
		t.Fatalf("applicant AddCheckIn() = %#v, %v", applicantCheckIn, err)
	}
	ownerCheckIn, err := manager.AddCheckIn(ctx, owner.ID, proposal.ID, CheckInInput{
		Kind: "milestone", Update: "Reviewed the bounded deliverable and confirmed the milestone is ready.",
	})
	if err != nil || ownerCheckIn.AuthorRole != "owner" || ownerCheckIn.Author.DisplayName != "Trial Owner" {
		t.Fatalf("owner AddCheckIn() = %#v, %v", ownerCheckIn, err)
	}
	checkIns, err := manager.ListCheckIns(ctx, applicant.ID, proposal.ID)
	if err != nil || len(checkIns) != 2 || checkIns[0].Kind != "progress" || checkIns[1].Kind != "milestone" {
		t.Fatalf("ListCheckIns() = %#v, %v", checkIns, err)
	}
	if _, err := manager.GetOutcome(ctx, otherApplicant.ID, proposal.ID); !errors.Is(err, ErrOutcomeNotFound) {
		t.Fatalf("non-participant GetOutcome() error = %v, want ErrOutcomeNotFound", err)
	}
	outcome, err := manager.CreateOutcome(ctx, applicant.ID, proposal.ID, validOutcomeInput())
	if err != nil || outcome.ReviewStatus != "pending" || !outcome.SubmittedByCurrentUser || outcome.CanDecide {
		t.Fatalf("CreateOutcome() = %#v, %v", outcome, err)
	}
	if _, err := manager.CreateOutcome(ctx, owner.ID, proposal.ID, validOutcomeInput()); !errors.Is(err, ErrOutcomeUnavailable) {
		t.Fatalf("duplicate CreateOutcome() error = %v, want ErrOutcomeUnavailable", err)
	}
	ownerView, err := manager.GetOutcome(ctx, owner.ID, proposal.ID)
	if err != nil || !ownerView.CanDecide || ownerView.SubmittedByCurrentUser || ownerView.SubmittedBy.DisplayName != "Accepted Applicant" {
		t.Fatalf("owner GetOutcome() = %#v, %v", ownerView, err)
	}
	if _, err := manager.DecideOutcome(ctx, applicant.ID, proposal.ID, "confirmed"); !errors.Is(err, ErrOutcomeDecisionUnavailable) {
		t.Fatalf("submitter DecideOutcome() error = %v, want ErrOutcomeDecisionUnavailable", err)
	}
	confirmed, err := manager.DecideOutcome(ctx, owner.ID, proposal.ID, "confirmed")
	if err != nil || confirmed.ReviewStatus != "confirmed" || confirmed.DecidedAt == nil || confirmed.CanDecide {
		t.Fatalf("DecideOutcome() = %#v, %v", confirmed, err)
	}
	if _, err := manager.DecideOutcome(ctx, owner.ID, proposal.ID, "disputed"); !errors.Is(err, ErrOutcomeDecisionUnavailable) {
		t.Fatalf("repeated DecideOutcome() error = %v, want ErrOutcomeDecisionUnavailable", err)
	}
	if _, err := manager.CreateFeedback(ctx, otherApplicant.ID, proposal.ID, validPostgresFeedbackInput()); !errors.Is(err, ErrFeedbackUnavailable) {
		t.Fatalf("non-participant CreateFeedback() error = %v, want ErrFeedbackUnavailable", err)
	}
	applicantFeedback, err := manager.CreateFeedback(ctx, applicant.ID, proposal.ID, validPostgresFeedbackInput())
	if err != nil || !applicantFeedback.AuthoredByCurrentUser || applicantFeedback.CanAcknowledge || applicantFeedback.AuthorRole != "applicant" {
		t.Fatalf("applicant CreateFeedback() = %#v, %v", applicantFeedback, err)
	}
	if _, err := manager.CreateFeedback(ctx, applicant.ID, proposal.ID, validPostgresFeedbackInput()); !errors.Is(err, ErrFeedbackUnavailable) {
		t.Fatalf("duplicate CreateFeedback() error = %v, want ErrFeedbackUnavailable", err)
	}
	ownerFeedbackView, err := manager.ListFeedback(ctx, owner.ID, proposal.ID)
	if err != nil || len(ownerFeedbackView) != 1 || !ownerFeedbackView[0].CanAcknowledge || ownerFeedbackView[0].AuthoredByCurrentUser {
		t.Fatalf("owner ListFeedback() = %#v, %v", ownerFeedbackView, err)
	}
	acknowledged, err := manager.AcknowledgeFeedback(ctx, owner.ID, proposal.ID, applicantFeedback.ID)
	if err != nil || acknowledged.AcknowledgedAt == nil || acknowledged.CanAcknowledge {
		t.Fatalf("owner AcknowledgeFeedback() = %#v, %v", acknowledged, err)
	}
	if _, err := manager.AcknowledgeFeedback(ctx, owner.ID, proposal.ID, applicantFeedback.ID); !errors.Is(err, ErrFeedbackAcknowledgeUnavailable) {
		t.Fatalf("repeated AcknowledgeFeedback() error = %v, want ErrFeedbackAcknowledgeUnavailable", err)
	}
	ownerFeedback, err := manager.CreateFeedback(ctx, owner.ID, proposal.ID, FeedbackInput{
		ObservedBehaviors:    []string{"sound_scope_judgment", "constructive_feedback"},
		CollaborationExample: "They narrowed the milestone thoughtfully and explained every review suggestion clearly.",
		CollaborateAgain:     "yes",
		ReviewSummary:        "A focused collaborator who handled scope and review feedback constructively.",
	})
	if err != nil || ownerFeedback.AuthorRole != "owner" {
		t.Fatalf("owner CreateFeedback() = %#v, %v", ownerFeedback, err)
	}
	applicantFeedbackView, err := manager.ListFeedback(ctx, applicant.ID, proposal.ID)
	if err != nil || len(applicantFeedbackView) != 2 || !applicantFeedbackView[1].CanAcknowledge {
		t.Fatalf("applicant ListFeedback() = %#v, %v", applicantFeedbackView, err)
	}
	pendingCandidate, err := manager.GetTrustCandidate(ctx, applicant.ID, proposal.ID)
	if err != nil || pendingCandidate.Ready || pendingCandidate.Kind != "not_ready" {
		t.Fatalf("pending GetTrustCandidate() = %#v, %v", pendingCandidate, err)
	}
	if _, err := manager.AcknowledgeFeedback(ctx, applicant.ID, proposal.ID, ownerFeedback.ID); err != nil {
		t.Fatalf("applicant AcknowledgeFeedback() error = %v", err)
	}
	readyCandidate, err := manager.GetTrustCandidate(ctx, owner.ID, proposal.ID)
	if err != nil || !readyCandidate.Ready || readyCandidate.Kind != "work_demonstrated" {
		t.Fatalf("ready GetTrustCandidate() = %#v, %v", readyCandidate, err)
	}
	if _, err := safetyManager.Create(ctx, applicant.ID, safety.Input{
		TargetKind: "trial_feedback", TargetID: applicantFeedback.ID, Category: "other",
		Details: "A participant must not be able to report their own private feedback record.",
	}); !errors.Is(err, safety.ErrReportUnavailable) {
		t.Fatalf("self safety report error = %v, want ErrReportUnavailable", err)
	}
	feedbackReport, err := safetyManager.Create(ctx, applicant.ID, safety.Input{
		TargetKind: "trial_feedback", TargetID: ownerFeedback.ID, Category: "privacy",
		Details: "The counterpart feedback includes information that should receive a private moderator review.",
	})
	if err != nil || feedbackReport.Status != "pending" || len(feedbackReport.TargetSnapshot) == 0 {
		t.Fatalf("feedback safety report = %#v, %v", feedbackReport, err)
	}
	if _, err := safetyManager.Create(ctx, applicant.ID, safety.Input{
		TargetKind: "trial_feedback", TargetID: ownerFeedback.ID, Category: "privacy",
		Details: "A duplicate report for the same target should not create another moderation record.",
	}); !errors.Is(err, safety.ErrReportUnavailable) {
		t.Fatalf("duplicate safety report error = %v, want ErrReportUnavailable", err)
	}
	candidateReport, err := safetyManager.Create(ctx, owner.ID, safety.Input{
		TargetKind: "trust_candidate", TargetID: proposal.ID, Category: "fraud",
		Details: "The private trust candidate appears to rely on evidence that should be reviewed by moderation.",
	})
	if err != nil || candidateReport.Status != "pending" || len(candidateReport.TargetSnapshot) == 0 {
		t.Fatalf("candidate safety report = %#v, %v", candidateReport, err)
	}
	if removed, err := trialStore.TrustCandidateRemoved(ctx, owner.ID, proposal.ID); err != nil || removed {
		t.Fatalf("pending candidate moderation = %v, %v", removed, err)
	}
	if _, err := safetyManager.ListForModerator(ctx, owner.ID); !errors.Is(err, safety.ErrModeratorForbidden) {
		t.Fatalf("member moderation list error = %v, want ErrModeratorForbidden", err)
	}
	if _, err := pool.Exec(ctx, "UPDATE users SET account_role = 'moderator' WHERE id = $1", otherApplicant.ID); err != nil {
		t.Fatalf("promote test moderator: %v", err)
	}
	reports, err := safetyManager.ListForModerator(ctx, otherApplicant.ID)
	if err != nil || len(reports) != 2 || reports[0].Status != "pending" {
		t.Fatalf("moderation list = %#v, %v", reports, err)
	}
	decidedReport, err := safetyManager.Decide(ctx, otherApplicant.ID, feedbackReport.ID, safety.DecisionInput{
		Decision: "upheld", ModeratorNotes: "The captured snapshot contains private information requiring a manual follow-up.",
	})
	if err != nil || decidedReport.Status != "upheld" || decidedReport.DecidedAt == nil {
		t.Fatalf("moderation decision = %#v, %v", decidedReport, err)
	}
	enforcedFeedback, err := manager.ListFeedback(ctx, applicant.ID, proposal.ID)
	if err != nil || len(enforcedFeedback) != 2 || enforcedFeedback[1].ModerationStatus != "removed" || len(enforcedFeedback[1].Input.ObservedBehaviors) != 0 || enforcedFeedback[1].CanAcknowledge {
		t.Fatalf("enforced feedback = %#v, %v", enforcedFeedback, err)
	}
	enforcedCandidate, err := manager.GetTrustCandidate(ctx, applicant.ID, proposal.ID)
	if err != nil || enforcedCandidate.Kind != "suppressed" || enforcedCandidate.Ready {
		t.Fatalf("enforced trust candidate = %#v, %v", enforcedCandidate, err)
	}
	feedbackAppeal, err := safetyManager.CreateAppeal(ctx, owner.ID, safety.AppealInput{
		TargetKind: "trial_feedback", TargetID: ownerFeedback.ID,
		Reason: "The complete trial record provides context that should be considered before this removal remains permanent.",
	})
	if err != nil || feedbackAppeal.Status != "pending" || feedbackAppeal.ReportID != feedbackReport.ID {
		t.Fatalf("feedback appeal = %#v, %v", feedbackAppeal, err)
	}
	if _, err := safetyManager.CreateAppeal(ctx, owner.ID, safety.AppealInput{TargetKind: "trial_feedback", TargetID: ownerFeedback.ID, Reason: "A duplicate appeal must not replace the original pending reconsideration request."}); !errors.Is(err, safety.ErrAppealUnavailable) {
		t.Fatalf("duplicate appeal error = %v", err)
	}
	if _, err := safetyManager.Decide(ctx, otherApplicant.ID, candidateReport.ID, safety.DecisionInput{
		Decision: "upheld", ModeratorNotes: "The captured candidate is misleading and must be removed from participant review.",
	}); err != nil {
		t.Fatalf("candidate moderation decision: %v", err)
	}
	if removed, err := trialStore.TrustCandidateRemoved(ctx, owner.ID, proposal.ID); err != nil || !removed {
		t.Fatalf("upheld candidate moderation = %v, %v", removed, err)
	}
	candidateAppeal, err := safetyManager.CreateAppeal(ctx, applicant.ID, safety.AppealInput{TargetKind: "trust_candidate", TargetID: proposal.ID, Reason: "The candidate should be reconsidered against the full confirmed outcome and both participant reviews."})
	if err != nil || candidateAppeal.ReportID != candidateReport.ID { t.Fatalf("candidate appeal = %#v, %v", candidateAppeal, err) }
	appeals, err := safetyManager.ListAppealsForModerator(ctx, otherApplicant.ID)
	if err != nil || len(appeals) != 2 { t.Fatalf("moderation appeals = %#v, %v", appeals, err) }
	if _, err := safetyManager.Decide(ctx, otherApplicant.ID, feedbackReport.ID, safety.DecisionInput{
		Decision: "dismissed", ModeratorNotes: "A second decision must not replace the original immutable moderation outcome.",
	}); !errors.Is(err, safety.ErrDecisionUnavailable) {
		t.Fatalf("repeated moderation decision error = %v, want ErrDecisionUnavailable", err)
	}
}

func validPostgresFeedbackInput() FeedbackInput {
	return FeedbackInput{
		ObservedBehaviors:    []string{"reliable_delivery", "clear_communication"},
		CollaborationExample: "They surfaced a blocker early and delivered the revised milestone on time.",
		CollaborateAgain:     "yes",
		ReviewSummary:        "A dependable collaborator who communicated tradeoffs clearly during the trial.",
	}
}

func validTrialInput() Input {
	return Input{
		Outcome:     "Build a usable comparison flow with documented decisions.",
		Deliverable: "A tested comparison component and implementation note.",
		NonGoals:    "No production data access or deployment.",
		StartDate:   "2026-09-01", EndDate: "2026-09-15", WeeklyHours: 8,
		CheckInCadence: "Async update every two days", AccessLevel: "Limited repository access",
		Confidentiality: "Synthetic data during trial", IPOwnership: "Open-source contribution under the project license",
		ExitPlan: "Remove repository access and hand over all documented trial work.", TermsConfirmed: true,
	}
}

func validApplicationInput() applications.Input {
	return applications.Input{
		Message:       "I can deliver the bounded milestone and document each implementation decision.",
		WorkSampleURL: "https://github.com/example/comparison", WorkSampleContext: "A comparable tested collaboration workflow.",
		Availability: "8 hours each week", AvailabilityConfirmed: true,
		ProposedContribution: "Implement and test the private trial proposal flow.",
	}
}

func createTrialTestUser(
	t *testing.T,
	ctx context.Context,
	authStore *auth.PostgresStore,
	profileService *profile.Service,
	githubID int64,
	displayName string,
) auth.User {
	t.Helper()
	user, err := authStore.UpsertGitHubUser(ctx, auth.GitHubUser{
		ID: githubID, Login: fmt.Sprintf("trial-user-%d", githubID), Name: &displayName,
		AvatarURL: "https://avatars.example/trial", ProfileURL: "https://github.com/trial-user",
	})
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	_, err = profileService.Save(ctx, user.ID, profile.Input{
		DisplayName: displayName, PrimaryRole: "Software developer",
		Bio:      "I build dependable collaboration products with bounded milestones and clear evidence.",
		Timezone: "Asia/Kolkata", WeeklyAvailability: "6–8 hrs/week", PreferredDuration: "2–4 weeks",
		WorkStyle: "Async-first", CommunicationCadence: "Three updates per week",
		Skills: []string{"Go", "PostgreSQL"}, EvidenceSummary: "Recent public work includes tested services and reviewed pull requests.",
	})
	if err != nil {
		t.Fatalf("create test profile: %v", err)
	}
	return user
}
