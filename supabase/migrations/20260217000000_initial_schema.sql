-- ============================================================
-- The Ladder — Initial Database Schema
-- ============================================================

-- ------------------------------------------------------------
-- 0. Drop old schema (early development reset)
-- ------------------------------------------------------------

DROP TABLE IF EXISTS draft_picks CASCADE;
DROP TABLE IF EXISTS draft_state CASCADE;
DROP TABLE IF EXISTS league_invites CASCADE;
DROP TABLE IF EXISTS league_members CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;
DROP TABLE IF EXISTS nfl_players CASCADE;
DROP TABLE IF EXISTS nfl_teams CASCADE;
DROP TABLE IF EXISTS player_game_stats CASCADE;
DROP TABLE IF EXISTS roster_slots CASCADE;
DROP TABLE IF EXISTS scoring_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS sport CASCADE;
DROP TYPE IF EXISTS roster_slot CASCADE;
DROP TYPE IF EXISTS draft_status CASCADE;
DROP TYPE IF EXISTS draft_type CASCADE;
DROP TYPE IF EXISTS league_role CASCADE;
DROP TYPE IF EXISTS playoff_round CASCADE;

-- ------------------------------------------------------------
-- 1. Enum Types
-- ------------------------------------------------------------

CREATE TYPE sport AS ENUM ('nfl');

CREATE TYPE roster_slot AS ENUM (
  'qb', 'rb1', 'rb2', 'wr_te1', 'wr_te2', 'wr_te3', 'dst', 'k', 'super_flex'
);

CREATE TYPE draft_status AS ENUM ('pre_draft', 'in_progress', 'completed');

CREATE TYPE draft_type AS ENUM ('live', 'async');

CREATE TYPE league_role AS ENUM ('commissioner', 'member');

CREATE TYPE playoff_round AS ENUM ('wild_card', 'divisional', 'conference', 'super_bowl');

-- ------------------------------------------------------------
-- 2. Tables
-- ------------------------------------------------------------

-- profiles: links Clerk users to app data
CREATE TABLE profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id    text UNIQUE NOT NULL,
  display_name text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- leagues: a group of users competing in a single playoff season
CREATE TABLE leagues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  sport         sport NOT NULL DEFAULT 'nfl',
  season        int NOT NULL,
  invite_code   text UNIQUE NOT NULL,
  max_members   int NOT NULL DEFAULT 10,
  is_free       boolean NOT NULL DEFAULT true,
  buy_in_amount numeric,
  created_by    uuid NOT NULL REFERENCES profiles (id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- league_members: join table — users in a league
CREATE TABLE league_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    uuid NOT NULL REFERENCES leagues (id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role         league_role NOT NULL DEFAULT 'member',
  team_name    text,
  draft_order  int,
  total_points numeric NOT NULL DEFAULT 0,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, profile_id)
);

-- scoring_settings: customizable scoring rules per league
CREATE TABLE scoring_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id               uuid NOT NULL UNIQUE REFERENCES leagues (id) ON DELETE CASCADE,
  pass_yards_per_point    numeric NOT NULL DEFAULT 25,
  pass_td                 numeric NOT NULL DEFAULT 4,
  pass_int                numeric NOT NULL DEFAULT -2,
  rush_yards_per_point    numeric NOT NULL DEFAULT 10,
  rush_td                 numeric NOT NULL DEFAULT 6,
  rec_yards_per_point     numeric NOT NULL DEFAULT 10,
  rec_td                  numeric NOT NULL DEFAULT 6,
  reception               numeric NOT NULL DEFAULT 1,
  fumble                  numeric NOT NULL DEFAULT -2,
  kick_xp                 numeric NOT NULL DEFAULT 1,
  kick_fg_0_49            numeric NOT NULL DEFAULT 3,
  kick_fg_50_plus         numeric NOT NULL DEFAULT 5,
  kick_fg_60_plus         numeric NOT NULL DEFAULT 7,
  dst_sack                numeric NOT NULL DEFAULT 1,
  dst_int                 numeric NOT NULL DEFAULT 2,
  dst_safety              numeric NOT NULL DEFAULT 10,
  dst_td                  numeric NOT NULL DEFAULT 6,
  dst_fum_rec             numeric NOT NULL DEFAULT 2,
  dst_two_pt_conv         numeric NOT NULL DEFAULT 2,
  dst_pts_allowed_0       numeric NOT NULL DEFAULT 10,
  dst_pts_allowed_1_6     numeric NOT NULL DEFAULT 8,
  dst_pts_allowed_7_13    numeric NOT NULL DEFAULT 6,
  dst_pts_allowed_14_17   numeric NOT NULL DEFAULT 4,
  dst_pts_allowed_18_21   numeric NOT NULL DEFAULT 2,
  dst_pts_allowed_22_27   numeric NOT NULL DEFAULT 0,
  dst_pts_allowed_28_34   numeric NOT NULL DEFAULT -2,
  dst_pts_allowed_35_45   numeric NOT NULL DEFAULT -5,
  dst_pts_allowed_46_plus numeric NOT NULL DEFAULT -8
);

