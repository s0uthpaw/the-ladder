"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/auth/sync-profile";
import {
  getMemberDraftOrder,
  getRound,
  getTotalPicks,
  TOTAL_ROUNDS,
} from "@/lib/utils/draft-order";
import { assignSlot } from "@/lib/utils/roster-slots";
import { assignNbaSlot } from "@/lib/utils/nba-roster-slots";
import { NBA_TOTAL_ROUNDS } from "@/lib/constants/nba-roster";

export type ActionState = { error?: string } | undefined;

// ---------------------------------------------------------------------------
// Create Draft
// ---------------------------------------------------------------------------
export async function createDraft(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await syncProfile();
  if (!profile) return { error: "Not authenticated" };

  const leagueId = formData.get("leagueId") as string;

  // Commissioner check
  const { data: membership } = await supabaseAdmin
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("profile_id", profile.id)
    .single();

  if (membership?.role !== "commissioner")
    return { error: "Only the commissioner can set up the draft" };

  const secondsRaw = Number(formData.get("seconds_per_pick")) || 90;
  const seconds_per_pick = Math.min(300, Math.max(30, secondsRaw));

  const { error } = await supabaseAdmin.from("drafts").insert({
    league_id: leagueId,
    status: "pre_draft",
    type: "live",
    seconds_per_pick,
  });

  if (error) {
    // UNIQUE constraint on league_id means draft already exists
    if (error.code === "23505")
      return { error: "A draft already exists for this league" };
    return { error: "Failed to create draft" };
  }

  revalidatePath(`/dashboard/${leagueId}`);
  return undefined;
}

// ---------------------------------------------------------------------------
// Randomize Draft Order
// ---------------------------------------------------------------------------
export async function randomizeDraftOrder(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await syncProfile();
  if (!profile) return { error: "Not authenticated" };

  const leagueId = formData.get("leagueId") as string;

  // Commissioner check
  const { data: membership } = await supabaseAdmin
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("profile_id", profile.id)
    .single();

  if (membership?.role !== "commissioner")
    return { error: "Only the commissioner can randomize draft order" };

  // Fetch all members
  const { data: members } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId);

  if (!members || members.length < 2)
    return { error: "Need at least 2 members to set draft order" };

  // Fisher-Yates shuffle
  const shuffled = [...members];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Update each member's draft_order (1-indexed)
  const updates = shuffled.map((m, idx) =>
    supabaseAdmin
      .from("league_members")
      .update({ draft_order: idx + 1 })
      .eq("id", m.id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: "Failed to update draft order" };

  revalidatePath(`/dashboard/${leagueId}`);
  return undefined;
}

// ---------------------------------------------------------------------------
// Start Draft
// ---------------------------------------------------------------------------
export async function startDraft(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await syncProfile();
  if (!profile) return { error: "Not authenticated" };

  const leagueId = formData.get("leagueId") as string;

  // Commissioner check
  const { data: membership } = await supabaseAdmin
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("profile_id", profile.id)
    .single();

  if (membership?.role !== "commissioner")
    return { error: "Only the commissioner can start the draft" };

  // Validate draft exists and is pre_draft
  const { data: draft } = await supabaseAdmin
    .from("drafts")
    .select("id, status")
    .eq("league_id", leagueId)
    .single();

  if (!draft) return { error: "No draft exists for this league" };
  if (draft.status !== "pre_draft")
    return { error: "Draft has already been started" };

  // Validate all members have draft_order and league has ≥2 members
  const { data: members } = await supabaseAdmin
    .from("league_members")
    .select("id, draft_order")
    .eq("league_id", leagueId);

  if (!members || members.length < 2)
    return { error: "Need at least 2 members to start the draft" };

  const missingOrder = members.some(
    (m) => m.draft_order === null || m.draft_order === undefined
  );
  if (missingOrder)
    return { error: "All members must have a draft order. Randomize the order first." };

  // Start the draft
  const { error } = await supabaseAdmin
    .from("drafts")
    .update({
      status: "in_progress",
      current_pick: 1,
      started_at: new Date().toISOString(),
    })
    .eq("id", draft.id);

  if (error) return { error: "Failed to start draft" };

  redirect(`/dashboard/${leagueId}/draft`);
}

