package applications

import (
	"context"
	"errors"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/jackc/pgx/v5"
)

type PostgresStore struct {
	queries *database.Queries
}

func NewPostgresStore(queries *database.Queries) *PostgresStore {
	return &PostgresStore{queries: queries}
}

func (store *PostgresStore) GetOwn(ctx context.Context, userID int64, openingID string) (Application, error) {
	row, err := store.queries.GetOwnApplication(ctx, database.GetOwnApplicationParams{
		OpeningID: openingID, ApplicantUserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Application{}, ErrNotFound
	}
	if err != nil {
		return Application{}, err
	}
	return fromDatabase(row), nil
}

func (store *PostgresStore) UpsertDraft(ctx context.Context, record Record) (Application, error) {
	row, err := store.queries.UpsertApplicationDraft(ctx, database.UpsertApplicationDraftParams{
		ID: record.ID, OpeningID: record.OpeningID, ApplicantUserID: record.ApplicantUserID,
		Message: record.Input.Message, WorkSampleUrl: record.Input.WorkSampleURL,
		WorkSampleContext: record.Input.WorkSampleContext, Availability: record.Input.Availability,
		AvailabilityConfirmed: record.Input.AvailabilityConfirmed,
		ProposedContribution:  record.Input.ProposedContribution,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Application{}, ErrUnavailable
	}
	if err != nil {
		return Application{}, err
	}
	return fromDatabase(row), nil
}

func (store *PostgresStore) Submit(ctx context.Context, userID int64, openingID string) (Application, error) {
	row, err := store.queries.SubmitOwnApplication(ctx, database.SubmitOwnApplicationParams{
		OpeningID: openingID, ApplicantUserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Application{}, ErrUnavailable
	}
	if err != nil {
		return Application{}, err
	}
	return fromDatabase(row), nil
}

func fromDatabase(row database.Application) Application {
	var submittedAt *time.Time
	if row.SubmittedAt.Valid {
		value := row.SubmittedAt.Time
		submittedAt = &value
	}
	return Application{
		ID: row.ID, OpeningID: row.OpeningID,
		Input: Input{
			Message: row.Message, WorkSampleURL: row.WorkSampleUrl,
			WorkSampleContext: row.WorkSampleContext, Availability: row.Availability,
			AvailabilityConfirmed: row.AvailabilityConfirmed,
			ProposedContribution:  row.ProposedContribution,
		},
		Status: row.Status, SubmittedAt: submittedAt,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}
