import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SECRET_KEY as string
);

const BDL_BASE = "https://api.balldontlie.io/nfl/v1";
const BDL_HEADERS: HeadersInit = {
  Authorization: process.env.BDL_API_KEY as string,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// All-Star tier: 60 req/min → 1 req/s is safe
const MIN_REQUEST_GAP = 1100;
let lastRequestAt = 0;

async function fetchPaced(url: string): Promise<Response> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_GAP) await sleep(MIN_REQUEST_GAP - elapsed);
  lastRequestAt = Date.now();

  const res = await fetch(url, { headers: BDL_HEADERS });
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res;
}

// Default scoring settings (matches DB defaults)
const SCORING = {
  pass_yards_per_point: 25,
  pass_td: 4,
  pass_int: -2,
  rush_yards_per_point: 10,
  rush_td: 6,
  rec_yards_per_point: 10,
  rec_td: 6,
  reception: 1,
  fumble: -2,
  kick_xp: 1,
  kick_fg_0_49: 3,
  kick_fg_50_plus: 5,
  dst_sack: 1,
  dst_int: 2,
  dst_td: 6,
  dst_fum_rec: 2,
};

const n = (v: unknown): number => (typeof v === "number" ? v : 0);

function calcOffensivePoints(s: Record<string, unknown>): number {
  let pts = 0;
  // Passing
  pts += n(s.passing_yards) / SCORING.pass_yards_per_point;
  pts += n(s.passing_touchdowns) * SCORING.pass_td;
  pts += n(s.passing_interceptions) * SCORING.pass_int;
  // Rushing
  pts += n(s.rushing_yards) / SCORING.rush_yards_per_point;
  pts += n(s.rushing_touchdowns) * SCORING.rush_td;
  // Receiving
  pts += n(s.receiving_yards) / SCORING.rec_yards_per_point;
  pts += n(s.receiving_touchdowns) * SCORING.rec_td;
  pts += n(s.receptions) * SCORING.reception;
  // Fumbles
  pts += (n(s.rushing_fumbles_lost) + n(s.receiving_fumbles_lost)) * SCORING.fumble;
  return Math.round(pts * 100) / 100;
}

