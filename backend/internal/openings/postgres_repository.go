package openings

import (
	"context"
	"errors"

	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/jackc/pgx/v5"
)

type PostgresRepository struct {
	queries *database.Queries
}

func (repository *PostgresRepository) ListOwned(ctx context.Context, userID int64) ([]ManagedOpening, error) {
	rows, err := repository.queries.ListOwnedOpenings(ctx, &userID)
	if err != nil {
		return nil, err
	}
	results := make([]ManagedOpening, 0, len(rows))
	for _, row := range rows {
		results = append(results, managedOpening(
			row.ID, row.Title, row.Summary, row.Skills, row.Role, row.Compensation,
			row.Commitment, row.CommitmentBand, row.Duration, row.Timezone, row.Freshness,
			row.Stage, row.DesiredOutcome, row.FirstMilestone, row.OwnerContribution,
			row.OwnerName, row.OwnerSignal, row.Confidentiality, row.PublicationStatus,
		))
	}
	return results, nil
}

func (repository *PostgresRepository) CreateDraft(ctx context.Context, record draftRecord) (ManagedOpening, error) {
	ownerUserID := record.OwnerUserID
	row, err := repository.queries.CreateOwnedOpening(ctx, database.CreateOwnedOpeningParams{
		ID: record.ID, Title: record.Title, Summary: record.Summary, Skills: record.Skills,
		Role: string(record.Role), Compensation: string(record.Compensation),
		Commitment: record.Commitment, CommitmentBand: string(record.CommitmentBand),
		Duration: record.Duration, Timezone: record.Timezone, Freshness: record.Freshness,
		Stage: record.Stage, DesiredOutcome: record.DesiredOutcome,
		FirstMilestone: record.FirstMilestone, OwnerContribution: record.OwnerContribution,
		OwnerName: record.OwnerName, OwnerSignal: record.OwnerSignal,
		Confidentiality: record.Confidentiality, OwnerUserID: &ownerUserID,
	})
	if err != nil {
		return ManagedOpening{}, err
	}
	return managedOpening(
		row.ID, row.Title, row.Summary, row.Skills, row.Role, row.Compensation,
		row.Commitment, row.CommitmentBand, row.Duration, row.Timezone, row.Freshness,
		row.Stage, row.DesiredOutcome, row.FirstMilestone, row.OwnerContribution,
		row.OwnerName, row.OwnerSignal, row.Confidentiality, row.PublicationStatus,
	), nil
}

