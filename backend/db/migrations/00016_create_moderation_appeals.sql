-- +goose Up
CREATE TABLE moderation_appeals (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL UNIQUE REFERENCES safety_reports (id) ON DELETE RESTRICT,
    appellant_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 30 AND 1000),
    appeal_status TEXT NOT NULL DEFAULT 'pending' CHECK (appeal_status IN ('pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX moderation_appeals_queue_idx
    ON moderation_appeals (appeal_status, created_at ASC, id ASC);

-- +goose Down
DROP TABLE moderation_appeals;
