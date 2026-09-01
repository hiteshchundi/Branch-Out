// Package trialproposals owns private two-week trial drafts tied to accepted applications.
package trialproposals

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
)

var (
	ErrNotFound            = errors.New("trial proposal not found")
	ErrUnavailable         = errors.New("trial proposal unavailable")
	ErrSendUnavailable     = errors.New("trial proposal send unavailable")
	ErrReviewNotFound      = errors.New("trial proposal review opening not found")
	ErrDecisionUnavailable = errors.New("trial proposal decision unavailable")
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
