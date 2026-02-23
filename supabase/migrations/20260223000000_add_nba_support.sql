-- ============================================================
-- Add NBA Support — parallel tables for NBA sport
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend the sport enum
-- ------------------------------------------------------------
ALTER TYPE sport ADD VALUE IF NOT EXISTS 'nba';
ALTER TYPE sport ADD VALUE IF NOT EXISTS 'mlb';

-- ------------------------------------------------------------
-- 2. NBA Tables
-- ------------------------------------------------------------

-- nba_teams: cached from Ball Don't Lie API
CREATE TABLE nba_teams (
  id               int PRIMARY KEY,
  abbreviation     text NOT NULL,
  full_name        text NOT NULL,
  conference       text,
  division         text
);

-- nba_players: cached from Ball Don't Lie API
CREATE TABLE nba_players (
  id              int PRIMARY KEY,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  name            text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  position        text,
  team_id         int REFERENCES nba_teams (id),
  is_active       boolean NOT NULL DEFAULT true,
  fantasy_avg_pts numeric NOT NULL DEFAULT 0
);

-- nba_games: regular season / playoff games
CREATE TABLE nba_games (
  id                 int PRIMARY KEY,
  season             int NOT NULL,
  home_team_id       int NOT NULL REFERENCES nba_teams (id),
  visitor_team_id    int NOT NULL REFERENCES nba_teams (id),
  home_team_score    int,
  visitor_team_score int,
  status             text,
  date               date
);

-- nba_player_game_stats: box score stats per player per game
CREATE TABLE nba_player_game_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       int NOT NULL REFERENCES nba_players (id),
  game_id         int NOT NULL REFERENCES nba_games (id),
  pts             int NOT NULL DEFAULT 0,
  reb             int NOT NULL DEFAULT 0,
  ast             int NOT NULL DEFAULT 0,
  stl             int NOT NULL DEFAULT 0,
  blk             int NOT NULL DEFAULT 0,
  turnover        int NOT NULL DEFAULT 0,
  min             text,
  fantasy_points  numeric NOT NULL DEFAULT 0,
  UNIQUE (player_id, game_id)
);

-- nba_draft_picks: mirrors draft_picks but FK to nba_players
CREATE TABLE nba_draft_picks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id         uuid NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
  league_member_id uuid NOT NULL REFERENCES league_members (id) ON DELETE CASCADE,
  player_id        int NOT NULL REFERENCES nba_players (id),
  round            int NOT NULL,
  pick_number      int NOT NULL,
  picked_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, player_id),
  UNIQUE (draft_id, pick_number)
);

-- nba_roster_players: mirrors roster_players but slot is text (avoids polluting NFL roster_slot enum)
CREATE TABLE nba_roster_players (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_member_id uuid NOT NULL REFERENCES league_members (id) ON DELETE CASCADE,
  player_id        int NOT NULL REFERENCES nba_players (id),
  slot             text NOT NULL,
  UNIQUE (league_member_id, slot),
  UNIQUE (league_member_id, player_id)
);

-- nba_scoring_settings: league-specific multipliers for NBA fantasy scoring
CREATE TABLE nba_scoring_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   uuid NOT NULL UNIQUE REFERENCES leagues (id) ON DELETE CASCADE,
  pts         numeric NOT NULL DEFAULT 1.0,
  reb         numeric NOT NULL DEFAULT 1.2,
  ast         numeric NOT NULL DEFAULT 1.5,
  stl         numeric NOT NULL DEFAULT 3.0,
  blk         numeric NOT NULL DEFAULT 3.0,
  turnover    numeric NOT NULL DEFAULT -1.0
);

-- ------------------------------------------------------------
-- 3. Indexes
-- ------------------------------------------------------------
CREATE INDEX idx_nba_players_team_id ON nba_players (team_id);
CREATE INDEX idx_nba_players_active ON nba_players (is_active);
CREATE INDEX idx_nba_games_season ON nba_games (season);
CREATE INDEX idx_nba_games_date ON nba_games (date);
CREATE INDEX idx_nba_player_game_stats_game ON nba_player_game_stats (game_id);
CREATE INDEX idx_nba_player_game_stats_player ON nba_player_game_stats (player_id);
CREATE INDEX idx_nba_draft_picks_draft_id ON nba_draft_picks (draft_id);
CREATE INDEX idx_nba_roster_players_member ON nba_roster_players (league_member_id);

-- ------------------------------------------------------------
-- 4. Enable RLS
-- ------------------------------------------------------------
ALTER TABLE nba_teams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_players             ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_games               ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_player_game_stats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_draft_picks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_roster_players      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_scoring_settings    ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 5. RLS Policies
-- ------------------------------------------------------------

-- Public read for reference data
CREATE POLICY "Anyone can view NBA teams"
  ON nba_teams FOR SELECT USING (true);

CREATE POLICY "Anyone can view NBA players"
  ON nba_players FOR SELECT USING (true);

CREATE POLICY "Anyone can view NBA games"
  ON nba_games FOR SELECT USING (true);

CREATE POLICY "Anyone can view NBA stats"
  ON nba_player_game_stats FOR SELECT USING (true);

-- League-member gated for draft/roster/scoring
CREATE POLICY "League members can view NBA draft picks"
  ON nba_draft_picks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drafts d
      WHERE d.id = nba_draft_picks.draft_id
        AND is_league_member(d.league_id)
    )
  );

CREATE POLICY "Members can insert their own NBA draft picks"
  ON nba_draft_picks FOR INSERT
  WITH CHECK (
    league_member_id IN (
      SELECT lm.id FROM league_members lm
      WHERE lm.profile_id = requesting_user_id()
    )
  );

CREATE POLICY "League members can view NBA rosters"
  ON nba_roster_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM league_members lm
      WHERE lm.id = nba_roster_players.league_member_id
        AND is_league_member(lm.league_id)
    )
  );

CREATE POLICY "League members can view NBA scoring settings"
  ON nba_scoring_settings FOR SELECT
  USING (is_league_member(league_id));

CREATE POLICY "Commissioners can update NBA scoring settings"
  ON nba_scoring_settings FOR UPDATE
  USING (is_commissioner(league_id));

CREATE POLICY "Commissioners can insert NBA scoring settings"
  ON nba_scoring_settings FOR INSERT
  WITH CHECK (is_commissioner(league_id));
