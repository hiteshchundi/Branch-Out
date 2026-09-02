package safety

import (
	"context"
	"errors"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type PostgresStore struct{ queries *database.Queries }

func NewPostgresStore(queries *database.Queries) *PostgresStore {
	return &PostgresStore{queries: queries}
}

func (store *PostgresStore) Create(ctx context.Context, record Record) (Report, error) {
	if record.Input.TargetKind == "trial_feedback" {
		row, err := store.queries.CreateTrialFeedbackSafetyReport(ctx, database.CreateTrialFeedbackSafetyReportParams{
			TargetID: record.Input.TargetID, ReporterUserID: record.ReporterUserID, ID: record.ID,
			Category: record.Input.Category, Details: record.Input.Details,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return Report{}, ErrReportUnavailable
		}
		if err != nil {
			return Report{}, err
		}
		return fromValues(row.ID, row.TargetKind, row.TargetID, row.Category, row.Details, row.TargetSnapshot, row.ReportStatus, row.ReporterGithubLogin, row.ModeratorNotes, row.CreatedAt, row.DecidedAt), nil
	}
	row, err := store.queries.CreateTrustCandidateSafetyReport(ctx, database.CreateTrustCandidateSafetyReportParams{
		TargetID: record.Input.TargetID, ReporterUserID: record.ReporterUserID, ID: record.ID,
		Category: record.Input.Category, Details: record.Input.Details,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Report{}, ErrReportUnavailable
	}
	if err != nil {
		return Report{}, err
	}
	return fromValues(row.ID, row.TargetKind, row.TargetID, row.Category, row.Details, row.TargetSnapshot, row.ReportStatus, row.ReporterGithubLogin, row.ModeratorNotes, row.CreatedAt, row.DecidedAt), nil
}

func (store *PostgresStore) ListForModerator(ctx context.Context, moderatorUserID int64) ([]Report, error) {
	if _, err := store.queries.GetModeratorSafetyScope(ctx, moderatorUserID); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrModeratorForbidden
	} else if err != nil {
		return nil, err
	}
	rows, err := store.queries.ListSafetyReportsForModerator(ctx, moderatorUserID)
	if err != nil {
		return nil, err
	}
	results := make([]Report, 0, len(rows))
	for _, row := range rows {
		results = append(results, fromValues(row.ID, row.TargetKind, row.TargetID, row.Category, row.Details, row.TargetSnapshot, row.ReportStatus, row.ReporterGithubLogin, row.ModeratorNotes, row.CreatedAt, row.DecidedAt))
	}
	return results, nil
}

func (store *PostgresStore) Decide(ctx context.Context, moderatorUserID int64, reportID string, input DecisionInput) (Report, error) {
	if _, err := store.queries.GetModeratorSafetyScope(ctx, moderatorUserID); errors.Is(err, pgx.ErrNoRows) {
		return Report{}, ErrModeratorForbidden
	} else if err != nil {
		return Report{}, err
	}
	row, err := store.queries.DecideSafetyReportForModerator(ctx, database.DecideSafetyReportForModeratorParams{
		Decision: input.Decision, ModeratorUserID: &moderatorUserID,
		ModeratorNotes: &input.ModeratorNotes, ReportID: reportID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Report{}, ErrDecisionUnavailable
	}
	if err != nil {
		return Report{}, err
	}
	return fromValues(row.ID, row.TargetKind, row.TargetID, row.Category, row.Details, row.TargetSnapshot, row.ReportStatus, row.ReporterGithubLogin, row.ModeratorNotes, row.CreatedAt, row.DecidedAt), nil
}

func fromValues(id, targetKind, targetID, category, details string, snapshot []byte, status, reporterLogin string, notes *string, createdAt time.Time, decidedValue pgtype.Timestamptz) Report {
	var decidedAt *time.Time
	if decidedValue.Valid {
		value := decidedValue.Time
		decidedAt = &value
	}
	return Report{
		ID: id, TargetKind: targetKind, TargetID: targetID, Category: category,
		Details: details, TargetSnapshot: snapshot, Status: status,
		Reporter: Reporter{GitHubLogin: reporterLogin}, ModeratorNotes: notes,
		CreatedAt: createdAt, DecidedAt: decidedAt,
	}
}
