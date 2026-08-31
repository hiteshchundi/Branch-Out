-- +goose Up
ALTER TABLE applications
    DROP CONSTRAINT applications_status_check,
    DROP CONSTRAINT applications_check,
    ADD COLUMN decided_at TIMESTAMPTZ,
    ADD CONSTRAINT applications_status_check
        CHECK (status IN ('draft', 'submitted', 'accepted', 'declined')),
    ADD CONSTRAINT applications_lifecycle_check CHECK (
        (status = 'draft' AND submitted_at IS NULL AND decided_at IS NULL)
        OR (status = 'submitted' AND submitted_at IS NOT NULL AND decided_at IS NULL)
        OR (status IN ('accepted', 'declined') AND submitted_at IS NOT NULL AND decided_at IS NOT NULL)
    );

CREATE INDEX applications_opening_review_idx
    ON applications (opening_id, submitted_at ASC, id ASC)
    WHERE status IN ('submitted', 'accepted', 'declined');

-- +goose Down
DROP INDEX applications_opening_review_idx;

UPDATE applications
SET status = 'submitted', decided_at = NULL
WHERE status IN ('accepted', 'declined');

ALTER TABLE applications
    DROP CONSTRAINT applications_lifecycle_check,
    DROP CONSTRAINT applications_status_check,
    DROP COLUMN decided_at,
    ADD CONSTRAINT applications_status_check CHECK (status IN ('draft', 'submitted')),
    ADD CONSTRAINT applications_check CHECK (
        (status = 'draft' AND submitted_at IS NULL)
        OR (status = 'submitted' AND submitted_at IS NOT NULL)
    );