// ---------------------------------------------------------------------------
// Get Draft Room Data
// ---------------------------------------------------------------------------
export async function getDraftRoomData(leagueId: string) {
  const profile = await syncProfile();
  if (!profile) return null;

  // Verify membership
  const { data: currentMember } = await supabaseAdmin
    .from("league_members")
    .select("id, role, draft_order, team_name")
    .eq("league_id", leagueId)
    .eq("profile_id", profile.id)
    .single();

  if (!currentMember) return null;

  // Fetch draft, members, and league sport
  const [{ data: draft }, { data: members }, { data: league }] = await Promise.all([
    supabaseAdmin
      .from("drafts")
      .select("*")
      .eq("league_id", leagueId)
      .single(),
    supabaseAdmin
      .from("league_members")
      .select(
        "id, role, team_name, draft_order, profiles(id, display_name, avatar_url)"
      )
      .eq("league_id", leagueId)
      .order("draft_order", { ascending: true }),
    supabaseAdmin
      .from("leagues")
      .select("sport")
      .eq("id", leagueId)
      .single(),
  ]);

  if (!draft || !league) return null;

  const sport = league.sport as string;
  const isNba = sport === "nba";

  // Sport-specific queries
  const picksTable = isNba ? "nba_draft_picks" : "draft_picks";
  const playersTable = isNba ? "nba_players" : "nfl_players";
  const rosterTable = isNba ? "nba_roster_players" : "roster_players";
  const playerRelation = isNba ? "nba_players(id, first_name, last_name, name, position)" : "nfl_players(id, name, position)";

  // Fetch picks, players, and my roster
  const [{ data: draftPicks }, { data: players }, { data: myRoster }] = await Promise.all([
    supabaseAdmin
      .from(picksTable)
      .select(`id, pick_number, round, league_member_id, player_id, picked_at, ${playerRelation}`)
      .eq("draft_id", draft.id)
      .order("pick_number", { ascending: true }),
    isNba
      ? supabaseAdmin
          .from("nba_players")
          .select("id, first_name, last_name, name, position, team_id, fantasy_avg_pts, nba_teams(abbreviation)")
          .eq("is_active", true)
          .limit(2000)
      : supabaseAdmin
          .from("nfl_players")
          .select("id, name, position, team_id, fantasy_points_2025, nfl_teams(abbreviation)")
          .eq("is_active", true)
          .limit(2000),
    supabaseAdmin
      .from(rosterTable)
      .select("id, slot, player_id")
      .eq("league_member_id", currentMember.id),
  ]);

  // Fetch all members' rosters for the Teams tab
  const memberIds = (members ?? []).map((m) => m.id);
  const { data: allRosters } = await supabaseAdmin
    .from(rosterTable)
    .select("id, slot, player_id, league_member_id")
    .in("league_member_id", memberIds);

  return {
    draft,
    members: members ?? [],
    picks: draftPicks ?? [],
    players: players ?? [],
    myRoster: myRoster ?? [],
    allRosters: allRosters ?? [],
    currentMember,
    leagueId,
    sport,
  };
}

