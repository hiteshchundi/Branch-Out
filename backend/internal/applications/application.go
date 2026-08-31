// Package applications owns private application drafts and explicit submission.
package applications

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

	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

var (
	ErrNotFound    = errors.New("application not found")
	ErrUnavailable = errors.New("application unavailable")
)

type FieldError struct {
	Field   string
	Message string
}

func (err *FieldError) Error() string { return err.Message }

type Input struct {
	Message               string `json:"message"`
	WorkSampleURL         string `json:"workSampleUrl"`
	WorkSampleContext     string `json:"workSampleContext"`
	Availability          string `json:"availability"`
	AvailabilityConfirmed bool   `json:"availabilityConfirmed"`
	ProposedContribution  string `json:"proposedContribution"`
}

type Application struct {
	ID          string     `json:"id"`
	OpeningID   string     `json:"openingId"`
	Input       Input      `json:"input"`
	Status      string     `json:"status"`
	SubmittedAt *time.Time `json:"submittedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type Record struct {
	Application
	ApplicantUserID int64
}

type Store interface {
	GetOwn(context.Context, int64, string) (Application, error)
	UpsertDraft(context.Context, Record) (Application, error)
	Submit(context.Context, int64, string) (Application, error)
}

type ProfileLookup interface {
	Get(context.Context, int64) (profile.Profile, error)
}

type Manager struct {
	store    Store
	profiles ProfileLookup
	random   io.Reader
}

func NewManager(store Store, profiles ProfileLookup) *Manager {
	return &Manager{store: store, profiles: profiles, random: rand.Reader}
}

func (manager *Manager) GetOwn(ctx context.Context, userID int64, openingID string) (Application, error) {
	if strings.TrimSpace(openingID) == "" {
		return Application{}, ErrNotFound
	}
	return manager.store.GetOwn(ctx, userID, openingID)
}

func (manager *Manager) SaveDraft(ctx context.Context, userID int64, openingID string, input Input) (Application, error) {
	openingID = strings.TrimSpace(openingID)
	if openingID == "" {
		return Application{}, ErrUnavailable
	}
	normalized, err := normalizeInput(input)
	if err != nil {
		return Application{}, err
	}
	if _, err := manager.profiles.Get(ctx, userID); err != nil {
		return Application{}, err
	}
	id, err := randomID(manager.random)
	if err != nil {
		return Application{}, fmt.Errorf("generate application ID: %w", err)
	}
	return manager.store.UpsertDraft(ctx, Record{
		Application:     Application{ID: id, OpeningID: openingID, Input: normalized, Status: "draft"},
		ApplicantUserID: userID,
	})
}

func (manager *Manager) Submit(ctx context.Context, userID int64, openingID string) (Application, error) {
	if strings.TrimSpace(openingID) == "" {
		return Application{}, ErrUnavailable
	}
	return manager.store.Submit(ctx, userID, openingID)
}

func normalizeInput(input Input) (Input, error) {
	input.Message = strings.TrimSpace(input.Message)
	input.WorkSampleURL = strings.TrimSpace(input.WorkSampleURL)
	input.WorkSampleContext = strings.TrimSpace(input.WorkSampleContext)
	input.Availability = strings.TrimSpace(input.Availability)
	input.ProposedContribution = strings.TrimSpace(input.ProposedContribution)

	for _, check := range []struct {
		field, value     string
		minimum, maximum int
	}{
		{"message", input.Message, 30, 1000},
		{"workSampleContext", input.WorkSampleContext, 20, 500},
		{"availability", input.Availability, 3, 160},
		{"proposedContribution", input.ProposedContribution, 20, 500},
	} {
		length := len([]rune(check.value))
		if length < check.minimum || length > check.maximum {
			return Input{}, &FieldError{Field: check.field, Message: check.field + " has an invalid length"}
		}
	}
	parsedURL, err := url.Parse(input.WorkSampleURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" || len(input.WorkSampleURL) > 2048 {
		return Input{}, &FieldError{Field: "workSampleUrl", Message: "workSampleUrl must be a complete HTTP or HTTPS URL"}
	}
	if !input.AvailabilityConfirmed {
		return Input{}, &FieldError{Field: "availabilityConfirmed", Message: "availability must be confirmed"}
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
