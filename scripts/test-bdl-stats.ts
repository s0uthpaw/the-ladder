import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const headers = { Authorization: process.env.BDL_API_KEY as string };

  // Try season stats endpoint
  const endpoints = [
    "https://api.balldontlie.io/nfl/v1/season_stats?season=2025&postseason=true&per_page=5",
    "https://api.balldontlie.io/nfl/v1/stats?season=2025&postseason=true&per_page=5",
    "https://api.balldontlie.io/nfl/v1/player_season_stats?season=2025&per_page=5",
    "https://api.balldontlie.io/nfl/v1/games?season=2025&postseason=true&per_page=5",
  ];

  for (const url of endpoints) {
    console.log(`\n--- ${url.split("/v1/")[1]} ---`);
    const res = await fetch(url, { headers });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const json = await res.json();
      console.log("Keys:", Object.keys(json));
      if (json.data?.length > 0) {
        console.log("First item:", JSON.stringify(json.data[0], null, 2).slice(0, 500));
      } else {
        console.log("Empty data array");
      }
    } else {
      const text = await res.text();
      console.log("Response:", text.slice(0, 200));
    }
  }
}

main().catch(console.error);
