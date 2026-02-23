-- Add fantasy points column for 2025 playoff rankings (used for auto-draft)
ALTER TABLE nfl_players ADD COLUMN IF NOT EXISTS fantasy_points_2025 numeric NOT NULL DEFAULT 0;
