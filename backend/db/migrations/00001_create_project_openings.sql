-- +goose Up
CREATE TABLE project_openings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 10 AND 120),
    summary TEXT NOT NULL CHECK (length(trim(summary)) BETWEEN 20 AND 240),
    skills TEXT[] NOT NULL CHECK (cardinality(skills) BETWEEN 1 AND 12),
    role TEXT NOT NULL CHECK (role IN ('Engineering', 'Design', 'Research')),
    compensation TEXT NOT NULL CHECK (compensation IN ('Paid', 'Fixed bounty', 'Revenue share', 'Portfolio')),
    commitment TEXT NOT NULL CHECK (length(trim(commitment)) BETWEEN 3 AND 40),
    commitment_band TEXT NOT NULL CHECK (commitment_band IN ('Under 6 hrs/week', '6–8 hrs/week', '8+ hrs/week')),
    duration TEXT NOT NULL CHECK (length(trim(duration)) BETWEEN 3 AND 40),
    timezone TEXT NOT NULL CHECK (length(trim(timezone)) BETWEEN 3 AND 80),
    freshness TEXT NOT NULL CHECK (length(trim(freshness)) BETWEEN 3 AND 40),
    stage TEXT NOT NULL CHECK (length(trim(stage)) BETWEEN 3 AND 80),
    desired_outcome TEXT NOT NULL CHECK (length(trim(desired_outcome)) BETWEEN 20 AND 500),
    first_milestone TEXT NOT NULL CHECK (length(trim(first_milestone)) BETWEEN 20 AND 500),
    owner_contribution TEXT NOT NULL CHECK (length(trim(owner_contribution)) BETWEEN 20 AND 500),
    owner_name TEXT NOT NULL CHECK (length(trim(owner_name)) BETWEEN 2 AND 100),
    owner_signal TEXT NOT NULL CHECK (length(trim(owner_signal)) BETWEEN 3 AND 160),
    confidentiality TEXT NOT NULL CHECK (length(trim(confidentiality)) BETWEEN 10 AND 500),
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX project_openings_discovery_idx
    ON project_openings (role, compensation, commitment_band, display_order);

-- +goose Down
DROP TABLE project_openings;
