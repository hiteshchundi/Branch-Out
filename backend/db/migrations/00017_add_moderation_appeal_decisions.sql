-- +goose Up
ALTER TABLE moderation_appeals
    DROP CONSTRAINT moderation_appeals_appeal_status_check,
    ADD COLUMN reviewed_by_user_id BIGINT REFERENCES users (id) ON DELETE RESTRICT,
    ADD COLUMN moderator_notes TEXT,
    ADD COLUMN decided_at TIMESTAMPTZ,
    ADD CONSTRAINT moderation_appeals_appeal_status_check
        CHECK (appeal_status IN ('pending', 'granted', 'denied')),
    ADD CONSTRAINT moderation_appeals_moderator_notes_check
        CHECK (moderator_notes IS NULL OR length(trim(moderator_notes)) BETWEEN 20 AND 1000),
    ADD CONSTRAINT moderation_appeals_decision_state_check CHECK (
        (appeal_status = 'pending' AND reviewed_by_user_id IS NULL AND moderator_notes IS NULL AND decided_at IS NULL)
        OR (appeal_status IN ('granted', 'denied') AND reviewed_by_user_id IS NOT NULL AND moderator_notes IS NOT NULL AND decided_at IS NOT NULL)
    ),
    ADD CONSTRAINT moderation_appeals_reviewer_check
        CHECK (reviewed_by_user_id IS NULL OR reviewed_by_user_id <> appellant_user_id);

-- +goose Down
ALTER TABLE moderation_appeals
    DROP CONSTRAINT moderation_appeals_reviewer_check,
    DROP CONSTRAINT moderation_appeals_decision_state_check,
    DROP CONSTRAINT moderation_appeals_moderator_notes_check,
    DROP CONSTRAINT moderation_appeals_appeal_status_check,
    DROP COLUMN decided_at,
    DROP COLUMN moderator_notes,
    DROP COLUMN reviewed_by_user_id,
    ADD CONSTRAINT moderation_appeals_appeal_status_check
        CHECK (appeal_status IN ('pending'));
