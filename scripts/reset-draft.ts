import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SECRET_KEY as string
);

async function main() {
  const targetName = process.argv[2];

  // List all leagues
  const { data: leagues } = await sb.from("leagues").select("id, name");
  if (!leagues || leagues.length === 0) {
    console.log("No leagues found.");
    return;
  }

  // Pick target league
  const league = targetName
    ? leagues.find((l) => l.name.toLowerCase().includes(targetName.toLowerCase()))
    : leagues.length === 1
      ? leagues[0]
      : null;

  if (!league) {
    console.log("Please specify a league name. Available leagues:");
    for (const l of leagues) console.log(`  - ${l.name}`);
    return;
  }

  console.log(`Resetting draft for: ${league.name}\n`);

  // Find the draft for this league
  const { data: draft } = await sb
    .from("drafts")
    .select("id, status")
    .eq("league_id", league.id)
    .single();

  if (!draft) {
    console.log("No draft found for this league.");
    return;
  }

  console.log(`Draft: ${draft.id} (${draft.status})`);

  // Delete draft picks
  const { count: pickCount } = await sb
    .from("draft_picks")
    .delete()
    .eq("draft_id", draft.id);
  console.log(`Deleted ${pickCount ?? 0} draft picks`);

  // Delete roster players for all members of this league
  const { data: members } = await sb
    .from("league_members")
    .select("id")
    .eq("league_id", league.id);

  for (const m of members ?? []) {
    await sb.from("roster_players").delete().eq("league_member_id", m.id);
  }
  console.log(`Cleared rosters for ${members?.length ?? 0} members`);

  // Delete the draft itself
  await sb.from("drafts").delete().eq("id", draft.id);
  console.log("Deleted draft record");

  // Reset draft_order on members
  for (const m of members ?? []) {
    await sb.from("league_members").update({ draft_order: null }).eq("id", m.id);
  }
  console.log("Reset draft_order on all members");

  console.log("\nDone! You can now set up a new draft from the league page.");
}

main().catch(console.error);
