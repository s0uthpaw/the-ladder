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
    if (res.status === 400) {
      // Some player IDs may be invalid for this endpoint — return empty
      console.log(`  400 Bad Request (skipping batch)`);
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
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

// ---------------------------------------------------------------------------
// Seed Teams
// ---------------------------------------------------------------------------
async function seedTeams() {
  console.log("Fetching NBA teams...");
  const res = await fetchWithRetry(`${BDL_BASE}/teams`);
  const { data: teams } = await res.json();
  console.log(`  Found ${teams.length} teams`);

  const rows = teams.map((t: Record<string, unknown>) => ({
    id: t.id,
    abbreviation: t.abbreviation,
    full_name: t.full_name,
    conference: t.conference,
    division: t.division,
  }));

  const { error } = await supabase.from("nba_teams").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Teams upsert failed: ${error.message}`);

  console.log(`  Upserted ${rows.length} teams`);
  return teams;
}

// ---------------------------------------------------------------------------
// Seed Players (paginated, all active)
// ---------------------------------------------------------------------------
async function seedPlayers(teams: Array<{ id: number; abbreviation: string }>) {
  console.log("Fetching NBA players by team...\n");

  let totalInserted = 0;

  for (const team of teams) {
    const batch: Record<string, unknown>[] = [];
    let cursor: string | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const url = new URL(`${BDL_BASE}/players`);
      url.searchParams.set("per_page", "100");
      url.searchParams.append("team_ids[]", String(team.id));
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetchWithRetry(url.toString());
      const json = await res.json();

      for (const p of json.data) {
        // Skip players with no position
        if (!p.position) continue;

        batch.push({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          position: p.position,
          team_id: team.id,
          is_active: true,
        });
      }

      cursor = json.meta?.next_cursor;
      if (!cursor) break;
    }

    if (batch.length > 0) {
      const { error } = await supabase.from("nba_players").upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`Players upsert failed for ${team.abbreviation}: ${error.message}`);
      totalInserted += batch.length;
    }

    console.log(`  ${team.abbreviation}: ${batch.length} players (${totalInserted} total)`);
  }

  console.log(`\n  Upserted ${totalInserted} NBA players total`);
}

// ---------------------------------------------------------------------------
// Seed Season Averages → fantasy_avg_pts
// ---------------------------------------------------------------------------
async function seedSeasonAverages() {
  console.log("\nFetching season averages for fantasy ranking...");

  // Get all active player IDs (paginate past Supabase 1000-row default)
  const allActive: { id: number }[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data: batch, error: batchErr } = await supabase
      .from("nba_players")
      .select("id")
      .eq("is_active", true)
      .range(from, from + PAGE - 1);
    if (batchErr) throw new Error(`Failed to fetch players: ${batchErr.message}`);
    if (!batch || batch.length === 0) break;
    allActive.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  const activePlayers = allActive;
  const fetchErr = null;

  if (fetchErr) throw new Error(`Failed to fetch players: ${fetchErr.message}`);
  if (!activePlayers || activePlayers.length === 0) {
    console.log("  No active players found");
    return;
  }

  console.log(`  Processing ${activePlayers.length} active players...`);

  // BDL season_averages uses singular player_id param — one request per player
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < activePlayers.length; i++) {
    const pid = activePlayers[i].id;
    const url = `${BDL_BASE}/season_averages?season=2024&player_id=${pid}`;
    const res = await fetchWithRetry(url);
    const { data: averages } = await res.json();

    if (averages && averages.length > 0) {
      const avg = averages[0];
      const fantasyPts = calcFantasyPoints({
        pts: avg.pts ?? 0,
        reb: avg.reb ?? 0,
        ast: avg.ast ?? 0,
        stl: avg.stl ?? 0,
        blk: avg.blk ?? 0,
        turnover: avg.turnover ?? 0,
      });

      const rounded = Math.round(fantasyPts * 10) / 10;

      const { error } = await supabase
        .from("nba_players")
        .update({ fantasy_avg_pts: rounded })
        .eq("id", pid);

      if (error) {
        console.log(`  Warning: failed to update player ${pid}: ${error.message}`);
      } else {
        updated++;
      }
    } else {
      skipped++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  Processed ${i + 1}/${activePlayers.length} (${updated} updated, ${skipped} no data)...`);
    }
  }

  console.log(`  Updated fantasy_avg_pts for ${updated} players (${skipped} had no season data)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== NBA Data Seed ===\n");

  const teams = await seedTeams();
  await seedPlayers(teams);
  await seedSeasonAverages();

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