function calcKickerPoints(s: Record<string, unknown>): number {
  let pts = 0;
  // FG 0-49 (buckets 1-19, 20-29, 30-39, 40-49)
  const fg049 =
    n(s.field_goals_made_1_19) +
    n(s.field_goals_made_20_29) +
    n(s.field_goals_made_30_39) +
    n(s.field_goals_made_40_49);
  pts += fg049 * SCORING.kick_fg_0_49;
  // FG 50+
  pts += n(s.field_goals_made_50) * SCORING.kick_fg_50_plus;
  // XP — season_stats doesn't have extra_points_made, estimate from total_points
  // total_points = (FG * 3 avg) + XP. We can approximate XP or skip.
  // For ranking purposes, FG scoring is the major differentiator.
  return Math.round(pts * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Seed Fantasy Points (2025 Postseason) ===\n");

  // Check if column exists by trying an update on a non-existent row
  console.log("Checking fantasy_points_2025 column...");
  const { error: testErr } = await supabase
    .from("nfl_players")
    .update({ fantasy_points_2025: 0 })
    .eq("id", -1);

  if (testErr && testErr.message.includes("fantasy_points_2025")) {
    console.log(
      "Column doesn't exist. Please run this SQL in your Supabase dashboard:\n\n" +
        "  ALTER TABLE nfl_players ADD COLUMN IF NOT EXISTS fantasy_points_2025 numeric NOT NULL DEFAULT 0;\n\n" +
        "Then re-run this script."
    );
    return;
  }
  console.log("Column exists.\n");

  // Reset all points to 0
  await supabase.from("nfl_players").update({ fantasy_points_2025: 0 }).neq("id", 0);

  // Fetch all 2024 postseason stats (paginated)
  console.log("Fetching 2025 postseason stats from BDL...");
  const allStats: Array<{ player_id: number; stats: Record<string, unknown>; position: string }> = [];
  let cursor: string | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = new URL(`${BDL_BASE}/season_stats`);
    url.searchParams.set("season", "2025");
    url.searchParams.set("postseason", "true");
    url.searchParams.set("per_page", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetchPaced(url.toString());
    const json = await res.json();

    for (const s of json.data) {
      const player = s.player as Record<string, unknown>;
      allStats.push({
        player_id: player.id as number,
        stats: s,
        position: (player.position_abbreviation as string) ?? "UNK",
      });
    }

    cursor = json.meta?.next_cursor;
    if (!cursor) break;
  }

  console.log(`  Fetched stats for ${allStats.length} players\n`);

  // Calculate fantasy points for each player
  const updates: Array<{ id: number; fantasy_points_2025: number }> = [];

  // Track defensive stats per team for DST
  const teamDefense: Record<number, { sacks: number; ints: number; fumRec: number; tds: number }> = {};

  for (const entry of allStats) {
    const { player_id, stats, position } = entry;
    const teamData = stats.player as Record<string, unknown>;

    if (position === "K" || position === "PK") {
      const pts = calcKickerPoints(stats);
      if (pts > 0) updates.push({ id: player_id, fantasy_points_2025: pts });
    } else if (["QB", "RB", "WR", "TE", "FB"].includes(position)) {
      const pts = calcOffensivePoints(stats);
      if (pts !== 0) updates.push({ id: player_id, fantasy_points_2025: pts });
    }

    // Aggregate defensive stats for DST (from all defensive players)
    const sacks = n(stats.defensive_sacks);
    const ints = n(stats.defensive_interceptions);
    const fumRec = n(stats.fumbles_recovered);
    const tds = n(stats.fumbles_touchdowns) + n(stats.interception_touchdowns);

    if (sacks > 0 || ints > 0 || fumRec > 0 || tds > 0) {
      // Get this player's team_id from our DB
      const { data: dbPlayer } = await supabase
        .from("nfl_players")
        .select("team_id")
        .eq("id", player_id)
        .single();

      if (dbPlayer?.team_id) {
        const tid = dbPlayer.team_id;
        if (!teamDefense[tid])
          teamDefense[tid] = { sacks: 0, ints: 0, fumRec: 0, tds: 0 };
        teamDefense[tid].sacks += sacks;
        teamDefense[tid].ints += ints;
        teamDefense[tid].fumRec += fumRec;
        teamDefense[tid].tds += tds;
      }
    }
  }

  // Calculate DST fantasy points
  const DST_OFFSET = 100000;
  for (const [teamIdStr, def] of Object.entries(teamDefense)) {
    const teamId = Number(teamIdStr);
    const pts =
      def.sacks * SCORING.dst_sack +
      def.ints * SCORING.dst_int +
      def.fumRec * SCORING.dst_fum_rec +
      def.tds * SCORING.dst_td;

    if (pts > 0) {
      updates.push({
        id: teamId + DST_OFFSET,
        fantasy_points_2025: Math.round(pts * 100) / 100,
      });
    }
  }

  console.log(`Updating ${updates.length} players with fantasy points...`);

  // Batch upsert in chunks
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    for (const u of chunk) {
      await supabase
        .from("nfl_players")
        .update({ fantasy_points_2025: u.fantasy_points_2025 })
        .eq("id", u.id);
    }
  }

  // Show top players
  const { data: topPlayers } = await supabase
    .from("nfl_players")
    .select("name, position, fantasy_points_2025, nfl_teams(abbreviation)")
    .eq("is_active", true)
    .gt("fantasy_points_2025", 0)
    .order("fantasy_points_2025", { ascending: false })
    .limit(20);

  console.log("\n=== Top 20 Players by 2025 Playoff Fantasy Points ===");
  console.table(
    topPlayers?.map((p, i) => ({
      rank: i + 1,
      name: p.name,
      pos: p.position,
      team: (p.nfl_teams as unknown as { abbreviation: string })?.abbreviation,
      pts: p.fantasy_points_2025,
    }))
  );

  const { count } = await supabase
    .from("nfl_players")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .gt("fantasy_points_2025", 0);

  console.log(`\n${count} active players with fantasy points > 0`);
  console.log("Done!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
