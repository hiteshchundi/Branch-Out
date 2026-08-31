-- +goose Up
CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    opening_id TEXT NOT NULL REFERENCES project_openings (id) ON DELETE RESTRICT,
    applicant_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 30 AND 1000),
    work_sample_url TEXT NOT NULL CHECK (length(work_sample_url) BETWEEN 8 AND 2048),
    work_sample_context TEXT NOT NULL CHECK (length(trim(work_sample_context)) BETWEEN 20 AND 500),
    availability TEXT NOT NULL CHECK (length(trim(availability)) BETWEEN 3 AND 160),
    availability_confirmed BOOLEAN NOT NULL CHECK (availability_confirmed),
    proposed_contribution TEXT NOT NULL CHECK (length(trim(proposed_contribution)) BETWEEN 20 AND 500),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (opening_id, applicant_user_id),
    CHECK ((status = 'draft' AND submitted_at IS NULL) OR (status = 'submitted' AND submitted_at IS NOT NULL))
);

CREATE INDEX applications_applicant_idx
    ON applications (applicant_user_id, updated_at DESC);

CREATE INDEX applications_opening_status_idx
    ON applications (opening_id, status, updated_at DESC);

-- +goose Down
DROP TABLE applications;
