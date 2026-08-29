package profile

import (
	"context"
	"errors"

	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/jackc/pgx/v5"
)

type PostgresStore struct{ queries *database.Queries }

func NewPostgresStore(queries *database.Queries) *PostgresStore {
	return &PostgresStore{queries: queries}
}

func (store *PostgresStore) Get(ctx context.Context, userID int64) (Profile, error) {
	row, err := store.queries.GetProfile(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Profile{}, ErrNotFound
	}
	if err != nil {
		return Profile{}, err
	}
	return Profile{
		UserID: row.UserID, DisplayName: row.DisplayName, PrimaryRole: row.PrimaryRole,
		Bio: row.Bio, Timezone: row.Timezone, WeeklyAvailability: row.WeeklyAvailability,
		PreferredDuration: row.PreferredDuration, WorkStyle: row.WorkStyle,
		CommunicationCadence: row.CommunicationCadence, Skills: row.Skills,
		GitHubURL: row.GithubUrl, PortfolioURL: row.PortfolioUrl,
		EvidenceSummary: row.EvidenceSummary, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}, nil
}

func (store *PostgresStore) Save(ctx context.Context, userID int64, input Input) (Profile, error) {
	row, err := store.queries.UpsertProfile(ctx, database.UpsertProfileParams{
		UserID: userID, DisplayName: input.DisplayName, PrimaryRole: input.PrimaryRole,
		Bio: input.Bio, Timezone: input.Timezone, WeeklyAvailability: input.WeeklyAvailability,
		PreferredDuration: input.PreferredDuration, WorkStyle: input.WorkStyle,
		CommunicationCadence: input.CommunicationCadence, Skills: input.Skills,
		PortfolioUrl: input.PortfolioURL, EvidenceSummary: input.EvidenceSummary,
	})
	if err != nil {
		return Profile{}, err
	}
	return Profile{
		UserID: row.UserID, DisplayName: row.DisplayName, PrimaryRole: row.PrimaryRole,
		Bio: row.Bio, Timezone: row.Timezone, WeeklyAvailability: row.WeeklyAvailability,
		PreferredDuration: row.PreferredDuration, WorkStyle: row.WorkStyle,
		CommunicationCadence: row.CommunicationCadence, Skills: row.Skills,
		GitHubURL: row.GithubUrl, PortfolioURL: row.PortfolioUrl,
		EvidenceSummary: row.EvidenceSummary, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}, nil
}
