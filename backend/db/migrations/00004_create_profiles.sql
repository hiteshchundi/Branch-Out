-- +goose Up
CREATE TABLE profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
    primary_role TEXT NOT NULL CHECK (primary_role IN (
        'Software developer', 'Product designer', 'UX researcher', 'Product builder'
    )),
    bio TEXT NOT NULL CHECK (length(trim(bio)) BETWEEN 40 AND 500),
    timezone TEXT NOT NULL CHECK (length(trim(timezone)) BETWEEN 1 AND 50),
    weekly_availability TEXT NOT NULL CHECK (weekly_availability IN (
        'Under 6 hrs/week', '6–8 hrs/week', '8–12 hrs/week', '12+ hrs/week'
    )),
    preferred_duration TEXT NOT NULL CHECK (preferred_duration IN (
        '2–4 weeks', '5–8 weeks', '2–3 months'
    )),
    work_style TEXT NOT NULL CHECK (work_style IN (
        'Async-first', 'Balanced async and live', 'Live collaboration preferred'
    )),
    communication_cadence TEXT NOT NULL CHECK (communication_cadence IN (
        'Daily async update', 'Three updates per week', 'Weekly planning and demo'
    )),
    skills TEXT[] NOT NULL CHECK (cardinality(skills) BETWEEN 1 AND 10),
    portfolio_url TEXT CHECK (
        portfolio_url IS NULL OR portfolio_url ~ '^https?://'
    ),
    evidence_summary TEXT NOT NULL CHECK (length(trim(evidence_summary)) BETWEEN 20 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE profiles;
