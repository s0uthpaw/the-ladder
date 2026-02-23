import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const headers = { Authorization: process.env.BDL_API_KEY as string };
  console.log("API key prefix:", (process.env.BDL_API_KEY as string).slice(0, 12) + "...");

  // Test various stats endpoint patterns
  const endpoints = [
    // Season stats
    "https://api.balldontlie.io/nfl/v1/season_stats?season=2024&per_page=3",
    // Player stats per game
    "https://api.balldontlie.io/nfl/v1/stats?per_page=3",
    // Try without season filter
    "https://api.balldontlie.io/nfl/v1/season_stats?per_page=3",
    // Try with player_id
    "https://api.balldontlie.io/nfl/v1/season_stats?player_ids[]=71&per_page=3",
  ];

  for (const url of endpoints) {
    const path = url.split("/v1/")[1];
    console.log(`\n--- ${path} ---`);
    const res = await fetch(url, { headers });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const json = await res.json();
      if (json.data?.length > 0) {
        console.log("First item keys:", Object.keys(json.data[0]));
        console.log(JSON.stringify(json.data[0], null, 2).slice(0, 800));
      } else {
        console.log("Empty data");
      }
    } else {
      console.log(await res.text());
    }
  }
}

main().catch(console.error);
