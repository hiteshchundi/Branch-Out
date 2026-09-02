// Package trialproposals owns private two-week trial drafts tied to accepted applications.
package trialproposals

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"
)

var (
	ErrNotFound                   = errors.New("trial proposal not found")
	ErrUnavailable                = errors.New("trial proposal unavailable")
	ErrSendUnavailable            = errors.New("trial proposal send unavailable")
	ErrReviewNotFound             = errors.New("trial proposal review opening not found")
	ErrDecisionUnavailable        = errors.New("trial proposal decision unavailable")
	ErrWorkspaceNotFound          = errors.New("trial workspace not found")
	ErrOutcomeNotFound            = errors.New("trial outcome not found")
	ErrOutcomeUnavailable         = errors.New("trial outcome unavailable")
	ErrOutcomeDecisionUnavailable = errors.New("trial outcome decision unavailable")
)

type FieldError struct {
	Field   string
	Message string
}

func (err *FieldError) Error() string { return err.Message }

type Input struct {
	Outcome         string `json:"outcome"`
	Deliverable     string `json:"deliverable"`
	NonGoals        string `json:"nonGoals"`
	StartDate       string `json:"startDate"`
	EndDate         string `json:"endDate"`
	WeeklyHours     int32  `json:"weeklyHours"`
	CheckInCadence  string `json:"checkInCadence"`
	AccessLevel     string `json:"accessLevel"`
	Confidentiality string `json:"confidentiality"`
	IPOwnership     string `json:"ipOwnership"`
	ExitPlan        string `json:"exitPlan"`
	TermsConfirmed  bool   `json:"termsConfirmed"`
}

