package openings

import "context"

type MemoryRepository struct {
	openings []Opening
}

func NewMemoryRepository(seed []Opening) *MemoryRepository {
	openingsCopy := append([]Opening(nil), seed...)
	return &MemoryRepository{openings: openingsCopy}
}

func (repository *MemoryRepository) List(ctx context.Context, filters Filters) ([]Opening, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	matches := make([]Opening, 0, len(repository.openings))
	for _, opening := range repository.openings {
		if Matches(opening, filters) {
			matches = append(matches, opening)
		}
	}

	return matches, nil
}
