import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function main() {
  // Find all leagues
  const { data: leagues } = await supabase
    .from("leagues")
    .select("id, name, max_members");

  if (!leagues || leagues.length === 0) {
    console.log("No leagues found.");
    return;
  }

  console.log("Leagues:");
  for (const l of leagues) {
    const { count } = await supabase
      .from("league_members")
      .select("id", { count: "exact", head: true })
      .eq("league_id", l.id);
    console.log(`  - ${l.name} (${count}/${l.max_members} members) [${l.id}]`);
  }

  // Use first league (or pass league name as arg)
  const targetName = process.argv[2];
  const league = targetName
    ? leagues.find((l) => l.name.toLowerCase().includes(targetName.toLowerCase()))
    : leagues[0];

  if (!league) {
    console.log(`\nNo league matching "${targetName}".`);
    return;
  }

  const botCount = Number(process.argv[3]) || 1;
  console.log(`\nAdding ${botCount} bot(s) to: ${league.name}`);

  const botNames = ["Bot Alpha", "Bot Bravo", "Bot Charlie", "Bot Delta", "Bot Echo"];

  for (let i = 0; i < botCount; i++) {
    const name = botNames[i] ?? `Bot ${i + 1}`;
    const fakeClerkId = `fake_${Date.now()}_${i}`;
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .insert({
        clerk_id: fakeClerkId,
        display_name: name,
      })
      .select("id")
      .single();

    if (profileErr) {
      console.error(`Failed to create profile for ${name}:`, profileErr.message);
      continue;
    }

    const { error: memberErr } = await supabase.from("league_members").insert({
      league_id: league.id,
      profile_id: profile.id,
      role: "member",
      team_name: `${name}'s Team`,
    });

    if (memberErr) {
      console.error(`Failed to add ${name}:`, memberErr.message);
      continue;
    }

    console.log(`  Added "${name}" (${name}'s Team)`);
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
