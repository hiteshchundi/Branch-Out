package openings

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

var (
	ErrDraftNotFound      = errors.New("opening draft not found")
	ErrTransitionNotFound = errors.New("opening transition not found")
)

type DraftFieldError struct {
	Field   string
	Message string
}

func (err *DraftFieldError) Error() string { return err.Message }

type DraftInput struct {
	ProjectName       string   `json:"projectName"`
	Problem           string   `json:"problem"`
	Role              string   `json:"role"`
	Skills            []string `json:"skills"`
	Commitment        string   `json:"commitment"`
	Duration          string   `json:"duration"`
	Timezone          string   `json:"timezone"`
	Compensation      string   `json:"compensation"`
	FirstMilestone    string   `json:"firstMilestone"`
	OwnerContribution string   `json:"ownerContribution"`
	Confidentiality   string   `json:"confidentiality"`
}

type ManagedOpening struct {
	Opening
	PublicationStatus string `json:"publicationStatus"`
}

type draftRecord struct {
	Opening
	OwnerUserID int64
}

type DraftStore interface {
	ListOwned(context.Context, int64) ([]ManagedOpening, error)
	CreateDraft(context.Context, draftRecord) (ManagedOpening, error)
	UpdateDraft(context.Context, string, draftRecord) (ManagedOpening, error)
	PublishDraft(context.Context, int64, string) (ManagedOpening, error)
	CloseOpening(context.Context, int64, string) (ManagedOpening, error)
}

type OwnerProfileLookup interface {
	Get(context.Context, int64) (profile.Profile, error)
}

type Manager struct {
	store    DraftStore
	profiles OwnerProfileLookup
	random   io.Reader
}

func NewManager(store DraftStore, profiles OwnerProfileLookup) *Manager {
	return &Manager{store: store, profiles: profiles, random: rand.Reader}
}

func (manager *Manager) ListOwned(ctx context.Context, userID int64) ([]ManagedOpening, error) {
	return manager.store.ListOwned(ctx, userID)
}

func (manager *Manager) CreateDraft(ctx context.Context, userID int64, input DraftInput) (ManagedOpening, error) {
	record, err := manager.buildRecord(ctx, userID, input)
	if err != nil {
		return ManagedOpening{}, err
	}
	record.ID, err = randomID(manager.random)
	if err != nil {
		return ManagedOpening{}, fmt.Errorf("generate opening ID: %w", err)
	}
	return manager.store.CreateDraft(ctx, record)
}

func (manager *Manager) UpdateDraft(ctx context.Context, userID int64, id string, input DraftInput) (ManagedOpening, error) {
	if strings.TrimSpace(id) == "" {
		return ManagedOpening{}, ErrDraftNotFound
	}
	record, err := manager.buildRecord(ctx, userID, input)
	if err != nil {
		return ManagedOpening{}, err
	}
	return manager.store.UpdateDraft(ctx, id, record)
}

func (manager *Manager) PublishDraft(ctx context.Context, userID int64, id string) (ManagedOpening, error) {
	if strings.TrimSpace(id) == "" {
		return ManagedOpening{}, ErrTransitionNotFound
	}
	return manager.store.PublishDraft(ctx, userID, id)
}

func (manager *Manager) CloseOpening(ctx context.Context, userID int64, id string) (ManagedOpening, error) {
	if strings.TrimSpace(id) == "" {
		return ManagedOpening{}, ErrTransitionNotFound
	}
	return manager.store.CloseOpening(ctx, userID, id)
}

func (manager *Manager) buildRecord(ctx context.Context, userID int64, input DraftInput) (draftRecord, error) {
	normalized, err := normalizeDraftInput(input)
	if err != nil {
		return draftRecord{}, err
	}
	owner, err := manager.profiles.Get(ctx, userID)
	if err != nil {
		return draftRecord{}, err
	}
	role, roleTitle := roleDetails(normalized.Role)
	compensation := compensationValue(normalized.Compensation)
	return draftRecord{
		OwnerUserID: userID,
		Opening: Opening{
			Title:   roleTitle + " for " + normalized.ProjectName,
			Summary: normalized.Problem, Skills: normalized.Skills, Role: role,
			Compensation: compensation, Commitment: normalized.Commitment,
			CommitmentBand: CommitmentBand(normalized.Commitment), Duration: normalized.Duration,
			Timezone: normalized.Timezone, Freshness: "Draft · not published", Stage: "Owner draft",
			DesiredOutcome: normalized.Problem, FirstMilestone: normalized.FirstMilestone,
			OwnerContribution: normalized.OwnerContribution, OwnerName: owner.DisplayName,
			OwnerSignal:     "GitHub verified · Profile complete",
			Confidentiality: confidentialityDescription(normalized.Confidentiality),
		},
	}, nil
}

