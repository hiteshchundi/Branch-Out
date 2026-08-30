-- +goose Up
ALTER TABLE project_openings
    ADD COLUMN published_at TIMESTAMPTZ,
    ADD COLUMN closed_at TIMESTAMPTZ;

UPDATE project_openings
SET published_at = updated_at
WHERE publication_status = 'published';

UPDATE project_openings
SET published_at = updated_at,
    closed_at = updated_at
WHERE publication_status = 'closed';

ALTER TABLE project_openings
    ADD CONSTRAINT project_openings_lifecycle_timestamps_check CHECK (
        (publication_status = 'draft' AND published_at IS NULL AND closed_at IS NULL)
        OR (publication_status = 'published' AND published_at IS NOT NULL AND closed_at IS NULL)
        OR (publication_status = 'closed' AND published_at IS NOT NULL AND closed_at IS NOT NULL)
    );

-- +goose Down
ALTER TABLE project_openings
    DROP CONSTRAINT project_openings_lifecycle_timestamps_check,
    DROP COLUMN closed_at,
    DROP COLUMN published_at;