// ---------------------------------------------------------------------------
// Make Pick
// ---------------------------------------------------------------------------
export async function makePick(draftId: string, playerId: number) {
  const profile = await syncProfile();
  if (!profile) return { error: "Not authenticated" };

  // Fetch draft
  const { data: draft } = await supabaseAdmin
    .from("drafts")
    .select("id, league_id, status, current_pick, seconds_per_pick")
    .eq("id", draftId)
    .single();

  if (!draft) return { error: "Draft not found" };
  if (draft.status !== "in_progress") return { error: "Draft is not in progress" };

  // Verify membership and get draft_order
  const { data: currentMember } = await supabaseAdmin
    .from("league_members")
    .select("id, draft_order")
    .eq("league_id", draft.league_id)
    .eq("profile_id", profile.id)
    .single();

  if (!currentMember) return { error: "Not a member of this league" };

  // Get member count
  const { count: memberCount } = await supabaseAdmin
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", draft.league_id);

  if (!memberCount) return { error: "Could not determine league size" };

  // Check it's this user's turn
  const expectedOrder = getMemberDraftOrder(draft.current_pick, memberCount);
  if (currentMember.draft_order !== expectedOrder)
    return { error: "It's not your turn" };

  // Determine sport
  const { data: league } = await supabaseAdmin
    .from("leagues")
    .select("sport")
    .eq("id", draft.league_id)
    .single();

  const isNba = league?.sport === "nba";
  const picksTable = isNba ? "nba_draft_picks" : "draft_picks";
  const playersTable = isNba ? "nba_players" : "nfl_players";
  const rosterTable = isNba ? "nba_roster_players" : "roster_players";
  const rounds = isNba ? NBA_TOTAL_ROUNDS : TOTAL_ROUNDS;

  // Check player not already drafted
  const { data: existingPick } = await supabaseAdmin
    .from(picksTable)
    .select("id")
    .eq("draft_id", draftId)
    .eq("player_id", playerId)
    .single();

  if (existingPick) return { error: "Player already drafted" };

  // Get player position for slot assignment
  const { data: player } = await supabaseAdmin
    .from(playersTable)
    .select("id, position")
    .eq("id", playerId)
    .single();

  if (!player) return { error: "Player not found" };

  // Get current roster to determine slot
  const { data: currentRoster } = await supabaseAdmin
    .from(rosterTable)
    .select("slot")
    .eq("league_member_id", currentMember.id);

  const filledSlots = new Set((currentRoster ?? []).map((r) => r.slot));
  const round = getRound(draft.current_pick, memberCount);
  const slot = isNba
    ? assignNbaSlot(player.position, filledSlots, round)
    : assignSlot(player.position, filledSlots, round);
  if (!slot) return { error: `No available roster slot for ${player.position}` };
  const totalPicks = getTotalPicks(memberCount, rounds);

  // Insert pick + roster entry
  const [pickResult, rosterResult] = await Promise.all([
    supabaseAdmin.from(picksTable).insert({
      draft_id: draftId,
      league_member_id: currentMember.id,
      player_id: playerId,
      round,
      pick_number: draft.current_pick,
      picked_at: new Date().toISOString(),
    }),
    supabaseAdmin.from(rosterTable).insert({
      league_member_id: currentMember.id,
      player_id: playerId,
      slot,
    }),
  ]);

  if (pickResult.error) {
    // Handle unique constraint violations gracefully
    if (pickResult.error.code === "23505")
      return { error: "Pick already made (concurrent conflict)" };
    return { error: "Failed to record pick" };
  }

  if (rosterResult.error) return { error: "Failed to add player to roster" };

  // Advance draft
  const nextPick = draft.current_pick + 1;
  if (nextPick > totalPicks) {
    // Draft complete
    await supabaseAdmin
      .from("drafts")
      .update({
        status: "completed",
        current_pick: draft.current_pick,
        completed_at: new Date().toISOString(),
      })
      .eq("id", draftId);
  } else {
    await supabaseAdmin
      .from("drafts")
      .update({ current_pick: nextPick })
      .eq("id", draftId);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Skip Pick (timer expired) — auto-drafts best available player
// ---------------------------------------------------------------------------
export async function skipPick(draftId: string) {
  const profile = await syncProfile();
  if (!profile) return { error: "Not authenticated" };

  // Fetch draft
  const { data: draft } = await supabaseAdmin
    .from("drafts")
    .select("id, league_id, status, current_pick, seconds_per_pick, started_at")
    .eq("id", draftId)
    .single();

  if (!draft) return { error: "Draft not found" };
  if (draft.status !== "in_progress") return { error: "Draft is not in progress" };

  // Verify caller is a member
  const { data: membership } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", draft.league_id)
    .eq("profile_id", profile.id)
    .single();

  if (!membership) return { error: "Not a member of this league" };

  // Validate elapsed time
  const { data: lastPick } = await supabaseAdmin
    .from("draft_picks")
    .select("picked_at")
    .eq("draft_id", draftId)
    .order("pick_number", { ascending: false })
    .limit(1)
    .single();

  const referenceTime = lastPick?.picked_at ?? draft.started_at;
  const elapsed =
    (Date.now() - new Date(referenceTime).getTime()) / 1000;

  if (elapsed < draft.seconds_per_pick)
    return { error: "Timer has not expired yet" };

  // Get member count and determine whose turn it is
  const { data: members } = await supabaseAdmin
    .from("league_members")
    .select("id, draft_order")
    .eq("league_id", draft.league_id);

  if (!members || members.length < 2)
    return { error: "Could not determine league members" };

  const memberCount = members.length;
  const currentDraftOrder = getMemberDraftOrder(draft.current_pick, memberCount);
  const pickingMember = members.find((m) => m.draft_order === currentDraftOrder);

  if (!pickingMember) return { error: "Could not determine picking member" };

  // Determine sport
  const { data: league } = await supabaseAdmin
    .from("leagues")
    .select("sport")
    .eq("id", draft.league_id)
    .single();

  const isNba = league?.sport === "nba";
  const picksTable = isNba ? "nba_draft_picks" : "draft_picks";
  const playersTable = isNba ? "nba_players" : "nfl_players";
  const rosterTable = isNba ? "nba_roster_players" : "roster_players";
  const rounds = isNba ? NBA_TOTAL_ROUNDS : TOTAL_ROUNDS;
  const pointsCol = isNba ? "fantasy_avg_pts" : "fantasy_points_2025";

  // Get already-drafted player IDs
  const { data: existingPicks } = await supabaseAdmin
    .from(picksTable)
    .select("player_id")
    .eq("draft_id", draftId);

  const draftedIds = new Set((existingPicks ?? []).map((p) => p.player_id));

  // Get this member's current roster slots
  const { data: currentRoster } = await supabaseAdmin
    .from(rosterTable)
    .select("slot")
    .eq("league_member_id", pickingMember.id);

  const filledSlots = new Set((currentRoster ?? []).map((r) => r.slot));

  const round = getRound(draft.current_pick, memberCount);

  // Find best available player that fits an open slot
  const { data: bestPlayers } = await supabaseAdmin
    .from(playersTable)
    .select(`id, position, ${pointsCol}`)
    .eq("is_active", true)
    .order(pointsCol, { ascending: false })
    .limit(1000);

  let chosenPlayer: { id: number; position: string } | null = null;
  let chosenSlot: string | null = null;

  for (const player of bestPlayers ?? []) {
    if (draftedIds.has(player.id)) continue;
    const slot = isNba
      ? assignNbaSlot(player.position, filledSlots, round)
      : assignSlot(player.position, filledSlots, round);
    if (slot) {
      chosenPlayer = player;
      chosenSlot = slot;
      break;
    }
  }
  const totalPicks = getTotalPicks(memberCount, rounds);

  // If we found a player, auto-draft them
  if (chosenPlayer && chosenSlot) {
    const [pickResult, rosterResult] = await Promise.all([
      supabaseAdmin.from(picksTable).insert({
        draft_id: draftId,
        league_member_id: pickingMember.id,
        player_id: chosenPlayer.id,
        round,
        pick_number: draft.current_pick,
        picked_at: new Date().toISOString(),
      }),
      supabaseAdmin.from(rosterTable).insert({
        league_member_id: pickingMember.id,
        player_id: chosenPlayer.id,
        slot: chosenSlot,
      }),
    ]);

    if (pickResult.error?.code === "23505" || rosterResult.error) {
      // Concurrent conflict — another client already handled this pick
      return { success: true };
    }
  }
  // If no player found (all slots full), just advance without picking

  // Advance draft
  const nextPick = draft.current_pick + 1;
  if (nextPick > totalPicks) {
    await supabaseAdmin
      .from("drafts")
      .update({
        status: "completed",
        current_pick: draft.current_pick,
        completed_at: new Date().toISOString(),
      })
      .eq("id", draftId);
  } else {
    await supabaseAdmin
      .from("drafts")
      .update({ current_pick: nextPick })
      .eq("id", draftId);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Refresh Draft State (lightweight polling)
// ---------------------------------------------------------------------------
export async function refreshDraftState(leagueId: string) {
  const profile = await syncProfile();
  if (!profile) return null;

  const { data: currentMember } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("profile_id", profile.id)
    .single();

  if (!currentMember) return null;

  // Determine sport
  const { data: league } = await supabaseAdmin
    .from("leagues")
    .select("sport")
    .eq("id", leagueId)
    .single();

  const isNba = league?.sport === "nba";
  const picksTable = isNba ? "nba_draft_picks" : "draft_picks";
  const rosterTable = isNba ? "nba_roster_players" : "roster_players";
  const playerRelation = isNba ? "nba_players(id, first_name, last_name, name, position)" : "nfl_players(id, name, position)";

  const [{ data: draft }, { data: myRoster }] = await Promise.all([
    supabaseAdmin
      .from("drafts")
      .select("id, status, current_pick, seconds_per_pick, started_at, completed_at")
      .eq("league_id", leagueId)
      .single(),
    supabaseAdmin
      .from(rosterTable)
      .select("id, slot, player_id")
      .eq("league_member_id", currentMember.id),
  ]);

  if (!draft) return null;

  const { data: draftPicks } = await supabaseAdmin
    .from(picksTable)
    .select(`id, pick_number, round, league_member_id, player_id, picked_at, ${playerRelation}`)
    .eq("draft_id", draft.id)
    .order("pick_number", { ascending: true });

  // Fetch all members' rosters
  const { data: allMembers } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId);

  const memberIds = (allMembers ?? []).map((m) => m.id);
  const { data: allRosters } = await supabaseAdmin
    .from(rosterTable)
    .select("id, slot, player_id, league_member_id")
    .in("league_member_id", memberIds);

  return {
    draft,
    picks: draftPicks ?? [],
    myRoster: myRoster ?? [],
    allRosters: allRosters ?? [],
    currentMemberId: currentMember.id,
  };
}
