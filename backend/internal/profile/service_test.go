package profile

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

func validInput() Input {
	portfolio := "https://asha.example/work"
	return Input{
		DisplayName: "Asha Rao", PrimaryRole: "Software developer",
		Bio:      "I build accessible data products and enjoy small teams with clear ownership.",
		Timezone: "UTC+5:30", WeeklyAvailability: "6–8 hrs/week",
		PreferredDuration: "5–8 weeks", WorkStyle: "Async-first",
		CommunicationCadence: "Three updates per week",
		Skills:               []string{"TypeScript", "React", "Accessibility"}, PortfolioURL: &portfolio,
		EvidenceSummary: "The linked work shows interfaces and tests I personally delivered.",
	}
}

func TestServiceNormalizesAndSavesProfile(t *testing.T) {
	store := &fakeStore{saved: Profile{UserID: 7}}
	service := NewService(store)
	input := validInput()
	input.DisplayName = "  Asha Rao  "
	input.Skills = []string{" TypeScript ", "React"}

	result, err := service.Save(context.Background(), 7, input)
	if err != nil || result.UserID != 7 {
		t.Fatalf("Save() = %#v, %v", result, err)
	}
	if store.userID != 7 || store.input.DisplayName != "Asha Rao" || !reflect.DeepEqual(store.input.Skills, []string{"TypeScript", "React"}) {
		t.Fatalf("normalized save = user %d, input %#v", store.userID, store.input)
	}
}

func TestServiceRejectsInvalidProfileFields(t *testing.T) {
	tests := []struct {
		name, field string
		mutate      func(*Input)
	}{
		{"short bio", "bio", func(input *Input) { input.Bio = "Too short" }},
		{"unknown role", "primaryRole", func(input *Input) { input.PrimaryRole = "Wizard" }},
		{"duplicate skills", "skills", func(input *Input) { input.Skills = []string{"React", "react"} }},
		{"unsafe portfolio", "portfolioUrl", func(input *Input) { value := "javascript:alert(1)"; input.PortfolioURL = &value }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := validInput()
			test.mutate(&input)
			_, err := NewService(&fakeStore{}).Save(context.Background(), 1, input)
			var fieldError *FieldError
			if !errors.As(err, &fieldError) || fieldError.Field != test.field {
				t.Fatalf("error = %#v, want field %q", err, test.field)
			}
		})
	}
}

type fakeStore struct {
	userID int64
	input  Input
	saved  Profile
	err    error
}

func (store *fakeStore) Get(context.Context, int64) (Profile, error) { return store.saved, store.err }
func (store *fakeStore) Save(_ context.Context, userID int64, input Input) (Profile, error) {
	store.userID, store.input = userID, input
	return store.saved, store.err
}
