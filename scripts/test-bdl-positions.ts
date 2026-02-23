import { config } from "dotenv";
config({ path: ".env.local" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const headers = { Authorization: process.env.BDL_API_KEY as string };

  // Check a few pages across the ID range to understand position data
  // Low IDs = older players, high IDs = newer players
  const urls = [
    "https://api.balldontlie.io/nfl/v1/players?per_page=5&cursor=0",
    // Try fetching by specific team to get current roster
    "https://api.balldontlie.io/nfl/v1/players?per_page=20&team_ids[]=15", // KC Chiefs
  ];

  for (const url of urls) {
    console.log(`\n--- ${url} ---`);
    await sleep(13000);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.log("Status:", res.status, await res.text());
      continue;
    }
    const json = await res.json();
    console.log(`  ${json.data.length} players, next_cursor: ${json.meta?.next_cursor}`);
    for (const p of json.data.slice(0, 10)) {
      console.log(
        `  ${p.id} | ${p.first_name} ${p.last_name} | pos_abbr: "${p.position_abbreviation}" | pos: "${p.position}" | team: ${p.team?.abbreviation ?? "NONE"}`
      );
    }

    // Collect position_abbreviation values
    const abbrs = json.data.map((p: Record<string, string>) => p.position_abbreviation);
    console.log("  Abbreviations:", [...new Set(abbrs)]);
  }
}

main().catch(console.error);
