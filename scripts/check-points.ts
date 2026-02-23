import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SECRET_KEY as string
);

async function main() {
  // Check kicker points
  const { data: kickers } = await sb
    .from("nfl_players")
    .select("name, position, fantasy_points_2025, nfl_teams(abbreviation)")
    .eq("position", "K")
    .eq("is_active", true)
    .order("fantasy_points_2025", { ascending: false })
    .limit(10);
  console.log("=== Top Kickers ===");
  console.table(kickers);

  // Check DST points
  const { data: dsts } = await sb
    .from("nfl_players")
    .select("name, position, fantasy_points_2025")
    .eq("position", "DST")
    .eq("is_active", true)
    .order("fantasy_points_2025", { ascending: false })
    .limit(10);
  console.log("\n=== Top DSTs ===");
  console.table(dsts);

  // Count players with 0 points by position
  for (const pos of ["QB", "RB", "WR", "TE", "K", "DST"]) {
    const { count: zero } = await sb
      .from("nfl_players")
      .select("id", { count: "exact", head: true })
      .eq("position", pos)
      .eq("is_active", true)
      .eq("fantasy_points_2025", 0);
    const { count: nonzero } = await sb
      .from("nfl_players")
      .select("id", { count: "exact", head: true })
      .eq("position", pos)
      .eq("is_active", true)
      .gt("fantasy_points_2025", 0);
    console.log(`${pos}: ${nonzero} with points, ${zero} with 0`);
  }
}

main().catch(console.error);
