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

// ---------------------------------------------------------------------------
// Delete League
// ---------------------------------------------------------------------------
export async function deleteLeague(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await syncProfile();
  if (!profile) return { error: "Not authenticated" };

  const leagueId = formData.get("leagueId") as string;
  if (!leagueId) return { error: "League ID is required" };

  // Verify caller is commissioner
  const { data: membership } = await supabaseAdmin
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("profile_id", profile.id)
    .single();

  if (!membership || membership.role !== "commissioner") {
    return { error: "Only the commissioner can delete a league" };
  }

  const { error: deleteErr } = await supabaseAdmin
    .from("leagues")
    .delete()
    .eq("id", leagueId);

  if (deleteErr) return { error: "Failed to delete league" };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Get Team Detail
// ---------------------------------------------------------------------------
export async function getTeamDetail(leagueId: string, memberId: string) {
  const profile = await syncProfile();
  if (!profile) return null;

  // Verify the current user is a member of this league
  const { data: membership } = await supabaseAdmin
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("profile_id", profile.id)
    .single();

  if (!membership) return null;

  // Fetch member, roster, scores, and league name in parallel
  const [{ data: member }, { data: roster }, { data: scores }, { data: league }] =
    await Promise.all([
      supabaseAdmin
        .from("league_members")
        .select("id, role, team_name, total_points, draft_order, profiles(id, display_name, avatar_url)")
        .eq("id", memberId)
        .eq("league_id", leagueId)
        .single(),
      supabaseAdmin
        .from("roster_players")
        .select("id, slot, nfl_players(id, name, position, team_id, nfl_teams(abbreviation, full_name, is_eliminated))")
        .eq("league_member_id", memberId),
      supabaseAdmin
        .from("player_game_scores")
        .select("nfl_player_id, points, nfl_games(round)")
        .eq("league_id", leagueId),
      supabaseAdmin
        .from("leagues")
        .select("id, name")
        .eq("id", leagueId)
        .single(),
    ]);

  if (!member || !league) return null;

  // Determine if this is the current user's own team
  const memberProfile = member.profiles as unknown as { id: string } | null;
  const isOwnTeam = memberProfile?.id === profile.id;

  // Build a set of roster player IDs for filtering scores
  const rosterPlayerIds = new Set(
    (roster ?? [])
      .map((r) => {
        const player = r.nfl_players as unknown as { id: string } | null;
        return player?.id;
      })
      .filter(Boolean)
  );

  // Filter scores to only this team's players
  const teamScores = (scores ?? []).filter((s) =>
    rosterPlayerIds.has(s.nfl_player_id)
  );

  return {
    member,
    roster: roster ?? [],
    scores: teamScores,
    leagueName: league.name,
    isOwnTeam,
    memberProfileId: memberProfile?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Get League Detail
// ---------------------------------------------------------------------------
export async function getLeagueDetail(leagueId: string) {
  const profile = await syncProfile();
  if (!profile) return null;

  // Verify the current user is a member of this league
  const { data: membership } = await supabaseAdmin
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("profile_id", profile.id)
    .single();

  if (!membership) return null;

  // Fetch league, members (with profiles), and draft in parallel
  const [{ data: league }, { data: members }, { data: draft }] =
    await Promise.all([
      supabaseAdmin.from("leagues").select("*").eq("id", leagueId).single(),
      supabaseAdmin
        .from("league_members")
        .select("id, role, team_name, total_points, draft_order, profiles(id, display_name, avatar_url)")
        .eq("league_id", leagueId)
        .order("total_points", { ascending: false }),
      supabaseAdmin
        .from("drafts")
        .select("*")
        .eq("league_id", leagueId)
        .single(),
    ]);

  if (!league) return null;

  // Fetch roster player counts per member
  const memberIds = (members ?? []).map((m) => m.id);
  const { data: rosterEntries } = await supabaseAdmin
    .from("roster_players")
    .select("league_member_id")
    .in("league_member_id", memberIds);

  const rosterCountMap: Record<string, number> = {};
  for (const r of rosterEntries ?? []) {
    rosterCountMap[r.league_member_id] = (rosterCountMap[r.league_member_id] || 0) + 1;
  }

  return {
    league,
    members: (members ?? []).map((m) => ({
      ...m,
      activePlayerCount: rosterCountMap[m.id] || 0,
    })),
    draft,
    currentUserRole: membership.role as "commissioner" | "member",
  };
}

// ---------------------------------------------------------------------------
// Update Team Profile (name + avatar)
// ---------------------------------------------------------------------------
export async function updateTeamProfile(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await syncProfile();
  if (!profile) return { error: "Not authenticated" };

  const leagueId = formData.get("leagueId") as string;
  const memberId = formData.get("memberId") as string;
  const teamName = (formData.get("teamName") as string)?.trim();

  if (!leagueId || !memberId) return { error: "Missing required fields" };
  if (!teamName) return { error: "Team name is required" };
  if (teamName.length > 100) return { error: "Team name must be 100 characters or less" };

  // Verify the caller owns this membership
  const { data: member } = await supabaseAdmin
    .from("league_members")
    .select("id, profile_id")
    .eq("id", memberId)
    .eq("league_id", leagueId)
    .single();

  if (!member || member.profile_id !== profile.id) {
    return { error: "You can only edit your own team" };
  }

  // Handle avatar upload if provided
  const avatarFile = formData.get("avatar") as File | null;
  if (avatarFile && avatarFile.size > 0) {
    if (avatarFile.size > 2 * 1024 * 1024) {
      return { error: "Avatar must be under 2MB" };
    }

    const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${profile.id}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, avatarFile, {
        contentType: avatarFile.type,
        upsert: false,
      });

    if (uploadErr) return { error: "Failed to upload avatar" };

    const { data: urlData } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(path);

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", profile.id);

    if (profileErr) return { error: "Failed to update avatar" };
  }

  // Update team name
  const { error: nameErr } = await supabaseAdmin
    .from("league_members")
    .update({ team_name: teamName })
    .eq("id", memberId);

  if (nameErr) return { error: "Failed to update team name" };

  revalidatePath(`/dashboard/${leagueId}/team/${memberId}`);
  revalidatePath(`/dashboard/${leagueId}`);
}
