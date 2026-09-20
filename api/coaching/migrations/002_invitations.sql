CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  accepted_by TEXT,
  accepted_at TEXT,
  relationship_id TEXT REFERENCES client_relationships(id),
  CHECK (accepted_by IS NULL OR relationship_id IS NOT NULL)
);
CREATE INDEX invitations_trainer_created ON invitations(trainer_id, created_at DESC);

CREATE TRIGGER invitation_trainer_exists_before_insert
BEFORE INSERT ON invitations
WHEN account_exists(NEW.trainer_id) = 0
BEGIN
  SELECT RAISE(ABORT, 'account unavailable');
END;
