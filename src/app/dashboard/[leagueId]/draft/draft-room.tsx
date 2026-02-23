"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { makePick, skipPick, refreshDraftState } from "@/lib/actions/draft";
import { getMemberDraftOrder, getTotalPicks } from "@/lib/utils/draft-order";
import { NBA_TOTAL_ROUNDS } from "@/lib/constants/nba-roster";
import { TOTAL_ROUNDS } from "@/lib/utils/draft-order";
import { DraftHeader } from "./draft-header";
import { PlayerPool } from "./player-pool";
import { MyRoster } from "./my-roster";
import { DraftBoard } from "./draft-board";
import { TeamRosters } from "./team-rosters";

type DraftRoomProps = {
  draft: {
    id: string;
    league_id: string;
    status: string;
    current_pick: number;
    seconds_per_pick: number;
    started_at: string;
    completed_at: string | null;
  };
  members: Array<{
    id: string;
    role: string;
    team_name: string | null;
    draft_order: number | null;
    profiles: unknown;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  picks: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  players: Array<Record<string, any>>;
  myRoster: Array<{
    id: string;
    slot: string;
    player_id: number;
  }>;
  allRosters: Array<{
    id: string;
    slot: string;
    player_id: number;
    league_member_id: string;
  }>;
  currentMember: {
    id: string;
    role: string;
    draft_order: number | null;
    team_name: string | null;
  };
  leagueId: string;
  sport: string;
};

type Tab = "pool" | "roster" | "teams" | "board";

export function DraftRoom({
  draft: initialDraft,
  members,
  picks: initialPicks,
  players,
  myRoster: initialRoster,
  allRosters: initialAllRosters,
  currentMember,
  leagueId,
  sport,
}: DraftRoomProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [picks, setPicks] = useState(initialPicks);
  const [myRoster, setMyRoster] = useState(initialRoster);
  const [allRosters, setAllRosters] = useState(initialAllRosters);
  const [activeTab, setActiveTab] = useState<Tab>("pool");
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberCount = members.length;

  // Who picks at the current pick number?
  const currentDraftOrder = getMemberDraftOrder(draft.current_pick, memberCount);
  const currentTurnMember = members.find(
    (m) => m.draft_order === currentDraftOrder
  );
  const isMyTurn =
    draft.status === "in_progress" &&
    currentMember.draft_order === currentDraftOrder;

  const currentTurnName = (() => {
    if (!currentTurnMember) return "Unknown";
    const profile = currentTurnMember.profiles as {
      display_name: string | null;
    } | null;
    return (
      currentTurnMember.team_name || profile?.display_name || "Unknown"
    );
  })();

  // Last pick time for timer
  const lastPickTime = useMemo(() => {
    if (picks.length === 0) return draft.started_at;
    return picks[picks.length - 1].picked_at;
  }, [picks, draft.started_at]);

  // Drafted player IDs set
  const draftedPlayerIds = useMemo(
    () => new Set(picks.map((p) => p.player_id)),
    [picks]
  );

  // Polling
  useEffect(() => {
    if (draft.status === "completed") return;

    const interval = setInterval(async () => {
      const fresh = await refreshDraftState(leagueId);
      if (fresh) {
        setDraft((prev) => ({ ...prev, ...fresh.draft }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPicks(fresh.picks as any);
        setMyRoster(fresh.myRoster);
        setAllRosters(fresh.allRosters);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [draft.status, leagueId]);

  // Handle making a pick
  const handleDraft = useCallback(
    async (playerId: number) => {
      if (!isMyTurn || isPicking) return;
      setIsPicking(true);
      setError(null);

      const result = await makePick(draft.id, playerId);

      if ("error" in result) {
        setError(result.error ?? "Failed to make pick");
      }
      // Polling will update state within 3s, but we can also force a refresh
      const fresh = await refreshDraftState(leagueId);
      if (fresh) {
        setDraft((prev) => ({ ...prev, ...fresh.draft }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPicks(fresh.picks as any);
        setMyRoster(fresh.myRoster);
        setAllRosters(fresh.allRosters);
      }

      setIsPicking(false);
    },
    [isMyTurn, isPicking, draft.id, leagueId]
  );

  // Handle timer expiry
  const handleTimerExpired = useCallback(async () => {
    await skipPick(draft.id);
    // Polling will pick up the state change
  }, [draft.id]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "pool", label: "Player Pool" },
    { key: "roster", label: "My Roster" },
    { key: "teams", label: "Teams" },
    { key: "board", label: "Draft Board" },
  ];

  // Completed state
  if (draft.status === "completed") {
    return (
      <div>
        <Link
          href={`/dashboard/${leagueId}`}
          className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to League
        </Link>

        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950/30">
          <h1 className="mb-2 text-xl font-bold text-green-800 dark:text-green-300">
            Draft Complete!
          </h1>
          <p className="text-sm text-green-700 dark:text-green-400">
            All picks are in. Check out the full draft board below.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href={`/dashboard/${leagueId}`}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Return to League
            </Link>
            <Link
              href={`/dashboard/${leagueId}/team/${currentMember.id}`}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              View My Team
            </Link>
          </div>
        </div>

        <DraftBoard
          picks={picks}
          members={members}
          currentMemberId={currentMember.id}
          currentPick={draft.current_pick + 1}
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/dashboard/${leagueId}`}
        className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        &larr; Back to League
      </Link>

      {/* Draft header with timer */}
      <div className="mb-4">
        <DraftHeader
          currentPick={draft.current_pick}
          memberCount={memberCount}
          currentTurnName={currentTurnName}
          isMyTurn={isMyTurn}
          secondsPerPick={draft.seconds_per_pick}
          lastPickTime={lastPickTime}
          draftStatus={draft.status}
          onTimerExpired={handleTimerExpired}
          sport={sport}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "pool" && (
        <PlayerPool
          players={players}
          draftedPlayerIds={draftedPlayerIds}
          isMyTurn={isMyTurn}
          onDraft={handleDraft}
          isPicking={isPicking}
          sport={sport}
        />
      )}

      {activeTab === "roster" && (
        <MyRoster roster={myRoster} players={players} sport={sport} />
      )}

      {activeTab === "teams" && (
        <TeamRosters
          members={members}
          allRosters={allRosters}
          players={players}
          currentMemberId={currentMember.id}
          sport={sport}
        />
      )}

      {activeTab === "board" && (
        <DraftBoard
          picks={picks}
          members={members}
          currentMemberId={currentMember.id}
          currentPick={draft.current_pick}
        />
      )}
    </div>
  );
}
