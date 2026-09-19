CREATE TABLE IF NOT EXISTS patients (
    id                TEXT PRIMARY KEY,
    synthetic_ref     TEXT NOT NULL,
    display_name      TEXT NOT NULL,
    dob               DATE,
    preferred_window  TEXT
);

CREATE TABLE IF NOT EXISTS medications (
    id              TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL REFERENCES patients(id),
    ingredient      TEXT NOT NULL,
    brand           TEXT,
    dose_mg         NUMERIC,
    frequency_code  TEXT NOT NULL,
    prn             BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS regimen_snapshots (
    id            TEXT PRIMARY KEY,
    patient_id    TEXT NOT NULL REFERENCES patients(id),
    content_hash  TEXT NOT NULL,
    payload_json  JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_episodes (
    id                    TEXT PRIMARY KEY,
    patient_id            TEXT NOT NULL REFERENCES patients(id),
    started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    transcript_raw        TEXT,
    transcript_canonical  TEXT,
    normalizer_diff_json  JSONB,
    rule_fired_id         TEXT,
    tier                  TEXT,
    rationale             TEXT,
    action_taken          TEXT
);

CREATE TABLE IF NOT EXISTS escalations (
    id               TEXT PRIMARY KEY,
    episode_id       TEXT NOT NULL REFERENCES call_episodes(id),
    kind             TEXT NOT NULL,
    fired_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    notified_party   TEXT,
    ack_required_by  TIMESTAMPTZ,
    ack_state        TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS contradictions (
    id             TEXT PRIMARY KEY,
    patient_id     TEXT NOT NULL REFERENCES patients(id),
    check_id       TEXT NOT NULL,
    severity       TEXT NOT NULL,
    evidence_json  JSONB,
    surfaced       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_episodes (
    id          TEXT PRIMARY KEY,
    patient_id  TEXT NOT NULL REFERENCES patients(id),
    summary     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_transcripts (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_runs (
    id           TEXT PRIMARY KEY,
    run_label    TEXT NOT NULL,
    config_json  JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_results (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL REFERENCES eval_runs(id),
    vignette_id TEXT NOT NULL,
    condition   TEXT NOT NULL,
    arm         TEXT NOT NULL,
    voice_id    TEXT,
    gold        TEXT NOT NULL,
    predicted   TEXT,
    wer         NUMERIC,
    cter        NUMERIC,
    latency_ms  INTEGER,
    parse_ok    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_eval_results_run ON eval_results(run_id);
CREATE INDEX IF NOT EXISTS idx_episodes_patient ON call_episodes(patient_id);
