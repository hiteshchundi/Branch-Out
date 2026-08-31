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

func (store *PostgresStore) ListSubmittedForOwner(ctx context.Context, userID int64, openingID string) ([]OwnerApplication, error) {
	if _, err := store.queries.GetOwnedOpeningApplicationReviewScope(ctx, database.GetOwnedOpeningApplicationReviewScopeParams{
		OpeningID: openingID, OwnerUserID: &userID,
	}); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrReviewNotFound
	} else if err != nil {
		return nil, err
	}
	rows, err := store.queries.ListSubmittedApplicationsForOwner(ctx, database.ListSubmittedApplicationsForOwnerParams{
		OpeningID: openingID, OwnerUserID: &userID,
	})
	if err != nil {
		return nil, err
	}
	results := make([]OwnerApplication, 0, len(rows))
	for _, row := range rows {
		application := fromDatabase(database.Application{
			ID: row.ID, OpeningID: row.OpeningID, ApplicantUserID: row.ApplicantUserID,
			Message: row.Message, WorkSampleUrl: row.WorkSampleUrl,
			WorkSampleContext: row.WorkSampleContext, Availability: row.Availability,
			AvailabilityConfirmed: row.AvailabilityConfirmed,
			ProposedContribution:  row.ProposedContribution, Status: row.Status,
			SubmittedAt: row.SubmittedAt, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		})
		results = append(results, OwnerApplication{Application: application, Applicant: ApplicantProof{
			DisplayName: row.ApplicantDisplayName, PrimaryRole: row.ApplicantPrimaryRole,
			Skills: row.ApplicantSkills, GitHubURL: row.ApplicantGithubUrl,
			PortfolioURL: row.ApplicantPortfolioUrl, EvidenceSummary: row.ApplicantEvidenceSummary,
		}})
	}
	return results, nil
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
