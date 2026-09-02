// Package safety owns participant reports and moderator-only review decisions.
package safety

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
)

var (
	ErrReportUnavailable   = errors.New("safety report unavailable")
	ErrModeratorForbidden  = errors.New("moderator access forbidden")
	ErrDecisionUnavailable = errors.New("safety report decision unavailable")
)

type FieldError struct{ Field, Message string }

func (err *FieldError) Error() string { return err.Message }

type Input struct {
	TargetKind string `json:"targetKind"`
	TargetID   string `json:"targetId"`
	Category   string `json:"category"`
	Details    string `json:"details"`
}

type DecisionInput struct {
	Decision       string `json:"decision"`
	ModeratorNotes string `json:"moderatorNotes"`
}

type Reporter struct {
	GitHubLogin string `json:"githubLogin"`
}

type Report struct {
	ID             string          `json:"id"`
	TargetKind     string          `json:"targetKind"`
	TargetID       string          `json:"targetId"`
	Category       string          `json:"category"`
	Details        string          `json:"details"`
	TargetSnapshot json.RawMessage `json:"targetSnapshot"`
	Status         string          `json:"status"`
	Reporter       Reporter        `json:"reporter"`
	ModeratorNotes *string         `json:"moderatorNotes"`
	CreatedAt      time.Time       `json:"createdAt"`
	DecidedAt      *time.Time      `json:"decidedAt"`
}

type Record struct {
	ID             string
	ReporterUserID int64
	Input          Input
}

type Store interface {
	Create(context.Context, Record) (Report, error)
	ListForModerator(context.Context, int64) ([]Report, error)
	Decide(context.Context, int64, string, DecisionInput) (Report, error)
}

type Manager struct {
	store  Store
	random io.Reader
}

func NewManager(store Store) *Manager { return &Manager{store: store, random: rand.Reader} }

func (manager *Manager) Create(ctx context.Context, reporterUserID int64, input Input) (Report, error) {
	normalized, err := normalizeInput(input)
	if err != nil {
		return Report{}, err
	}
	id, err := randomID(manager.random)
	if err != nil {
		return Report{}, fmt.Errorf("generate safety report ID: %w", err)
	}
	return manager.store.Create(ctx, Record{ID: id, ReporterUserID: reporterUserID, Input: normalized})
}

func (manager *Manager) ListForModerator(ctx context.Context, moderatorUserID int64) ([]Report, error) {
	return manager.store.ListForModerator(ctx, moderatorUserID)
}

func (manager *Manager) Decide(ctx context.Context, moderatorUserID int64, reportID string, input DecisionInput) (Report, error) {
	reportID = strings.TrimSpace(reportID)
	input.Decision = strings.TrimSpace(input.Decision)
	input.ModeratorNotes = strings.TrimSpace(input.ModeratorNotes)
	if reportID == "" || (input.Decision != "upheld" && input.Decision != "dismissed") {
		return Report{}, ErrDecisionUnavailable
	}
	if length := len([]rune(input.ModeratorNotes)); length < 20 || length > 1000 {
		return Report{}, &FieldError{Field: "moderatorNotes", Message: "moderatorNotes has an invalid length"}
	}
	return manager.store.Decide(ctx, moderatorUserID, reportID, input)
}

func normalizeInput(input Input) (Input, error) {
	input.TargetKind = strings.TrimSpace(input.TargetKind)
	input.TargetID = strings.TrimSpace(input.TargetID)
	input.Category = strings.TrimSpace(input.Category)
	input.Details = strings.TrimSpace(input.Details)
	if input.TargetKind != "trial_feedback" && input.TargetKind != "trust_candidate" {
		return Input{}, &FieldError{Field: "targetKind", Message: "targetKind is unsupported"}
	}
	if length := len(input.TargetID); length < 1 || length > 100 {
		return Input{}, &FieldError{Field: "targetId", Message: "targetId has an invalid length"}
	}
	if input.Category != "harassment" && input.Category != "privacy" && input.Category != "fraud" && input.Category != "spam" && input.Category != "other" {
		return Input{}, &FieldError{Field: "category", Message: "category is unsupported"}
	}
	if length := len([]rune(input.Details)); length < 30 || length > 1000 {
		return Input{}, &FieldError{Field: "details", Message: "details has an invalid length"}
	}
	return input, nil
}

func randomID(source io.Reader) (string, error) {
	buffer := make([]byte, 16)
	if _, err := io.ReadFull(source, buffer); err != nil {
		return "", err
	}
	buffer[6] = (buffer[6] & 0x0f) | 0x40
	buffer[8] = (buffer[8] & 0x3f) | 0x80
	encoded := hex.EncodeToString(buffer)
	return encoded[0:8] + "-" + encoded[8:12] + "-" + encoded[12:16] + "-" + encoded[16:20] + "-" + encoded[20:32], nil
}
