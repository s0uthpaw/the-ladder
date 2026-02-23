import { config } from "dotenv";
config({ path: ".env.local" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const headers = { Authorization: process.env.BDL_API_KEY as string };

  // 2024 NFL season postseason = Jan/Feb 2025 playoffs
  // Test postseason=true parameter
  const urls = [
    "https://api.balldontlie.io/nfl/v1/season_stats?season=2024&postseason=true&per_page=5",
    "https://api.balldontlie.io/nfl/v1/season_stats?season=2024&postseason=false&per_page=3",
  ];

  for (const url of urls) {
    const label = url.includes("true") ? "POSTSEASON" : "REGULAR SEASON";
    console.log(`\n=== ${label} ===`);
    const res = await fetch(url, { headers });
    console.log(`Status: ${res.status}`);
    if (!res.ok) {
      console.log(await res.text());
      continue;
    }
    const json = await res.json();
    console.log(`Total items: ${json.meta?.total_count ?? "?"}, Page: ${json.data.length}`);
    for (const s of json.data) {
      const p = s.player;
      console.log(
        `  ${p.first_name} ${p.last_name} (${p.position_abbreviation}) ` +
        `| GP: ${s.games_played} | PassYd: ${s.passing_yards} | PassTD: ${s.passing_touchdowns} ` +
        `| RushYd: ${s.rushing_yards} | RushTD: ${s.rushing_touchdowns} ` +
        `| Rec: ${s.receptions} | RecYd: ${s.receiving_yards} | RecTD: ${s.receiving_touchdowns} ` +
        `| FGM: ${s.field_goals_made ?? 0} | XPM: ${s.extra_points_made ?? "?"} ` +
        `| Sacks: ${s.defensive_sacks} | INT: ${s.defensive_interceptions} | FumRec: ${s.fumbles_recovered}`
      );
    }
    await sleep(1000);
  }

  // Check pagination size
  console.log("\n=== Checking total postseason entries ===");
  await sleep(13000);
  const countRes = await fetch(
    "https://api.balldontlie.io/nfl/v1/season_stats?season=2024&postseason=true&per_page=100",
    { headers }
  );
  const countJson = await countRes.json();
  console.log(`Page 1: ${countJson.data.length} items`);
  console.log(`Has next_cursor: ${!!countJson.meta?.next_cursor}`);

  // Check if season_stats has extra_points_made (might be missing from field list)
  if (countJson.data.length > 0) {
    const kicker = countJson.data.find(
      (s: Record<string, unknown>) => {
        const p = s.player as Record<string, string>;
        return p.position_abbreviation === "K";
      }
    );
    if (kicker) {
      console.log("\n=== Sample kicker stats ===");
      console.log(JSON.stringify(kicker, null, 2).slice(0, 1000));
    }
  }
}

main().catch(console.error);
