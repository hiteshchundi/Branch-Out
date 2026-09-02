-- +goose Up
CREATE TABLE trial_feedback (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL REFERENCES trial_proposals (id) ON DELETE RESTRICT,
    author_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    observed_behaviors TEXT[] NOT NULL,
    collaboration_example TEXT NOT NULL CHECK (length(trim(collaboration_example)) BETWEEN 30 AND 1000),
    collaborate_again TEXT NOT NULL CHECK (collaborate_again IN ('yes', 'maybe', 'no')),
    review_summary TEXT NOT NULL CHECK (length(trim(review_summary)) BETWEEN 30 AND 1000),
    acknowledged_by_user_id BIGINT REFERENCES users (id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    UNIQUE (proposal_id, author_user_id),
    CHECK (cardinality(observed_behaviors) BETWEEN 2 AND 4),
    CHECK (observed_behaviors <@ ARRAY['reliable_delivery', 'clear_communication', 'sound_scope_judgment', 'constructive_feedback']::TEXT[]),
    CHECK (cardinality(array_positions(observed_behaviors, 'reliable_delivery')) <= 1),
    CHECK (cardinality(array_positions(observed_behaviors, 'clear_communication')) <= 1),
    CHECK (cardinality(array_positions(observed_behaviors, 'sound_scope_judgment')) <= 1),
    CHECK (cardinality(array_positions(observed_behaviors, 'constructive_feedback')) <= 1),
    CHECK (
        (acknowledged_by_user_id IS NULL AND acknowledged_at IS NULL)
        OR (acknowledged_by_user_id IS NOT NULL AND acknowledged_at IS NOT NULL)
    ),
    CHECK (acknowledged_by_user_id IS NULL OR acknowledged_by_user_id <> author_user_id)
);

CREATE INDEX trial_feedback_proposal_submitted_idx
    ON trial_feedback (proposal_id, submitted_at ASC, id ASC);

-- +goose Down
DROP TABLE trial_feedback;