func (repository *PostgresRepository) UpdateDraft(ctx context.Context, id string, record draftRecord) (ManagedOpening, error) {
	ownerUserID := record.OwnerUserID
	row, err := repository.queries.UpdateOwnedDraft(ctx, database.UpdateOwnedDraftParams{
		ID: id, Title: record.Title, Summary: record.Summary, Skills: record.Skills,
		Role: string(record.Role), Compensation: string(record.Compensation),
		Commitment: record.Commitment, CommitmentBand: string(record.CommitmentBand),
		Duration: record.Duration, Timezone: record.Timezone,
		DesiredOutcome: record.DesiredOutcome, FirstMilestone: record.FirstMilestone,
		OwnerContribution: record.OwnerContribution, OwnerName: record.OwnerName,
		Confidentiality: record.Confidentiality, OwnerUserID: &ownerUserID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ManagedOpening{}, ErrDraftNotFound
	}
	if err != nil {
		return ManagedOpening{}, err
	}
	return managedOpening(
		row.ID, row.Title, row.Summary, row.Skills, row.Role, row.Compensation,
		row.Commitment, row.CommitmentBand, row.Duration, row.Timezone, row.Freshness,
		row.Stage, row.DesiredOutcome, row.FirstMilestone, row.OwnerContribution,
		row.OwnerName, row.OwnerSignal, row.Confidentiality, row.PublicationStatus,
	), nil
}

func (repository *PostgresRepository) PublishDraft(ctx context.Context, userID int64, id string) (ManagedOpening, error) {
	return repository.transition(ctx, repository.queries.PublishOwnedDraft, database.PublishOwnedDraftParams{
		ID: id, OwnerUserID: &userID,
	})
}

func (repository *PostgresRepository) CloseOpening(ctx context.Context, userID int64, id string) (ManagedOpening, error) {
	row, err := repository.queries.CloseOwnedOpening(ctx, database.CloseOwnedOpeningParams{
		ID: id, OwnerUserID: &userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ManagedOpening{}, ErrTransitionNotFound
	}
	if err != nil {
		return ManagedOpening{}, err
	}
	return managedOpening(
		row.ID, row.Title, row.Summary, row.Skills, row.Role, row.Compensation,
		row.Commitment, row.CommitmentBand, row.Duration, row.Timezone, row.Freshness,
		row.Stage, row.DesiredOutcome, row.FirstMilestone, row.OwnerContribution,
		row.OwnerName, row.OwnerSignal, row.Confidentiality, row.PublicationStatus,
	), nil
}

func (repository *PostgresRepository) transition(
	ctx context.Context,
	operation func(context.Context, database.PublishOwnedDraftParams) (database.PublishOwnedDraftRow, error),
	params database.PublishOwnedDraftParams,
) (ManagedOpening, error) {
	row, err := operation(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return ManagedOpening{}, ErrTransitionNotFound
	}
	if err != nil {
		return ManagedOpening{}, err
	}
	return managedOpening(
		row.ID, row.Title, row.Summary, row.Skills, row.Role, row.Compensation,
		row.Commitment, row.CommitmentBand, row.Duration, row.Timezone, row.Freshness,
		row.Stage, row.DesiredOutcome, row.FirstMilestone, row.OwnerContribution,
		row.OwnerName, row.OwnerSignal, row.Confidentiality, row.PublicationStatus,
	), nil
}

func managedOpening(
	id, title, summary string, skills []string, role, compensation, commitment,
	commitmentBand, duration, timezone, freshness, stage, desiredOutcome,
	firstMilestone, ownerContribution, ownerName, ownerSignal, confidentiality,
	publicationStatus string,
) ManagedOpening {
	return ManagedOpening{
		Opening: Opening{
			ID: id, Title: title, Summary: summary, Skills: skills, Role: Role(role),
			Compensation: Compensation(compensation), Commitment: commitment,
			CommitmentBand: CommitmentBand(commitmentBand), Duration: duration,
			Timezone: timezone, Freshness: freshness, Stage: stage,
			DesiredOutcome: desiredOutcome, FirstMilestone: firstMilestone,
			OwnerContribution: ownerContribution, OwnerName: ownerName,
			OwnerSignal: ownerSignal, Confidentiality: confidentiality,
		},
		PublicationStatus: publicationStatus,
	}
}

func NewPostgresRepository(queries *database.Queries) *PostgresRepository {
	return &PostgresRepository{queries: queries}
}

func (repository *PostgresRepository) List(ctx context.Context, filters Filters) ([]Opening, error) {
	rows, err := repository.queries.ListOpenings(ctx, database.ListOpeningsParams{
		Role:         string(filters.Role),
		Compensation: string(filters.Compensation),
		Commitment:   string(filters.Commitment),
		Query:        filters.Query,
	})
	if err != nil {
		return nil, err
	}

	results := make([]Opening, 0, len(rows))
	for _, row := range rows {
		results = append(results, Opening{
			ID: row.ID, Title: row.Title, Summary: row.Summary, Skills: row.Skills,
			Role: Role(row.Role), Compensation: Compensation(row.Compensation),
			Commitment: row.Commitment, CommitmentBand: CommitmentBand(row.CommitmentBand),
			Duration: row.Duration, Timezone: row.Timezone, Freshness: row.Freshness,
			Stage: row.Stage, DesiredOutcome: row.DesiredOutcome,
			FirstMilestone: row.FirstMilestone, OwnerContribution: row.OwnerContribution,
			OwnerName: row.OwnerName, OwnerSignal: row.OwnerSignal,
			Confidentiality: row.Confidentiality,
		})
	}

	return results, nil
}
