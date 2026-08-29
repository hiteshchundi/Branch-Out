// Package profile owns authenticated collaboration profiles and their validation.
package profile

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"
)

var ErrNotFound = errors.New("profile not found")

type FieldError struct {
	Field   string
	Message string
}

func (err *FieldError) Error() string { return err.Message }

type Input struct {
	DisplayName          string   `json:"displayName"`
	PrimaryRole          string   `json:"primaryRole"`
	Bio                  string   `json:"bio"`
	Timezone             string   `json:"timezone"`
	WeeklyAvailability   string   `json:"weeklyAvailability"`
	PreferredDuration    string   `json:"preferredDuration"`
	WorkStyle            string   `json:"workStyle"`
	CommunicationCadence string   `json:"communicationCadence"`
	Skills               []string `json:"skills"`
	PortfolioURL         *string  `json:"portfolioUrl"`
	EvidenceSummary      string   `json:"evidenceSummary"`
}

type Profile struct {
	UserID               int64     `json:"userId"`
	DisplayName          string    `json:"displayName"`
	PrimaryRole          string    `json:"primaryRole"`
	Bio                  string    `json:"bio"`
	Timezone             string    `json:"timezone"`
	WeeklyAvailability   string    `json:"weeklyAvailability"`
	PreferredDuration    string    `json:"preferredDuration"`
	WorkStyle            string    `json:"workStyle"`
	CommunicationCadence string    `json:"communicationCadence"`
	Skills               []string  `json:"skills"`
	GitHubURL            string    `json:"githubUrl"`
	PortfolioURL         *string   `json:"portfolioUrl"`
	EvidenceSummary      string    `json:"evidenceSummary"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

type Store interface {
	Get(context.Context, int64) (Profile, error)
	Save(context.Context, int64, Input) (Profile, error)
}

type Service struct{ store Store }

func NewService(store Store) *Service { return &Service{store: store} }

func (service *Service) Get(ctx context.Context, userID int64) (Profile, error) {
	return service.store.Get(ctx, userID)
}

func (service *Service) Save(ctx context.Context, userID int64, input Input) (Profile, error) {
	normalized, err := normalizeAndValidate(input)
	if err != nil {
		return Profile{}, err
	}
	return service.store.Save(ctx, userID, normalized)
}

var allowedValues = map[string]map[string]bool{
	"primaryRole": {
		"Software developer": true, "Product designer": true, "UX researcher": true, "Product builder": true,
	},
	"weeklyAvailability": {
		"Under 6 hrs/week": true, "6–8 hrs/week": true, "8–12 hrs/week": true, "12+ hrs/week": true,
	},
	"preferredDuration": {
		"2–4 weeks": true, "5–8 weeks": true, "2–3 months": true,
	},
	"workStyle": {
		"Async-first": true, "Balanced async and live": true, "Live collaboration preferred": true,
	},
	"communicationCadence": {
		"Daily async update": true, "Three updates per week": true, "Weekly planning and demo": true,
	},
}

func normalizeAndValidate(input Input) (Input, error) {
	input.DisplayName = strings.TrimSpace(input.DisplayName)
	input.PrimaryRole = strings.TrimSpace(input.PrimaryRole)
	input.Bio = strings.TrimSpace(input.Bio)
	input.Timezone = strings.TrimSpace(input.Timezone)
	input.WeeklyAvailability = strings.TrimSpace(input.WeeklyAvailability)
	input.PreferredDuration = strings.TrimSpace(input.PreferredDuration)
	input.WorkStyle = strings.TrimSpace(input.WorkStyle)
	input.CommunicationCadence = strings.TrimSpace(input.CommunicationCadence)
	input.EvidenceSummary = strings.TrimSpace(input.EvidenceSummary)

	for _, check := range []struct {
		field, value     string
		minimum, maximum int
	}{
		{"displayName", input.DisplayName, 1, 100},
		{"bio", input.Bio, 40, 500},
		{"timezone", input.Timezone, 1, 50},
		{"evidenceSummary", input.EvidenceSummary, 20, 500},
	} {
		if len([]rune(check.value)) < check.minimum || len([]rune(check.value)) > check.maximum {
			return Input{}, &FieldError{Field: check.field, Message: check.field + " has an invalid length"}
		}
	}
	for _, check := range []struct{ field, value string }{
		{"primaryRole", input.PrimaryRole},
		{"weeklyAvailability", input.WeeklyAvailability},
		{"preferredDuration", input.PreferredDuration},
		{"workStyle", input.WorkStyle},
		{"communicationCadence", input.CommunicationCadence},
	} {
		if !allowedValues[check.field][check.value] {
			return Input{}, &FieldError{Field: check.field, Message: check.field + " is not supported"}
		}
	}

	if len(input.Skills) < 1 || len(input.Skills) > 10 {
		return Input{}, &FieldError{Field: "skills", Message: "skills must contain between 1 and 10 items"}
	}
	seenSkills := make(map[string]bool, len(input.Skills))
	normalizedSkills := make([]string, 0, len(input.Skills))
	for _, skill := range input.Skills {
		skill = strings.TrimSpace(skill)
		key := strings.ToLower(skill)
		if len([]rune(skill)) < 1 || len([]rune(skill)) > 40 || seenSkills[key] {
			return Input{}, &FieldError{Field: "skills", Message: "skills must be unique and contain 1 to 40 characters"}
		}
		seenSkills[key] = true
		normalizedSkills = append(normalizedSkills, skill)
	}
	input.Skills = normalizedSkills

	if input.PortfolioURL != nil {
		value := strings.TrimSpace(*input.PortfolioURL)
		if value == "" {
			input.PortfolioURL = nil
		} else {
			parsed, err := url.Parse(value)
			if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil {
				return Input{}, &FieldError{Field: "portfolioUrl", Message: "portfolioUrl must be a complete HTTP or HTTPS URL"}
			}
			input.PortfolioURL = &value
		}
	}
	return input, nil
}