type Proposal struct {
	ID            string     `json:"id"`
	ApplicationID string     `json:"applicationId"`
	OpeningID     string     `json:"openingId"`
	Input         Input      `json:"input"`
	Status        string     `json:"status"`
	SentAt        *time.Time `json:"sentAt"`
	DecidedAt     *time.Time `json:"decidedAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type Applicant struct {
	DisplayName string `json:"displayName"`
	PrimaryRole string `json:"primaryRole"`
	GitHubURL   string `json:"githubUrl"`
}

type OwnerProposal struct {
	Proposal
	Applicant Applicant `json:"applicant"`
}

type CheckInInput struct {
	Kind        string `json:"kind"`
	Update      string `json:"update"`
	EvidenceURL string `json:"evidenceUrl"`
}

type CheckIn struct {
	ID          string        `json:"id"`
	ProposalID  string        `json:"proposalId"`
	Kind        string        `json:"kind"`
	Update      string        `json:"update"`
	EvidenceURL string        `json:"evidenceUrl"`
	Author      CheckInAuthor `json:"author"`
	AuthorRole  string        `json:"authorRole"`
	CreatedAt   time.Time     `json:"createdAt"`
}

type CheckInAuthor struct {
	DisplayName string `json:"displayName"`
}

type CheckInRecord struct {
	ID           string
	ProposalID   string
	AuthorUserID int64
	Input        CheckInInput
}

type OutcomeInput struct {
	OutcomeStatus     string `json:"outcomeStatus"`
	DeliverableStatus string `json:"deliverableStatus"`
	WorkSummary       string `json:"workSummary"`
	EvidenceURL       string `json:"evidenceUrl"`
	CloseoutNotes     string `json:"closeoutNotes"`
}

type Outcome struct {
	ID                     string        `json:"id"`
	ProposalID             string        `json:"proposalId"`
	Input                  OutcomeInput  `json:"input"`
	ReviewStatus           string        `json:"reviewStatus"`
	SubmittedBy            CheckInAuthor `json:"submittedBy"`
	SubmittedByRole        string        `json:"submittedByRole"`
	SubmittedByCurrentUser bool          `json:"submittedByCurrentUser"`
	CanDecide              bool          `json:"canDecide"`
	SubmittedAt            time.Time     `json:"submittedAt"`
	DecidedAt              *time.Time    `json:"decidedAt"`
}

type OutcomeRecord struct {
	ID                string
	ProposalID        string
	SubmittedByUserID int64
	Input             OutcomeInput
}

type Record struct {
	Proposal
	ApplicantUserID int64
}

type Store interface {
	GetOwn(context.Context, int64, string) (Proposal, error)
	UpsertOwnDraft(context.Context, Record) (Proposal, error)
	SendOwn(context.Context, int64, string) (Proposal, error)
	ListForOwner(context.Context, int64, string) ([]OwnerProposal, error)
	Decide(context.Context, int64, string, string, string) (Proposal, error)
	ListCheckIns(context.Context, int64, string) ([]CheckIn, error)
	CreateCheckIn(context.Context, CheckInRecord) (CheckIn, error)
	GetOutcome(context.Context, int64, string) (Outcome, error)
	CreateOutcome(context.Context, OutcomeRecord) (Outcome, error)
	DecideOutcome(context.Context, int64, string, string) (Outcome, error)
}

func (manager *Manager) SendOwn(ctx context.Context, userID int64, openingID string) (Proposal, error) {
	openingID = strings.TrimSpace(openingID)
	if openingID == "" {
		return Proposal{}, ErrSendUnavailable
	}
	return manager.store.SendOwn(ctx, userID, openingID)
}

func (manager *Manager) ListForOwner(ctx context.Context, userID int64, openingID string) ([]OwnerProposal, error) {
	openingID = strings.TrimSpace(openingID)
	if openingID == "" {
		return nil, ErrReviewNotFound
	}
	return manager.store.ListForOwner(ctx, userID, openingID)
}

func (manager *Manager) Decide(ctx context.Context, userID int64, openingID, proposalID, decision string) (Proposal, error) {
	openingID = strings.TrimSpace(openingID)
	proposalID = strings.TrimSpace(proposalID)
	decision = strings.TrimSpace(decision)
	if openingID == "" || proposalID == "" || (decision != "accepted" && decision != "declined") {
		return Proposal{}, ErrDecisionUnavailable
	}
	return manager.store.Decide(ctx, userID, openingID, proposalID, decision)
}

func (manager *Manager) ListCheckIns(ctx context.Context, userID int64, proposalID string) ([]CheckIn, error) {
	proposalID = strings.TrimSpace(proposalID)
	if proposalID == "" {
		return nil, ErrWorkspaceNotFound
	}
	return manager.store.ListCheckIns(ctx, userID, proposalID)
}

func (manager *Manager) AddCheckIn(ctx context.Context, userID int64, proposalID string, input CheckInInput) (CheckIn, error) {
	proposalID = strings.TrimSpace(proposalID)
	input.Kind = strings.TrimSpace(input.Kind)
	input.Update = strings.TrimSpace(input.Update)
	input.EvidenceURL = strings.TrimSpace(input.EvidenceURL)
	if proposalID == "" {
		return CheckIn{}, ErrWorkspaceNotFound
	}
	if input.Kind != "progress" && input.Kind != "blocker" && input.Kind != "milestone" {
		return CheckIn{}, &FieldError{Field: "kind", Message: "kind is unsupported"}
	}
	if length := len([]rune(input.Update)); length < 20 || length > 1000 {
		return CheckIn{}, &FieldError{Field: "update", Message: "update has an invalid length"}
	}
	if len(input.EvidenceURL) > 2048 {
		return CheckIn{}, &FieldError{Field: "evidenceUrl", Message: "evidenceUrl is too long"}
	}
	if input.EvidenceURL != "" {
		parsed, err := url.ParseRequestURI(input.EvidenceURL)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return CheckIn{}, &FieldError{Field: "evidenceUrl", Message: "evidenceUrl must be a complete http or https URL"}
		}
	}
	id, err := randomID(manager.random)
	if err != nil {
		return CheckIn{}, fmt.Errorf("generate trial check-in ID: %w", err)
	}
	return manager.store.CreateCheckIn(ctx, CheckInRecord{
		ID: id, ProposalID: proposalID, AuthorUserID: userID, Input: input,
	})
}

func (manager *Manager) GetOutcome(ctx context.Context, userID int64, proposalID string) (Outcome, error) {
	proposalID = strings.TrimSpace(proposalID)
	if proposalID == "" {
		return Outcome{}, ErrOutcomeNotFound
	}
	return manager.store.GetOutcome(ctx, userID, proposalID)
}

func (manager *Manager) CreateOutcome(ctx context.Context, userID int64, proposalID string, input OutcomeInput) (Outcome, error) {
	proposalID = strings.TrimSpace(proposalID)
	if proposalID == "" {
		return Outcome{}, ErrOutcomeUnavailable
	}
	normalized, err := normalizeOutcomeInput(input)
	if err != nil {
		return Outcome{}, err
	}
	id, err := randomID(manager.random)
	if err != nil {
		return Outcome{}, fmt.Errorf("generate trial outcome ID: %w", err)
	}
	return manager.store.CreateOutcome(ctx, OutcomeRecord{
		ID: id, ProposalID: proposalID, SubmittedByUserID: userID, Input: normalized,
	})
}

func (manager *Manager) DecideOutcome(ctx context.Context, userID int64, proposalID, decision string) (Outcome, error) {
	proposalID = strings.TrimSpace(proposalID)
	decision = strings.TrimSpace(decision)
	if proposalID == "" || (decision != "confirmed" && decision != "disputed") {
		return Outcome{}, ErrOutcomeDecisionUnavailable
	}
	return manager.store.DecideOutcome(ctx, userID, proposalID, decision)
}

func normalizeOutcomeInput(input OutcomeInput) (OutcomeInput, error) {
	input.OutcomeStatus = strings.TrimSpace(input.OutcomeStatus)
	input.DeliverableStatus = strings.TrimSpace(input.DeliverableStatus)
	input.WorkSummary = strings.TrimSpace(input.WorkSummary)
	input.EvidenceURL = strings.TrimSpace(input.EvidenceURL)
	input.CloseoutNotes = strings.TrimSpace(input.CloseoutNotes)
	if input.OutcomeStatus != "completed" && input.OutcomeStatus != "partially_completed" && input.OutcomeStatus != "stopped_early" {
		return OutcomeInput{}, &FieldError{Field: "outcomeStatus", Message: "outcomeStatus is unsupported"}
	}
	if input.DeliverableStatus != "met" && input.DeliverableStatus != "partially_met" && input.DeliverableStatus != "not_met" {
		return OutcomeInput{}, &FieldError{Field: "deliverableStatus", Message: "deliverableStatus is unsupported"}
	}
	if length := len([]rune(input.WorkSummary)); length < 30 || length > 1000 {
		return OutcomeInput{}, &FieldError{Field: "workSummary", Message: "workSummary has an invalid length"}
	}
	if length := len([]rune(input.CloseoutNotes)); length < 20 || length > 1000 {
		return OutcomeInput{}, &FieldError{Field: "closeoutNotes", Message: "closeoutNotes has an invalid length"}
	}
	if len(input.EvidenceURL) > 2048 {
		return OutcomeInput{}, &FieldError{Field: "evidenceUrl", Message: "evidenceUrl is too long"}
	}
	if input.EvidenceURL != "" {
		parsed, err := url.ParseRequestURI(input.EvidenceURL)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return OutcomeInput{}, &FieldError{Field: "evidenceUrl", Message: "evidenceUrl must be a complete http or https URL"}
		}
	}
	return input, nil
}

type Manager struct {
	store  Store
	random io.Reader
}

func NewManager(store Store) *Manager {
	return &Manager{store: store, random: rand.Reader}
}

func (manager *Manager) GetOwn(ctx context.Context, userID int64, openingID string) (Proposal, error) {
	openingID = strings.TrimSpace(openingID)
	if openingID == "" {
		return Proposal{}, ErrNotFound
	}
	return manager.store.GetOwn(ctx, userID, openingID)
}

func (manager *Manager) SaveOwnDraft(ctx context.Context, userID int64, openingID string, input Input) (Proposal, error) {
	openingID = strings.TrimSpace(openingID)
	if openingID == "" {
		return Proposal{}, ErrUnavailable
	}
	normalized, err := normalizeInput(input)
	if err != nil {
		return Proposal{}, err
	}
	id, err := randomID(manager.random)
	if err != nil {
		return Proposal{}, fmt.Errorf("generate trial proposal ID: %w", err)
	}
	return manager.store.UpsertOwnDraft(ctx, Record{
		Proposal:        Proposal{ID: id, OpeningID: openingID, Input: normalized, Status: "draft"},
		ApplicantUserID: userID,
	})
}

func normalizeInput(input Input) (Input, error) {
	input.Outcome = strings.TrimSpace(input.Outcome)
	input.Deliverable = strings.TrimSpace(input.Deliverable)
	input.NonGoals = strings.TrimSpace(input.NonGoals)
	input.StartDate = strings.TrimSpace(input.StartDate)
	input.EndDate = strings.TrimSpace(input.EndDate)
	input.CheckInCadence = strings.TrimSpace(input.CheckInCadence)
	input.AccessLevel = strings.TrimSpace(input.AccessLevel)
	input.Confidentiality = strings.TrimSpace(input.Confidentiality)
	input.IPOwnership = strings.TrimSpace(input.IPOwnership)
	input.ExitPlan = strings.TrimSpace(input.ExitPlan)

	for _, check := range []struct {
		field, value     string
		minimum, maximum int
	}{
		{"outcome", input.Outcome, 20, 500},
		{"deliverable", input.Deliverable, 20, 500},
		{"nonGoals", input.NonGoals, 15, 500},
		{"exitPlan", input.ExitPlan, 20, 500},
	} {
		length := len([]rune(check.value))
		if length < check.minimum || length > check.maximum {
			return Input{}, &FieldError{Field: check.field, Message: check.field + " has an invalid length"}
		}
	}
	start, err := time.Parse("2006-01-02", input.StartDate)
	if err != nil {
		return Input{}, &FieldError{Field: "startDate", Message: "startDate must be a calendar date"}
	}
	end, err := time.Parse("2006-01-02", input.EndDate)
	if err != nil {
		return Input{}, &FieldError{Field: "endDate", Message: "endDate must be a calendar date"}
	}
	days := int(end.Sub(start).Hours() / 24)
	if days < 13 || days > 15 {
		return Input{}, &FieldError{Field: "endDate", Message: "trial dates must span 13 to 15 days"}
	}
	if input.WeeklyHours < 1 || input.WeeklyHours > 40 {
		return Input{}, &FieldError{Field: "weeklyHours", Message: "weeklyHours must be between 1 and 40"}
	}
	for _, check := range []struct {
		field, value string
		allowed      map[string]bool
	}{
		{"checkInCadence", input.CheckInCadence, map[string]bool{"Async update every two days": true, "Twice-weekly live check-in": true, "Weekly review plus async updates": true}},
		{"accessLevel", input.AccessLevel, map[string]bool{"Sandbox or sample data only": true, "Limited repository access": true, "Time-limited production access": true}},
		{"confidentiality", input.Confidentiality, map[string]bool{"Public work only": true, "Private after written agreement": true, "Synthetic data during trial": true}},
		{"ipOwnership", input.IPOwnership, map[string]bool{
			"Contributor retains pre-existing work; project owns trial deliverable": true,
			"Contributor licenses trial deliverable to the project":                 true,
			"Open-source contribution under the project license":                    true,
			"Custom written terms required before work starts":                      true,
		}},
	} {
		if !check.allowed[check.value] {
			return Input{}, &FieldError{Field: check.field, Message: check.field + " is unsupported"}
		}
	}
	if !input.TermsConfirmed {
		return Input{}, &FieldError{Field: "termsConfirmed", Message: "terms must be confirmed"}
	}
	return input, nil
}

func randomID(reader io.Reader) (string, error) {
	buffer := make([]byte, 16)
	if _, err := io.ReadFull(reader, buffer); err != nil {
		return "", err
	}
	buffer[6] = (buffer[6] & 0x0f) | 0x40
	buffer[8] = (buffer[8] & 0x3f) | 0x80
	encoded := hex.EncodeToString(buffer)
	return encoded[0:8] + "-" + encoded[8:12] + "-" + encoded[12:16] + "-" + encoded[16:20] + "-" + encoded[20:32], nil
}
