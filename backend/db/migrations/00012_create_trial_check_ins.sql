-- +goose Up
CREATE TABLE trial_check_ins (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL REFERENCES trial_proposals (id) ON DELETE RESTRICT,
    author_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    check_in_kind TEXT NOT NULL CHECK (check_in_kind IN ('progress', 'blocker', 'milestone')),
    update_text TEXT NOT NULL CHECK (length(trim(update_text)) BETWEEN 20 AND 1000),
    evidence_url TEXT NOT NULL DEFAULT '' CHECK (length(evidence_url) <= 2048),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (author_user_id > 0)
);

CREATE INDEX trial_check_ins_timeline_idx
    ON trial_check_ins (proposal_id, created_at ASC, id ASC);

-- +goose Down
DROP TABLE trial_check_ins;
