import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SECRET_KEY as string
);

async function main() {
  // Step 1: Set ALL players to inactive
  const { error: e1 } = await sb
    .from("nfl_players")
    .update({ is_active: false })
    .neq("id", 0); // matches all rows

  if (e1) throw new Error(`Deactivate all failed: ${e1.message}`);
  console.log("Set all players to inactive");

  // Step 2: Reactivate only fantasy-relevant players (QB, RB, WR, TE, K, DST)
  const validPositions = ["QB", "RB", "WR", "TE", "K", "DST"];
  for (const pos of validPositions) {
    const { error } = await sb
      .from("nfl_players")
      .update({ is_active: true })
      .eq("position", pos);
    if (error) throw new Error(`Reactivate ${pos} failed: ${error.message}`);
  }
  console.log("Reactivated fantasy-relevant positions (QB, RB, WR, TE, K, DST)");

  // Step 3: Check counts
  const { count: active } = await sb
    .from("nfl_players")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: inactive } = await sb
    .from("nfl_players")
    .select("id", { count: "exact", head: true })
    .eq("is_active", false);

  console.log(`\nActive: ${active}, Inactive: ${inactive}`);

  // Step 4: Show position breakdown of active players
  const { data: sample } = await sb
    .from("nfl_players")
    .select("name, position, nfl_teams(abbreviation)")
    .eq("is_active", true)
    .limit(10);
  console.log("\nSample active players:");
  console.table(sample);
}

main().catch(console.error);
