import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Test the active players endpoint
  const res = await fetch(
    "https://api.balldontlie.io/nfl/v1/players/active?per_page=10",
    { headers: { Authorization: process.env.BDL_API_KEY as string } }
  );
  console.log("Status:", res.status);
  const json = await res.json();
  console.log("Meta:", json.meta);
  console.log("\nFirst 5 players:");
  for (const p of json.data.slice(0, 5)) {
    console.log(
      `  ${p.first_name} ${p.last_name} | pos: ${p.position} | abbr: ${p.position_abbreviation} | team: ${p.team?.abbreviation}`
    );
  }

  // Check position abbreviation values
  const positions = new Set(json.data.map((p: { position_abbreviation: string }) => p.position_abbreviation));
  console.log("\nPositions in sample:", [...positions]);
}

main().catch(console.error);