var allowedDraftValues = map[string]map[string]bool{
	"role":            {"Frontend engineer": true, "Backend engineer": true, "Product designer": true, "UX researcher": true},
	"commitment":      {"Under 6 hrs/week": true, "6–8 hrs/week": true, "8+ hrs/week": true},
	"duration":        {"2–4 weeks": true, "5–8 weeks": true, "2–3 months": true},
	"compensation":    {"Paid": true, "Fixed bounty": true, "Revenue share": true, "Unpaid / portfolio": true},
	"confidentiality": {"Public": true, "Limited details": true, "Confidential after agreement": true},
}

func normalizeDraftInput(input DraftInput) (DraftInput, error) {
	input.ProjectName = strings.TrimSpace(input.ProjectName)
	input.Problem = strings.TrimSpace(input.Problem)
	input.Role = strings.TrimSpace(input.Role)
	input.Commitment = strings.TrimSpace(input.Commitment)
	input.Duration = strings.TrimSpace(input.Duration)
	input.Timezone = strings.TrimSpace(input.Timezone)
	input.Compensation = strings.TrimSpace(input.Compensation)
	input.FirstMilestone = strings.TrimSpace(input.FirstMilestone)
	input.OwnerContribution = strings.TrimSpace(input.OwnerContribution)
	input.Confidentiality = strings.TrimSpace(input.Confidentiality)

	for _, check := range []struct {
		field, value     string
		minimum, maximum int
	}{
		{"projectName", input.ProjectName, 3, 80}, {"problem", input.Problem, 20, 240},
		{"timezone", input.Timezone, 3, 80}, {"firstMilestone", input.FirstMilestone, 20, 500},
		{"ownerContribution", input.OwnerContribution, 20, 500},
	} {
		length := len([]rune(check.value))
		if length < check.minimum || length > check.maximum {
			return DraftInput{}, &DraftFieldError{Field: check.field, Message: check.field + " has an invalid length"}
		}
	}
	for _, check := range []struct{ field, value string }{
		{"role", input.Role}, {"commitment", input.Commitment}, {"duration", input.Duration},
		{"compensation", input.Compensation}, {"confidentiality", input.Confidentiality},
	} {
		if !allowedDraftValues[check.field][check.value] {
			return DraftInput{}, &DraftFieldError{Field: check.field, Message: check.field + " is not supported"}
		}
	}
	if len(input.Skills) < 1 || len(input.Skills) > 12 {
		return DraftInput{}, &DraftFieldError{Field: "skills", Message: "skills must contain between 1 and 12 items"}
	}
	seen := make(map[string]bool, len(input.Skills))
	for index, skill := range input.Skills {
		skill = strings.TrimSpace(skill)
		key := strings.ToLower(skill)
		if len([]rune(skill)) < 1 || len([]rune(skill)) > 40 || seen[key] {
			return DraftInput{}, &DraftFieldError{Field: "skills", Message: "skills must be unique and contain 1 to 40 characters"}
		}
		seen[key] = true
		input.Skills[index] = skill
	}
	return input, nil
}

func roleDetails(value string) (Role, string) {
	switch value {
	case "Product designer":
		return RoleDesign, value
	case "UX researcher":
		return RoleResearch, value
	default:
		return RoleEngineering, value
	}
}

func compensationValue(value string) Compensation {
	if value == "Unpaid / portfolio" {
		return CompensationPortfolio
	}
	return Compensation(value)
}

func confidentialityDescription(value string) string {
	switch value {
	case "Public":
		return "Public project details; no private credentials or client-confidential material."
	case "Limited details":
		return "Limited public details; additional context is shared only after owner review."
	default:
		return "Confidential details are shared only after an explicit agreement and minimum access review."
	}
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
