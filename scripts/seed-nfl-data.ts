import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const BDL_BASE = "https://api.balldontlie.io/nfl/v1";
const BDL_HEADERS: HeadersInit = {
  Authorization: process.env.BDL_API_KEY!,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// All-Star tier: 60 req/min. We pace at 1 req every 1.1s to stay safe.
const MIN_REQUEST_GAP = 1100;
let lastRequestAt = 0;

async function fetchWithRetry(url: string, headers: HeadersInit, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    // Enforce minimum gap between requests
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_REQUEST_GAP) {
      await sleep(MIN_REQUEST_GAP - elapsed);
    }
    lastRequestAt = Date.now();

    let res: Response;
    try {
      res = await fetch(url, { headers });
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
    throw new Error(`API error: ${res.status}`);
  }
  throw new Error("Max retries exceeded");
}

// Fantasy-relevant positions. FB maps to RB. PK (placekicker) maps to K.
const POSITION_MAP: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  PK: "K",
};

// ---------------------------------------------------------------------------
// Seed Teams
// ---------------------------------------------------------------------------
async function seedTeams() {
  console.log("Fetching NFL teams...");
  const res = await fetchWithRetry(`${BDL_BASE}/teams`, BDL_HEADERS);

  const { data: teams } = await res.json();
  console.log(`  Found ${teams.length} teams`);

  const rows = teams.map((t: Record<string, unknown>) => ({
    id: t.id,
    abbreviation: t.abbreviation,
    full_name: t.full_name,
    conference: t.conference,
    division: t.division,
  }));

  const { error } = await supabase.from("nfl_teams").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Teams upsert failed: ${error.message}`);

  console.log(`  Upserted ${rows.length} teams`);
  return teams;
}

// ---------------------------------------------------------------------------
// Seed Players — per-team to get only current roster players
// ---------------------------------------------------------------------------
async function seedPlayers(teams: Array<{ id: number; abbreviation: string }>) {
  console.log("Fetching players by team (current rosters only)...\n");

  let totalInserted = 0;

  for (const team of teams) {
    const batch: Record<string, unknown>[] = [];
    let cursor: string | null = null;

    // Paginate through all players on this team
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const url = new URL(`${BDL_BASE}/players`);
      url.searchParams.set("per_page", "100");
      url.searchParams.append("team_ids[]", String(team.id));
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetchWithRetry(url.toString(), BDL_HEADERS);
      const json = await res.json();

      for (const p of json.data) {
        const abbr = p.position_abbreviation as string;
        const mappedPos = POSITION_MAP[abbr];
        // Skip non-fantasy positions (LB, DE, DT, CB, S, P, LS, UNK, etc.)
        if (!mappedPos) continue;

        batch.push({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          position: mappedPos,
          team_id: team.id,
          is_active: true,
        });
      }

      cursor = json.meta?.next_cursor;
      if (!cursor) break;
    }

    if (batch.length > 0) {
      const { error } = await supabase.from("nfl_players").upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`Players upsert failed for ${team.abbreviation}: ${error.message}`);
      totalInserted += batch.length;
    }

    console.log(`  ${team.abbreviation}: ${batch.length} players (${totalInserted} total)`);
  }

  console.log(`\n  Upserted ${totalInserted} fantasy-relevant players total`);
}

// ---------------------------------------------------------------------------
// Seed DST Entries
// ---------------------------------------------------------------------------
async function seedDST(teams: Array<{ id: number; full_name: string }>) {
  console.log("Creating DST synthetic players...");

  const DST_OFFSET = 100000;
  const rows = teams.map((t) => ({
    id: t.id + DST_OFFSET,
    name: `${t.full_name} DST`,
    position: "DST",
    team_id: t.id,
    is_active: true,
  }));

  const { error } = await supabase.from("nfl_players").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`DST upsert failed: ${error.message}`);

  console.log(`  Upserted ${rows.length} DST entries`);
}

// ---------------------------------------------------------------------------
// Clean up stale players from previous seeds
// ---------------------------------------------------------------------------
async function deactivateOldPlayers() {
  // Set ALL to inactive first, then reactivate only fantasy-relevant positions.
  // This avoids Supabase's default 1000-row select limit.
  await supabase.from("nfl_players").update({ is_active: false }).neq("id", 0);

  const validPositions = ["QB", "RB", "WR", "TE", "K", "DST"];
  for (const pos of validPositions) {
    await supabase.from("nfl_players").update({ is_active: true }).eq("position", pos);
  }

  const { count } = await supabase
    .from("nfl_players")
    .select("id", { count: "exact", head: true })
    .eq("is_active", false);
  console.log(`  Deactivated ${count ?? 0} stale/non-fantasy players`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== NFL Data Seed ===\n");

  const teams = await seedTeams();
  await seedPlayers(teams);
  await seedDST(teams);

  await deactivateOldPlayers();

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
