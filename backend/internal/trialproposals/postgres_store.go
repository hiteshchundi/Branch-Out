package trialproposals

import (
	"context"
	"errors"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type PostgresStore struct{ queries *database.Queries }

func NewPostgresStore(queries *database.Queries) *PostgresStore {
	return &PostgresStore{queries: queries}
}

func (store *PostgresStore) GetOwn(ctx context.Context, userID int64, openingID string) (Proposal, error) {
	row, err := store.queries.GetOwnTrialProposal(ctx, database.GetOwnTrialProposalParams{
		OpeningID: openingID, ApplicantUserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Proposal{}, ErrNotFound
	}
	if err != nil {
		return Proposal{}, err
	}
	return fromDatabase(row), nil
}

func (store *PostgresStore) UpsertOwnDraft(ctx context.Context, record Record) (Proposal, error) {
	startDate, _ := time.Parse("2006-01-02", record.Input.StartDate)
	endDate, _ := time.Parse("2006-01-02", record.Input.EndDate)
	row, err := store.queries.UpsertOwnTrialProposalDraft(ctx, database.UpsertOwnTrialProposalDraftParams{
		ID: record.ID, OpeningID: record.OpeningID, ApplicantUserID: record.ApplicantUserID,
		Outcome: record.Input.Outcome, Deliverable: record.Input.Deliverable,
		NonGoals: record.Input.NonGoals, StartDate: pgtype.Date{Time: startDate, Valid: true},
		EndDate: pgtype.Date{Time: endDate, Valid: true}, WeeklyHours: record.Input.WeeklyHours,
		CheckInCadence: record.Input.CheckInCadence, AccessLevel: record.Input.AccessLevel,
		Confidentiality: record.Input.Confidentiality, IpOwnership: record.Input.IPOwnership,
		ExitPlan: record.Input.ExitPlan, TermsConfirmed: record.Input.TermsConfirmed,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Proposal{}, ErrUnavailable
	}
	if err != nil {
		return Proposal{}, err
	}
	return fromDatabase(row), nil
}

func (store *PostgresStore) SendOwn(ctx context.Context, userID int64, openingID string) (Proposal, error) {
	row, err := store.queries.SendOwnTrialProposal(ctx, database.SendOwnTrialProposalParams{
		OpeningID: openingID, ApplicantUserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Proposal{}, ErrSendUnavailable
	}
	if err != nil {
		return Proposal{}, err
	}
	return fromDatabase(row), nil
}

func (store *PostgresStore) ListForOwner(ctx context.Context, userID int64, openingID string) ([]OwnerProposal, error) {
	if _, err := store.queries.GetOwnedOpeningTrialProposalReviewScope(ctx, database.GetOwnedOpeningTrialProposalReviewScopeParams{
		OpeningID: openingID, OwnerUserID: &userID,
	}); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrReviewNotFound
	} else if err != nil {
		return nil, err
	}
	rows, err := store.queries.ListTrialProposalsForOwner(ctx, database.ListTrialProposalsForOwnerParams{
		OpeningID: openingID, OwnerUserID: &userID,
	})
	if err != nil {
		return nil, err
	}
	results := make([]OwnerProposal, 0, len(rows))
	for _, row := range rows {
		proposal := fromDatabase(database.TrialProposal{
			ID: row.ID, ApplicationID: row.ApplicationID, OpeningID: row.OpeningID,
			ApplicantUserID: row.ApplicantUserID, Outcome: row.Outcome,
			Deliverable: row.Deliverable, NonGoals: row.NonGoals, StartDate: row.StartDate,
			EndDate: row.EndDate, WeeklyHours: row.WeeklyHours, CheckInCadence: row.CheckInCadence,
			AccessLevel: row.AccessLevel, Confidentiality: row.Confidentiality,
			IpOwnership: row.IpOwnership, ExitPlan: row.ExitPlan, TermsConfirmed: row.TermsConfirmed,
			ProposalStatus: row.ProposalStatus, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
			SentAt: row.SentAt, DecidedAt: row.DecidedAt,
		})
		results = append(results, OwnerProposal{Proposal: proposal, Applicant: Applicant{
			DisplayName: row.ApplicantDisplayName, PrimaryRole: row.ApplicantPrimaryRole,
			GitHubURL: row.ApplicantGithubUrl,
		}})
	}
	return results, nil
}

func (store *PostgresStore) Decide(ctx context.Context, userID int64, openingID, proposalID, decision string) (Proposal, error) {
	if _, err := store.queries.GetOwnedOpeningTrialProposalReviewScope(ctx, database.GetOwnedOpeningTrialProposalReviewScopeParams{
		OpeningID: openingID, OwnerUserID: &userID,
	}); errors.Is(err, pgx.ErrNoRows) {
		return Proposal{}, ErrReviewNotFound
	} else if err != nil {
		return Proposal{}, err
	}
	row, err := store.queries.DecideTrialProposalForOwner(ctx, database.DecideTrialProposalForOwnerParams{
		Decision: decision, ProposalID: proposalID, OpeningID: openingID, OwnerUserID: &userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Proposal{}, ErrDecisionUnavailable
	}
	if err != nil {
		return Proposal{}, err
	}
	return fromDatabase(row), nil
}

func (store *PostgresStore) ListCheckIns(ctx context.Context, userID int64, proposalID string) ([]CheckIn, error) {
	if _, err := store.queries.GetTrialWorkspaceForParticipant(ctx, database.GetTrialWorkspaceForParticipantParams{
		ProposalID: proposalID, ParticipantUserID: userID,
	}); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrWorkspaceNotFound
	} else if err != nil {
		return nil, err
	}
	rows, err := store.queries.ListTrialCheckInsForParticipant(ctx, database.ListTrialCheckInsForParticipantParams{
		ProposalID: proposalID, ParticipantUserID: userID,
	})
	if err != nil {
		return nil, err
	}
	results := make([]CheckIn, 0, len(rows))
	for _, row := range rows {
		results = append(results, CheckIn{
			ID: row.ID, ProposalID: row.ProposalID, Kind: row.CheckInKind,
			Update: row.UpdateText, EvidenceURL: row.EvidenceUrl,
			Author:     CheckInAuthor{DisplayName: row.AuthorDisplayName},
			AuthorRole: row.AuthorRole, CreatedAt: row.CreatedAt,
		})
	}
	return results, nil
}

func (store *PostgresStore) CreateCheckIn(ctx context.Context, record CheckInRecord) (CheckIn, error) {
	row, err := store.queries.CreateTrialCheckInForParticipant(ctx, database.CreateTrialCheckInForParticipantParams{
		ID: record.ID, ProposalID: record.ProposalID, AuthorUserID: record.AuthorUserID,
		CheckInKind: record.Input.Kind, UpdateText: record.Input.Update,
		EvidenceUrl: record.Input.EvidenceURL,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return CheckIn{}, ErrWorkspaceNotFound
	}
	if err != nil {
		return CheckIn{}, err
	}
	return CheckIn{
		ID: row.ID, ProposalID: row.ProposalID, Kind: row.CheckInKind,
		Update: row.UpdateText, EvidenceURL: row.EvidenceUrl,
		Author:     CheckInAuthor{DisplayName: row.AuthorDisplayName},
		AuthorRole: row.AuthorRole, CreatedAt: row.CreatedAt,
	}, nil
}

func (store *PostgresStore) GetOutcome(ctx context.Context, userID int64, proposalID string) (Outcome, error) {
	row, err := store.queries.GetTrialOutcomeForParticipant(ctx, database.GetTrialOutcomeForParticipantParams{
		ParticipantUserID: userID, ProposalID: proposalID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Outcome{}, ErrOutcomeNotFound
	}
	if err != nil {
		return Outcome{}, err
	}
	canDecide := row.CanDecide != nil && *row.CanDecide
	return outcomeFromValues(
		row.ID, row.ProposalID, row.OutcomeStatus,
		row.DeliverableStatus, row.WorkSummary, row.EvidenceUrl, row.CloseoutNotes,
		row.ReviewStatus, row.SubmittedAt, row.DecidedAt, row.SubmittedByDisplayName,
		row.SubmittedByRole, row.SubmittedByUserID == userID, canDecide,
	), nil
}

func (store *PostgresStore) CreateOutcome(ctx context.Context, record OutcomeRecord) (Outcome, error) {
	row, err := store.queries.CreateTrialOutcomeForParticipant(ctx, database.CreateTrialOutcomeForParticipantParams{
		ID: record.ID, ProposalID: record.ProposalID, SubmittedByUserID: record.SubmittedByUserID,
		OutcomeStatus: record.Input.OutcomeStatus, DeliverableStatus: record.Input.DeliverableStatus,
		WorkSummary: record.Input.WorkSummary, EvidenceUrl: record.Input.EvidenceURL,
		CloseoutNotes: record.Input.CloseoutNotes,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Outcome{}, ErrOutcomeUnavailable
	}
	if err != nil {
		return Outcome{}, err
	}
	return outcomeFromValues(
		row.ID, row.ProposalID, row.OutcomeStatus,
		row.DeliverableStatus, row.WorkSummary, row.EvidenceUrl, row.CloseoutNotes,
		row.ReviewStatus, row.SubmittedAt, row.DecidedAt, row.SubmittedByDisplayName,
		row.SubmittedByRole, true, row.CanDecide,
	), nil
}

func (store *PostgresStore) DecideOutcome(ctx context.Context, userID int64, proposalID, decision string) (Outcome, error) {
	row, err := store.queries.DecideTrialOutcomeForParticipant(ctx, database.DecideTrialOutcomeForParticipantParams{
		Decision: decision, ParticipantUserID: &userID, ProposalID: proposalID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Outcome{}, ErrOutcomeDecisionUnavailable
	}
	if err != nil {
		return Outcome{}, err
	}
	return outcomeFromValues(
		row.ID, row.ProposalID, row.OutcomeStatus,
		row.DeliverableStatus, row.WorkSummary, row.EvidenceUrl, row.CloseoutNotes,
		row.ReviewStatus, row.SubmittedAt, row.DecidedAt, row.SubmittedByDisplayName,
		row.SubmittedByRole, false, row.CanDecide,
	), nil
}

func outcomeFromValues(
	id, proposalID string,
	outcomeStatus, deliverableStatus, workSummary, evidenceURL, closeoutNotes, reviewStatus string,
	submittedAt time.Time,
	decidedAtValue pgtype.Timestamptz,
	submittedByDisplayName, submittedByRole string,
	submittedByCurrentUser, canDecide bool,
) Outcome {
	var decidedAt *time.Time
	if decidedAtValue.Valid {
		value := decidedAtValue.Time
		decidedAt = &value
	}
	return Outcome{
		ID: id, ProposalID: proposalID,
		Input: OutcomeInput{
			OutcomeStatus: outcomeStatus, DeliverableStatus: deliverableStatus,
			WorkSummary: workSummary, EvidenceURL: evidenceURL, CloseoutNotes: closeoutNotes,
		},
		ReviewStatus:    reviewStatus,
		SubmittedBy:     CheckInAuthor{DisplayName: submittedByDisplayName},
		SubmittedByRole: submittedByRole, SubmittedByCurrentUser: submittedByCurrentUser,
		CanDecide: canDecide, SubmittedAt: submittedAt, DecidedAt: decidedAt,
	}
}

func (store *PostgresStore) ListFeedback(ctx context.Context, userID int64, proposalID string) ([]Feedback, error) {
	rows, err := store.queries.ListTrialFeedbackForParticipant(ctx, database.ListTrialFeedbackForParticipantParams{
		ParticipantUserID: userID, ProposalID: proposalID,
	})
	if err != nil {
		return nil, err
	}
	results := make([]Feedback, 0, len(rows))
	for _, row := range rows {
		canAcknowledge := row.CanAcknowledge != nil && *row.CanAcknowledge
		results = append(results, feedbackFromValues(
			row.ID, row.ProposalID, row.ObservedBehaviors, row.CollaborationExample,
			row.CollaborateAgain, row.ReviewSummary, row.AuthorDisplayName, row.AuthorRole,
			row.AuthoredByCurrentUser, canAcknowledge, row.SubmittedAt, row.AcknowledgedAt,
		))
	}
	return results, nil
}

func (store *PostgresStore) CreateFeedback(ctx context.Context, record FeedbackRecord) (Feedback, error) {
	row, err := store.queries.CreateTrialFeedbackForParticipant(ctx, database.CreateTrialFeedbackForParticipantParams{
		ID: record.ID, ProposalID: record.ProposalID, AuthorUserID: record.AuthorUserID,
		ObservedBehaviors:    record.Input.ObservedBehaviors,
		CollaborationExample: record.Input.CollaborationExample,
		CollaborateAgain:     record.Input.CollaborateAgain, ReviewSummary: record.Input.ReviewSummary,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Feedback{}, ErrFeedbackUnavailable
	}
	if err != nil {
		return Feedback{}, err
	}
	return feedbackFromValues(
		row.ID, row.ProposalID, row.ObservedBehaviors, row.CollaborationExample,
		row.CollaborateAgain, row.ReviewSummary, row.AuthorDisplayName, row.AuthorRole,
		row.AuthoredByCurrentUser, row.CanAcknowledge, row.SubmittedAt, row.AcknowledgedAt,
	), nil
}

func (store *PostgresStore) AcknowledgeFeedback(ctx context.Context, userID int64, proposalID, feedbackID string) (Feedback, error) {
	row, err := store.queries.AcknowledgeTrialFeedbackForParticipant(ctx, database.AcknowledgeTrialFeedbackForParticipantParams{
		ParticipantUserID: &userID, ProposalID: proposalID, FeedbackID: feedbackID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Feedback{}, ErrFeedbackAcknowledgeUnavailable
	}
	if err != nil {
		return Feedback{}, err
	}
	return feedbackFromValues(
		row.ID, row.ProposalID, row.ObservedBehaviors, row.CollaborationExample,
		row.CollaborateAgain, row.ReviewSummary, row.AuthorDisplayName, row.AuthorRole,
		row.AuthoredByCurrentUser, row.CanAcknowledge, row.SubmittedAt, row.AcknowledgedAt,
	), nil
}

func feedbackFromValues(
	id, proposalID string, observedBehaviors []string,
	collaborationExample, collaborateAgain, reviewSummary, authorDisplayName, authorRole string,
	authoredByCurrentUser, canAcknowledge bool, submittedAt time.Time,
	acknowledgedAtValue pgtype.Timestamptz,
) Feedback {
	var acknowledgedAt *time.Time
	if acknowledgedAtValue.Valid {
		value := acknowledgedAtValue.Time
		acknowledgedAt = &value
	}
	return Feedback{
		ID: id, ProposalID: proposalID,
		Input: FeedbackInput{
			ObservedBehaviors: observedBehaviors, CollaborationExample: collaborationExample,
			CollaborateAgain: collaborateAgain, ReviewSummary: reviewSummary,
		},
		Author: CheckInAuthor{DisplayName: authorDisplayName}, AuthorRole: authorRole,
		AuthoredByCurrentUser: authoredByCurrentUser, CanAcknowledge: canAcknowledge,
		SubmittedAt: submittedAt, AcknowledgedAt: acknowledgedAt,
	}
}

func fromDatabase(row database.TrialProposal) Proposal {
	var sentAt *time.Time
	if row.SentAt.Valid {
		value := row.SentAt.Time
		sentAt = &value
	}
	var decidedAt *time.Time
	if row.DecidedAt.Valid {
		value := row.DecidedAt.Time
		decidedAt = &value
	}
	return Proposal{
		ID: row.ID, ApplicationID: row.ApplicationID, OpeningID: row.OpeningID,
		Input: Input{
			Outcome: row.Outcome, Deliverable: row.Deliverable, NonGoals: row.NonGoals,
			StartDate: row.StartDate.Time.Format("2006-01-02"), EndDate: row.EndDate.Time.Format("2006-01-02"),
			WeeklyHours: row.WeeklyHours, CheckInCadence: row.CheckInCadence,
			AccessLevel: row.AccessLevel, Confidentiality: row.Confidentiality,
			IPOwnership: row.IpOwnership, ExitPlan: row.ExitPlan, TermsConfirmed: row.TermsConfirmed,
		},
		Status: row.ProposalStatus, SentAt: sentAt, DecidedAt: decidedAt,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}
