-- +goose Up
ALTER TABLE trial_proposals
    DROP CONSTRAINT trial_proposals_proposal_status_check,
    ADD COLUMN sent_at TIMESTAMPTZ,
    ADD COLUMN decided_at TIMESTAMPTZ,
    ADD CONSTRAINT trial_proposals_proposal_status_check
        CHECK (proposal_status IN ('draft', 'sent', 'accepted', 'declined')),
    ADD CONSTRAINT trial_proposals_lifecycle_check CHECK (
        (proposal_status = 'draft' AND sent_at IS NULL AND decided_at IS NULL)
        OR (proposal_status = 'sent' AND sent_at IS NOT NULL AND decided_at IS NULL)
        OR (proposal_status IN ('accepted', 'declined') AND sent_at IS NOT NULL AND decided_at IS NOT NULL)
    );

CREATE INDEX trial_proposals_owner_review_idx
    ON trial_proposals (opening_id, sent_at ASC, id ASC)
    WHERE proposal_status IN ('sent', 'accepted', 'declined');

-- +goose Down
DROP INDEX trial_proposals_owner_review_idx;

UPDATE trial_proposals
SET proposal_status = 'draft', sent_at = NULL, decided_at = NULL
WHERE proposal_status IN ('sent', 'accepted', 'declined');

ALTER TABLE trial_proposals
    DROP CONSTRAINT trial_proposals_lifecycle_check,
    DROP CONSTRAINT trial_proposals_proposal_status_check,
    DROP COLUMN sent_at,
    DROP COLUMN decided_at,
    ADD CONSTRAINT trial_proposals_proposal_status_check CHECK (proposal_status = 'draft');
