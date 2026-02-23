import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Quick diagnostic: fetch one team's players from BDL and log all position_abbreviation values.
 * This helps identify what abbreviation BDL uses for kickers (K vs PK etc).
 */
async function main() {
  const headers = { Authorization: process.env.BDL_API_KEY as string };

  // Fetch team 1's players (or whichever is first)
  const res = await fetch(
    "https://api.balldontlie.io/nfl/v1/players?team_ids[]=1&per_page=100",
    { headers }
  );
  if (!res.ok) {
    console.error(`API error: ${res.status}`);
    return;
  }
  const json = await res.json();

  const positionCounts: Record<string, number> = {};
  for (const p of json.data) {
    const pos = p.position_abbreviation ?? "null";
    positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    // Log kicker-like entries specifically
    if (["K", "PK", "P", "P/K"].includes(pos)) {
      console.log(`  KICKER FOUND: ${p.first_name} ${p.last_name} — position: "${pos}"`);
    }
  }

  console.log("\nPosition counts for team_id=1:");
  console.table(positionCounts);
  console.log(`Total players: ${json.data.length}`);
}

main().catch(console.error);
