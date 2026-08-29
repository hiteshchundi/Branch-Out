-- +goose Up
ALTER TABLE project_openings
    ADD COLUMN owner_user_id BIGINT REFERENCES users (id) ON DELETE RESTRICT,
    ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'published'
        CHECK (publication_status IN ('draft', 'published', 'closed'));

CREATE INDEX project_openings_owner_idx
    ON project_openings (owner_user_id, publication_status, updated_at DESC);

-- +goose Down
DROP INDEX project_openings_owner_idx;
ALTER TABLE project_openings
    DROP COLUMN publication_status,
    DROP COLUMN owner_user_id;
