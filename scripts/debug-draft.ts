import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SECRET_KEY as string
);

async function main() {
  // Sample players
  const { data: sample } = await sb
    .from("nfl_players")
    .select("id, name, position, team_id, is_active")
    .limit(20);
  console.log("=== Sample players ===");
  console.table(sample);

  // Position distribution
  const { data: all } = await sb.from("nfl_players").select("position");
  const counts: Record<string, number> = {};
  for (const p of all ?? []) {
    counts[p.position ?? "NULL"] = (counts[p.position ?? "NULL"] || 0) + 1;
  }
  console.log("\n=== Position distribution ===");
  console.table(counts);

  // Check what BDL API actually returns for one player
  const res = await fetch(
    "https://api.balldontlie.io/nfl/v1/players?per_page=5",
    { headers: { Authorization: process.env.BDL_API_KEY as string } }
  );
  const json = await res.json();
  console.log("\n=== Raw BDL API response (first 2 players) ===");
  console.log(JSON.stringify(json.data.slice(0, 2), null, 2));

  // Draft state
  const { data: draft } = await sb.from("drafts").select("*").single();
  console.log("\n=== Draft ===");
  console.log(draft);

  // Draft picks
  const { data: picks } = await sb.from("draft_picks").select("*");
  console.log("\n=== Draft picks ===", picks?.length ?? 0, "picks");
  if (picks && picks.length > 0) console.log(picks);
}

main().catch(console.error);
