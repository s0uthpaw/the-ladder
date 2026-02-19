"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/auth/sync-profile";
import { generateInviteCode } from "@/lib/utils/invite-code";

export type ActionState = { error?: string } | undefined;

// ---------------------------------------------------------------------------
// Create League
// ---------------------------------------------------------------------------
export async function createLeague(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await syncProfile();
  if (!profile) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "League name is required" };
  if (name.length > 100) return { error: "League name must be 100 characters or less" };

  const season = Number(formData.get("season")) || new Date().getFullYear();

  // Generate invite code with retry on collision
  let inviteCode = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode();
    const { data: existing } = await supabaseAdmin
      .from("leagues")
      .select("id")
      .eq("invite_code", code)
      .single();
    if (!existing) {
      inviteCode = code;
      break;
    }
  }
  if (!inviteCode) return { error: "Failed to generate invite code. Please try again." };

  // Insert league
  const { data: league, error: leagueErr } = await supabaseAdmin
    .from("leagues")
    .insert({
      name,
      sport: "nfl",
      season,
      invite_code: inviteCode,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (leagueErr) return { error: "Failed to create league" };

  // Insert creator as commissioner + default scoring settings
  const [memberResult, scoringResult] = await Promise.all([
    supabaseAdmin.from("league_members").insert({
      league_id: league.id,
      profile_id: profile.id,
      role: "commissioner",
    }),
    supabaseAdmin.from("scoring_settings").insert({
      league_id: league.id,
    }),
  ]);

  if (memberResult.error || scoringResult.error) {
    // Rollback: cascade will clean up league_members and scoring_settings
    await supabaseAdmin.from("leagues").delete().eq("id", league.id);
    return { error: "Failed to set up league. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Join League
// ---------------------------------------------------------------------------
export async function joinLeague(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await syncProfile();
  if (!profile) return { error: "Not authenticated" };

  const code = (formData.get("code") as string)?.trim().toUpperCase();
  if (!code) return { error: "Invite code is required" };

  // Look up league
  const { data: league } = await supabaseAdmin
    .from("leagues")
    .select("id, max_members")
    .eq("invite_code", code)
    .single();

  if (!league) return { error: "Invalid invite code" };

  // Check if already a member
  const { data: existing } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("profile_id", profile.id)
    .single();

  if (existing) return { error: "You are already a member of this league" };

  // Check member count
  const { count } = await supabaseAdmin
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id);

  if ((count ?? 0) >= league.max_members) return { error: "This league is full" };

  // Insert as member
  const { error: joinErr } = await supabaseAdmin
    .from("league_members")
    .insert({
      league_id: league.id,
      profile_id: profile.id,
      role: "member",
    });

  if (joinErr) return { error: "Failed to join league" };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Get User Leagues
// ---------------------------------------------------------------------------
export async function getUserLeagues() {
  const profile = await syncProfile();
  if (!profile) return [];

  // Get all memberships for this user
  const { data: memberships } = await supabaseAdmin
    .from("league_members")
    .select("league_id, role")
    .eq("profile_id", profile.id);

  if (!memberships || memberships.length === 0) return [];

  const leagueIds = memberships.map((m) => m.league_id);

  // Fetch leagues and member counts in parallel
  const [{ data: leagues }, { data: counts }] = await Promise.all([
    supabaseAdmin.from("leagues").select("*").in("id", leagueIds),
    supabaseAdmin
      .from("league_members")
      .select("league_id")
      .in("league_id", leagueIds),
  ]);

  if (!leagues) return [];

  // Build count map
  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.league_id] = (countMap[row.league_id] || 0) + 1;
  }

  // Build role map
  const roleMap: Record<string, string> = {};
  for (const m of memberships) {
    roleMap[m.league_id] = m.role;
  }

  return leagues.map((league) => ({
    ...league,
    role: roleMap[league.id] as "commissioner" | "member",
    memberCount: countMap[league.id] || 0,
  }));
}
