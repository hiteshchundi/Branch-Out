-- +goose Up
DROP INDEX applications_opening_review_idx;

ALTER TABLE applications
    DROP CONSTRAINT applications_status_check,
    DROP CONSTRAINT applications_lifecycle_check,
    ADD COLUMN withdrawn_at TIMESTAMPTZ,
    ADD CONSTRAINT applications_status_check
        CHECK (status IN ('draft', 'submitted', 'accepted', 'declined', 'withdrawn')),
    ADD CONSTRAINT applications_lifecycle_check CHECK (
        (status = 'draft' AND submitted_at IS NULL AND decided_at IS NULL AND withdrawn_at IS NULL)
        OR (status = 'submitted' AND submitted_at IS NOT NULL AND decided_at IS NULL AND withdrawn_at IS NULL)
        OR (status IN ('accepted', 'declined') AND submitted_at IS NOT NULL AND decided_at IS NOT NULL AND withdrawn_at IS NULL)
        OR (status = 'withdrawn' AND submitted_at IS NOT NULL AND decided_at IS NULL AND withdrawn_at IS NOT NULL)
    );

CREATE INDEX applications_opening_review_idx
    ON applications (opening_id, submitted_at ASC, id ASC)
    WHERE status IN ('submitted', 'accepted', 'declined', 'withdrawn');

-- +goose Down
DROP INDEX applications_opening_review_idx;

UPDATE applications
SET status = 'submitted', withdrawn_at = NULL
WHERE status = 'withdrawn';

ALTER TABLE applications
    DROP CONSTRAINT applications_lifecycle_check,
    DROP CONSTRAINT applications_status_check,
    DROP COLUMN withdrawn_at,
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
