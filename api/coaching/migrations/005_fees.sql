CREATE TABLE fees (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES client_relationships(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  exponent INTEGER NOT NULL CHECK (exponent BETWEEN 0 AND 3),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  due_date TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  payment_url TEXT NOT NULL,
  payment_host TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','void')),
  paid_date TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX fees_relationship_due ON fees(relationship_id, status, due_date);

CREATE TABLE fee_events (
  id TEXT PRIMARY KEY,
  fee_id TEXT NOT NULL REFERENCES fees(id),
  type TEXT NOT NULL CHECK (type IN ('created','confirmed','corrected','voided')),
  actor_id TEXT NOT NULL,
  paid_date TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX fee_events_fee_time ON fee_events(fee_id, created_at);
