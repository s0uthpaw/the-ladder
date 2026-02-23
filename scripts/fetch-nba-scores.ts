import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const BDL_BASE = "https://api.balldontlie.io/v1";
const BDL_HEADERS: HeadersInit = {
  Authorization: process.env.BDL_API_KEY!,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MIN_REQUEST_GAP = 1100;
let lastRequestAt = 0;

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_REQUEST_GAP) {
      await sleep(MIN_REQUEST_GAP - elapsed);
    }
    lastRequestAt = Date.now();

    let res: Response;
    try {
      res = await fetch(url, { headers: BDL_HEADERS });
    } catch (err) {
      console.log(`  Network error, retrying in 10s... (${(err as Error).message})`);
      await sleep(10000);
      continue;
    }
    if (res.ok) return res;
    if (res.status === 429) {
      console.log(`  Rate limited, waiting 60s...`);
      await sleep(60000);
      continue;
    }
    throw new Error(`API error: ${res.status} ${res.statusText} — ${url}`);
  }
  throw new Error("Max retries exceeded");
}

// NBA scoring formula
const SCORING = {
  pts: 1.0,
  reb: 1.2,
  ast: 1.5,
  stl: 3.0,
  blk: 3.0,
  turnover: -1.0,
};

function calcFantasyPoints(stats: {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
}): number {
  return (
    stats.pts * SCORING.pts +
    stats.reb * SCORING.reb +
    stats.ast * SCORING.ast +
    stats.stl * SCORING.stl +
    stats.blk * SCORING.blk +
    stats.turnover * SCORING.turnover
  );
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Fetch Games for last N days
// ---------------------------------------------------------------------------
async function fetchGames(days: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  console.log(`Fetching NBA games from ${start} to ${end}...`);

  const allGames: Record<string, unknown>[] = [];
  let cursor: string | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = new URL(`${BDL_BASE}/games`);
    url.searchParams.set("start_date", start);
    url.searchParams.set("end_date", end);
    url.searchParams.set("per_page", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetchWithRetry(url.toString());
    const json = await res.json();

    allGames.push(...json.data);
    cursor = json.meta?.next_cursor;
    if (!cursor) break;
  }

  console.log(`  Found ${allGames.length} games`);

  // Upsert games
  const gameRows = allGames.map((g: Record<string, unknown>) => {
    const homeTeam = g.home_team as Record<string, unknown>;
    const visitorTeam = g.visitor_team as Record<string, unknown>;
    return {
      id: g.id,
      season: g.season,
      home_team_id: homeTeam.id,
      visitor_team_id: visitorTeam.id,
      home_team_score: g.home_team_score,
      visitor_team_score: g.visitor_team_score,
      status: g.status,
      date: (g.date as string).split("T")[0],
    };
  });

  if (gameRows.length > 0) {
    const { error } = await supabase.from("nba_games").upsert(gameRows, { onConflict: "id" });
    if (error) throw new Error(`Games upsert failed: ${error.message}`);
    console.log(`  Upserted ${gameRows.length} games`);
  }

  // Return only final games for stats fetching
  return allGames
    .filter((g: Record<string, unknown>) => g.status === "Final")
    .map((g: Record<string, unknown>) => g.id as number);
}

// ---------------------------------------------------------------------------
// Fetch Box Scores (player stats) per game
// ---------------------------------------------------------------------------
async function fetchBoxScores(gameIds: number[]) {
  console.log(`\nFetching box scores for ${gameIds.length} completed games...`);

  let totalStats = 0;

  // BDL stats endpoint: /stats?game_ids[]=...
  // Process in batches of 10 games
  const BATCH_SIZE = 10;

  for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
    const batch = gameIds.slice(i, i + BATCH_SIZE);
    let cursor: string | null = null;
    const batchStats: Record<string, unknown>[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const url = new URL(`${BDL_BASE}/stats`);
      for (const gid of batch) {
        url.searchParams.append("game_ids[]", String(gid));
      }
      url.searchParams.set("per_page", "100");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetchWithRetry(url.toString());
      const json = await res.json();

      batchStats.push(...json.data);
      cursor = json.meta?.next_cursor;
      if (!cursor) break;
    }

    // Build upsert rows
    const rows = batchStats
      .filter((s: Record<string, unknown>) => {
        // Only include players who actually played (have minutes)
        const min = s.min as string | null;
        return min && min !== "00" && min !== "0:00" && min !== "";
      })
      .map((s: Record<string, unknown>) => {
        const player = s.player as Record<string, unknown>;
        const game = s.game as Record<string, unknown>;
        const pts = Number(s.pts) || 0;
        const reb = Number(s.reb) || 0;
        const ast = Number(s.ast) || 0;
        const stl = Number(s.stl) || 0;
        const blk = Number(s.blk) || 0;
        const turnover = Number(s.turnover) || 0;

        const fantasyPts = calcFantasyPoints({ pts, reb, ast, stl, blk, turnover });

        return {
          player_id: player.id,
          game_id: game.id,
          pts,
          reb,
          ast,
          stl,
          blk,
          turnover,
          min: s.min as string,
          fantasy_points: Math.round(fantasyPts * 10) / 10,
        };
      });

    if (rows.length > 0) {
      const { error } = await supabase
        .from("nba_player_game_stats")
        .upsert(rows, { onConflict: "player_id,game_id" });
      if (error) {
        console.log(`  Warning: stats upsert batch error: ${error.message}`);
      } else {
        totalStats += rows.length;
      }
    }

    console.log(`  Processed games ${i + 1}-${Math.min(i + BATCH_SIZE, gameIds.length)} (${totalStats} stat lines so far)`);
  }

  console.log(`  Upserted ${totalStats} stat lines total`);
}

// ---------------------------------------------------------------------------
// Update league member total points for NBA leagues
// ---------------------------------------------------------------------------
async function updateLeaguePoints() {
  console.log("\nUpdating NBA league member total points...");

  // Get all NBA leagues
  const { data: nbaLeagues } = await supabase
    .from("leagues")
    .select("id")
    .eq("sport", "nba");

  if (!nbaLeagues || nbaLeagues.length === 0) {
    console.log("  No NBA leagues found");
    return;
  }

  for (const league of nbaLeagues) {
    // Get all members with their rosters
    const { data: members } = await supabase
      .from("league_members")
      .select("id")
      .eq("league_id", league.id);

    if (!members) continue;

    for (const member of members) {
      // Get roster player IDs
      const { data: rosterEntries } = await supabase
        .from("nba_roster_players")
        .select("player_id")
        .eq("league_member_id", member.id);

      if (!rosterEntries || rosterEntries.length === 0) continue;

      const playerIds = rosterEntries.map((r) => r.player_id);

      // Sum fantasy points across all games
      const { data: stats } = await supabase
        .from("nba_player_game_stats")
        .select("fantasy_points")
        .in("player_id", playerIds);

      const totalPoints = (stats ?? []).reduce(
        (sum, s) => sum + Number(s.fantasy_points),
        0
      );

      await supabase
        .from("league_members")
        .update({ total_points: Math.round(totalPoints * 10) / 10 })
        .eq("id", member.id);
    }

    console.log(`  Updated points for league ${league.id}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== NBA Scores Fetch ===\n");

  const gameIds = await fetchGames(3);

  if (gameIds.length > 0) {
    await fetchBoxScores(gameIds);
  } else {
    console.log("\nNo completed games to process");
  }

  await updateLeaguePoints();

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
