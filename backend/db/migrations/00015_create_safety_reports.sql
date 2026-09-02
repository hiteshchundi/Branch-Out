-- +goose Up
ALTER TABLE users
    ADD COLUMN account_role TEXT NOT NULL DEFAULT 'member'
    CHECK (account_role IN ('member', 'moderator'));

CREATE TABLE safety_reports (
    id TEXT PRIMARY KEY,
    reporter_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    target_kind TEXT NOT NULL CHECK (target_kind IN ('trial_feedback', 'trust_candidate')),
    target_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('harassment', 'privacy', 'fraud', 'spam', 'other')),
    details TEXT NOT NULL CHECK (length(trim(details)) BETWEEN 30 AND 1000),
    target_snapshot JSONB NOT NULL CHECK (jsonb_typeof(target_snapshot) = 'object'),
    report_status TEXT NOT NULL DEFAULT 'pending' CHECK (report_status IN ('pending', 'upheld', 'dismissed')),
    reviewed_by_user_id BIGINT REFERENCES users (id) ON DELETE RESTRICT,
    moderator_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    UNIQUE (reporter_user_id, target_kind, target_id),
    CHECK (length(target_id) BETWEEN 1 AND 100),
    CHECK (moderator_notes IS NULL OR length(trim(moderator_notes)) BETWEEN 20 AND 1000),
    CHECK (
        (report_status = 'pending' AND reviewed_by_user_id IS NULL AND moderator_notes IS NULL AND decided_at IS NULL)
        OR (report_status IN ('upheld', 'dismissed') AND reviewed_by_user_id IS NOT NULL AND moderator_notes IS NOT NULL AND decided_at IS NOT NULL)
    ),
    CHECK (reviewed_by_user_id IS NULL OR reviewed_by_user_id <> reporter_user_id)
);

CREATE INDEX safety_reports_moderation_queue_idx
    ON safety_reports (report_status, created_at ASC, id ASC);

-- +goose Down
DROP TABLE safety_reports;
ALTER TABLE users DROP COLUMN account_role;
