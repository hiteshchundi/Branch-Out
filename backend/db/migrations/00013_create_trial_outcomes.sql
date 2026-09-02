-- +goose Up
CREATE TABLE trial_outcomes (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL UNIQUE REFERENCES trial_proposals (id) ON DELETE RESTRICT,
    submitted_by_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    outcome_status TEXT NOT NULL CHECK (outcome_status IN ('completed', 'partially_completed', 'stopped_early')),
    deliverable_status TEXT NOT NULL CHECK (deliverable_status IN ('met', 'partially_met', 'not_met')),
    work_summary TEXT NOT NULL CHECK (length(trim(work_summary)) BETWEEN 30 AND 1000),
    evidence_url TEXT NOT NULL DEFAULT '' CHECK (length(evidence_url) <= 2048),
    closeout_notes TEXT NOT NULL CHECK (length(trim(closeout_notes)) BETWEEN 20 AND 1000),
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'confirmed', 'disputed')),
    decided_by_user_id BIGINT REFERENCES users (id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    CHECK (submitted_by_user_id > 0),
    CHECK (decided_by_user_id IS NULL OR decided_by_user_id > 0),
    CHECK (
        (review_status = 'pending' AND decided_by_user_id IS NULL AND decided_at IS NULL)
        OR (review_status IN ('confirmed', 'disputed') AND decided_by_user_id IS NOT NULL AND decided_at IS NOT NULL)
    ),
    CHECK (decided_by_user_id IS NULL OR decided_by_user_id <> submitted_by_user_id)
);

CREATE INDEX trial_outcomes_participant_review_idx
    ON trial_outcomes (review_status, submitted_at ASC, id ASC);

-- +goose Down
DROP TABLE trial_outcomes;
