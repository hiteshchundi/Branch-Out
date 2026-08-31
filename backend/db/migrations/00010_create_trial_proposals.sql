-- +goose Up
CREATE TABLE trial_proposals (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL UNIQUE REFERENCES applications (id) ON DELETE RESTRICT,
    opening_id TEXT NOT NULL REFERENCES project_openings (id) ON DELETE RESTRICT,
    applicant_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    outcome TEXT NOT NULL CHECK (length(trim(outcome)) BETWEEN 20 AND 500),
    deliverable TEXT NOT NULL CHECK (length(trim(deliverable)) BETWEEN 20 AND 500),
    non_goals TEXT NOT NULL CHECK (length(trim(non_goals)) BETWEEN 15 AND 500),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date - start_date BETWEEN 13 AND 15),
    weekly_hours INTEGER NOT NULL CHECK (weekly_hours BETWEEN 1 AND 40),
    check_in_cadence TEXT NOT NULL CHECK (check_in_cadence IN (
        'Async update every two days',
        'Twice-weekly live check-in',
        'Weekly review plus async updates'
    )),
    access_level TEXT NOT NULL CHECK (access_level IN (
        'Sandbox or sample data only',
        'Limited repository access',
        'Time-limited production access'
    )),
    confidentiality TEXT NOT NULL CHECK (confidentiality IN (
        'Public work only',
        'Private after written agreement',
        'Synthetic data during trial'
    )),
    ip_ownership TEXT NOT NULL CHECK (ip_ownership IN (
        'Contributor retains pre-existing work; project owns trial deliverable',
        'Contributor licenses trial deliverable to the project',
        'Open-source contribution under the project license',
        'Custom written terms required before work starts'
    )),
    exit_plan TEXT NOT NULL CHECK (length(trim(exit_plan)) BETWEEN 20 AND 500),
    terms_confirmed BOOLEAN NOT NULL CHECK (terms_confirmed),
    proposal_status TEXT NOT NULL DEFAULT 'draft' CHECK (proposal_status = 'draft'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (applicant_user_id > 0)
);

CREATE INDEX trial_proposals_applicant_idx
    ON trial_proposals (applicant_user_id, updated_at DESC);

-- +goose Down
DROP TABLE trial_proposals;
