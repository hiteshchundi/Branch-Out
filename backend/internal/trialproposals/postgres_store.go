package trialproposals

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

func (store *PostgresStore) GetOwn(ctx context.Context, userID int64, openingID string) (Proposal, error) {
	row, err := store.queries.GetOwnTrialProposal(ctx, database.GetOwnTrialProposalParams{
		OpeningID: openingID, ApplicantUserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Proposal{}, ErrNotFound
	}
	if err != nil {
		return Proposal{}, err
	}
	return fromDatabase(row), nil
}

func (store *PostgresStore) UpsertOwnDraft(ctx context.Context, record Record) (Proposal, error) {
	startDate, _ := time.Parse("2006-01-02", record.Input.StartDate)
	endDate, _ := time.Parse("2006-01-02", record.Input.EndDate)
	row, err := store.queries.UpsertOwnTrialProposalDraft(ctx, database.UpsertOwnTrialProposalDraftParams{
		ID: record.ID, OpeningID: record.OpeningID, ApplicantUserID: record.ApplicantUserID,
		Outcome: record.Input.Outcome, Deliverable: record.Input.Deliverable,
		NonGoals: record.Input.NonGoals, StartDate: pgtype.Date{Time: startDate, Valid: true},
		EndDate: pgtype.Date{Time: endDate, Valid: true}, WeeklyHours: record.Input.WeeklyHours,
		CheckInCadence: record.Input.CheckInCadence, AccessLevel: record.Input.AccessLevel,
		Confidentiality: record.Input.Confidentiality, IpOwnership: record.Input.IPOwnership,
		ExitPlan: record.Input.ExitPlan, TermsConfirmed: record.Input.TermsConfirmed,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Proposal{}, ErrUnavailable
	}
	if err != nil {
		return Proposal{}, err
	}
	return fromDatabase(row), nil
}

func fromDatabase(row database.TrialProposal) Proposal {
	return Proposal{
		ID: row.ID, ApplicationID: row.ApplicationID, OpeningID: row.OpeningID,
		Input: Input{
			Outcome: row.Outcome, Deliverable: row.Deliverable, NonGoals: row.NonGoals,
			StartDate: row.StartDate.Time.Format("2006-01-02"), EndDate: row.EndDate.Time.Format("2006-01-02"),
			WeeklyHours: row.WeeklyHours, CheckInCadence: row.CheckInCadence,
			AccessLevel: row.AccessLevel, Confidentiality: row.Confidentiality,
			IPOwnership: row.IpOwnership, ExitPlan: row.ExitPlan, TermsConfirmed: row.TermsConfirmed,
		},
		Status: row.ProposalStatus, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}
