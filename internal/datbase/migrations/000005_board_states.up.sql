CREATE TABLE IF NOT EXISTS board_states (
    board_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_board_states_updated_at ON board_states(updated_at);
