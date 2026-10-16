ALTER TABLE assigned_sessions ADD COLUMN feedback_json TEXT;
ALTER TABLE assigned_sessions ADD COLUMN feedback_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assigned_sessions ADD COLUMN feedback_updated_at TEXT;
ALTER TABLE assigned_sessions ADD COLUMN feedback_reviewed_at TEXT;
ALTER TABLE assigned_sessions ADD COLUMN feedback_response TEXT;
CREATE INDEX assigned_sessions_feedback_pending ON assigned_sessions(relationship_id, feedback_reviewed_at) WHERE feedback_version > 0;
