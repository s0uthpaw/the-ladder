import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const headers = { Authorization: process.env.BDL_API_KEY as string };

  const res = await fetch(
    "https://api.balldontlie.io/nfl/v1/season_stats?season=2025&postseason=true&per_page=5",
    { headers }
  );
  console.log("Status:", res.status);
  if (res.status !== 200) {
    console.log(await res.text());
    return;
  }
  const json = await res.json();
  console.log("Total items:", json.meta?.total_count ?? "?");
  console.log("Page:", json.data.length);
  for (const s of json.data) {
    const p = s.player;
    console.log(
      `  ${p.first_name} ${p.last_name} (${p.position_abbreviation}) | GP: ${s.games_played} | PassYd: ${s.passing_yards} | RushYd: ${s.rushing_yards} | RecYd: ${s.receiving_yards}`
    );
  }
}
main().catch(console.error);
