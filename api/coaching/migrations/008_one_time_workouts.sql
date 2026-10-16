ALTER TABLE workout_occurrences
ADD COLUMN is_one_time INTEGER NOT NULL DEFAULT 0 CHECK (is_one_time IN (0, 1));
