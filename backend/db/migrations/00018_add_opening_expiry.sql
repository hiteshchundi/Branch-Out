-- +goose Up
ALTER TABLE project_openings
    ADD COLUMN expires_at TIMESTAMPTZ;

UPDATE project_openings
SET expires_at = published_at + INTERVAL '30 days'
WHERE publication_status IN ('published', 'closed');

ALTER TABLE project_openings
    ADD CONSTRAINT project_openings_expiry_check CHECK (
        (publication_status = 'draft' AND expires_at IS NULL)
        OR (publication_status IN ('published', 'closed') AND expires_at > published_at)
    );

CREATE INDEX project_openings_active_discovery_idx
    ON project_openings (expires_at)
    WHERE publication_status = 'published';

-- +goose Down
DROP INDEX project_openings_active_discovery_idx;
ALTER TABLE project_openings
    DROP CONSTRAINT project_openings_expiry_check,
    DROP COLUMN expires_at;
