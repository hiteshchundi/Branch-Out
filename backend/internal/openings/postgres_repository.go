package openings

import (
	"context"

	"github.com/hiteshchundi/branch-out/backend/internal/database"
)

type PostgresRepository struct {
	queries *database.Queries
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
