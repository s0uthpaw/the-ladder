import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Search BDL for known kickers to find what position abbreviation they use.
 */
async function main() {
  const headers = { Authorization: process.env.BDL_API_KEY as string };
  const kickers = ["Butker", "Tucker", "Bass", "McManus", "Boswell"];

  for (const name of kickers) {
    const res = await fetch(
      `https://api.balldontlie.io/nfl/v1/players?search=${name}&per_page=5`,
      { headers }
    );
    const json = await res.json();
    for (const p of json.data) {
      console.log(
        `${p.first_name} ${p.last_name} | pos: "${p.position_abbreviation}" | team: ${p.team?.abbreviation ?? "none"}`
      );
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
}

main().catch(console.error);