-- nfl_teams: cached from Ball Don't Lie API
CREATE TABLE nfl_teams (
  id               int PRIMARY KEY,
  abbreviation     text NOT NULL,
  full_name        text NOT NULL,
  conference       text,
  division         text,
  is_eliminated    boolean NOT NULL DEFAULT false,
  eliminated_round playoff_round
);

-- nfl_players: cached from Ball Don't Lie API
CREATE TABLE nfl_players (
  id        int PRIMARY KEY,
  name      text NOT NULL,
  position  text,
  team_id   int REFERENCES nfl_teams (id),
  is_active boolean NOT NULL DEFAULT true
);

-- nfl_games: playoff games cached from API
CREATE TABLE nfl_games (
  id                 int PRIMARY KEY,
  season             int NOT NULL,
  round              playoff_round NOT NULL,
  home_team_id       int NOT NULL REFERENCES nfl_teams (id),
  visitor_team_id    int NOT NULL REFERENCES nfl_teams (id),
  home_team_score    int,
  visitor_team_score int,
  status             text,
  date               timestamptz
);

-- drafts: one draft per league
CREATE TABLE drafts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id        uuid NOT NULL UNIQUE REFERENCES leagues (id) ON DELETE CASCADE,
  status           draft_status NOT NULL DEFAULT 'pre_draft',
  type             draft_type NOT NULL DEFAULT 'live',
  seconds_per_pick int,
  current_pick     int,
  started_at       timestamptz,
  completed_at     timestamptz
);

-- draft_picks: individual picks in the draft
CREATE TABLE draft_picks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id         uuid NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
  league_member_id uuid NOT NULL REFERENCES league_members (id) ON DELETE CASCADE,
  player_id        int NOT NULL REFERENCES nfl_players (id),
  round            int NOT NULL,
  pick_number      int NOT NULL,
  picked_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, player_id),
  UNIQUE (draft_id, pick_number)
);

-- roster_players: a player on a fantasy team, assigned to a roster slot
CREATE TABLE roster_players (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_member_id uuid NOT NULL REFERENCES league_members (id) ON DELETE CASCADE,
  player_id        int NOT NULL REFERENCES nfl_players (id),
  slot             roster_slot NOT NULL,
  UNIQUE (league_member_id, slot),
  UNIQUE (league_member_id, player_id)
);

-- player_game_scores: fantasy points per player per game per league
CREATE TABLE player_game_scores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  uuid NOT NULL REFERENCES leagues (id) ON DELETE CASCADE,
  player_id  int NOT NULL REFERENCES nfl_players (id),
  game_id    int NOT NULL REFERENCES nfl_games (id),
  points     numeric NOT NULL,
  stats_json jsonb,
  UNIQUE (league_id, player_id, game_id)
);

-- ------------------------------------------------------------
-- 3. Indexes
-- ------------------------------------------------------------

CREATE INDEX idx_profiles_clerk_id ON profiles (clerk_id);
CREATE INDEX idx_leagues_invite_code ON leagues (invite_code);
CREATE INDEX idx_league_members_league_id ON league_members (league_id);
CREATE INDEX idx_league_members_profile_id ON league_members (profile_id);
CREATE INDEX idx_draft_picks_draft_id ON draft_picks (draft_id);
CREATE INDEX idx_roster_players_league_member_id ON roster_players (league_member_id);
CREATE INDEX idx_player_game_scores_league_game ON player_game_scores (league_id, game_id);
CREATE INDEX idx_nfl_games_season ON nfl_games (season);

-- ------------------------------------------------------------
-- 4. Enable Row Level Security
-- ------------------------------------------------------------

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_games          ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_scores ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 5. RLS Policies
-- ------------------------------------------------------------

-- Helper: get the current user's profile id from their Clerk JWT claim.
-- Clerk sets `sub` in the JWT which Supabase exposes via auth.jwt()->'sub'.
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT id FROM profiles WHERE clerk_id = auth.jwt()->>'sub'
$$;

-- Helper: check if the requesting user is a member of a given league
CREATE OR REPLACE FUNCTION is_league_member(p_league_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id
      AND profile_id = requesting_user_id()
  )
$$;

-- Helper: check if the requesting user is the commissioner of a given league
CREATE OR REPLACE FUNCTION is_commissioner(p_league_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id
      AND profile_id = requesting_user_id()
      AND role = 'commissioner'
  )
$$;

-- ---- profiles ----
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (clerk_id = auth.jwt()->>'sub');

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (clerk_id = auth.jwt()->>'sub');

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (clerk_id = auth.jwt()->>'sub');

-- ---- leagues ----
CREATE POLICY "League members can view their leagues"
  ON leagues FOR SELECT
  USING (is_league_member(id));

CREATE POLICY "Authenticated users can create leagues"
  ON leagues FOR INSERT
  WITH CHECK (created_by = requesting_user_id());

CREATE POLICY "Commissioners can update their leagues"
  ON leagues FOR UPDATE
  USING (is_commissioner(id));

-- ---- league_members ----
CREATE POLICY "League members can view members"
  ON league_members FOR SELECT
  USING (is_league_member(league_id));

CREATE POLICY "Commissioners can add members"
  ON league_members FOR INSERT
  WITH CHECK (is_commissioner(league_id));

CREATE POLICY "Commissioners can remove members"
  ON league_members FOR DELETE
  USING (is_commissioner(league_id));

-- ---- scoring_settings ----
CREATE POLICY "League members can view scoring settings"
  ON scoring_settings FOR SELECT
  USING (is_league_member(league_id));

CREATE POLICY "Commissioners can update scoring settings"
  ON scoring_settings FOR UPDATE
  USING (is_commissioner(league_id));

CREATE POLICY "Commissioners can insert scoring settings"
  ON scoring_settings FOR INSERT
  WITH CHECK (is_commissioner(league_id));

-- ---- nfl_teams (public read) ----
CREATE POLICY "Anyone can view NFL teams"
  ON nfl_teams FOR SELECT
  USING (true);

-- ---- nfl_players (public read) ----
CREATE POLICY "Anyone can view NFL players"
  ON nfl_players FOR SELECT
  USING (true);

-- ---- nfl_games (public read) ----
CREATE POLICY "Anyone can view NFL games"
  ON nfl_games FOR SELECT
  USING (true);

-- ---- drafts ----
CREATE POLICY "League members can view drafts"
  ON drafts FOR SELECT
  USING (is_league_member(league_id));

CREATE POLICY "Commissioners can manage drafts"
  ON drafts FOR ALL
  USING (is_commissioner(league_id));

-- ---- draft_picks ----
CREATE POLICY "League members can view draft picks"
  ON draft_picks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drafts d
      WHERE d.id = draft_picks.draft_id
        AND is_league_member(d.league_id)
    )
  );

CREATE POLICY "Members can insert their own draft picks"
  ON draft_picks FOR INSERT
  WITH CHECK (
    league_member_id IN (
      SELECT lm.id FROM league_members lm
      WHERE lm.profile_id = requesting_user_id()
    )
  );

-- ---- roster_players ----
CREATE POLICY "League members can view rosters"
  ON roster_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM league_members lm
      WHERE lm.id = roster_players.league_member_id
        AND is_league_member(lm.league_id)
    )
  );

-- ---- player_game_scores ----
CREATE POLICY "League members can view scores"
  ON player_game_scores FOR SELECT
  USING (is_league_member(league_id));
