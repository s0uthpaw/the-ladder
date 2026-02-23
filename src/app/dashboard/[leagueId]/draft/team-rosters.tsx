"use client";

import { ROSTER_SLOTS, SLOT_LABELS } from "@/lib/constants/roster";
import { NBA_ROSTER_SLOTS, NBA_SLOT_LABELS } from "@/lib/constants/nba-roster";

type RosterEntry = {
  id: string;
  slot: string;
  player_id: number;
  league_member_id: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Player = Record<string, any>;

type Member = {
  id: string;
  team_name: string | null;
  draft_order: number | null;
  profiles: unknown;
};

export function TeamRosters({
  members,
  allRosters,
  players,
  currentMemberId,
  sport,
}: {
  members: Member[];
  allRosters: RosterEntry[];
  players: Player[];
  currentMemberId: string;
  sport: string;
}) {
  const isNba = sport === "nba";
  const slots = isNba ? NBA_ROSTER_SLOTS : ROSTER_SLOTS;
  const labels = isNba ? NBA_SLOT_LABELS : SLOT_LABELS;

  const getPlayerName = (p: Player) => p.name ?? `${p.first_name} ${p.last_name}`;
  const getTeamAbbr = (p: Player) => {
    const team = isNba ? p.nba_teams : p.nfl_teams;
    return team?.abbreviation ?? "???";
  };

  const playerMap = new Map<number, Player>();
  for (const p of players) {
    playerMap.set(p.id, p);
  }

  // Group rosters by member
  const rosterByMember = new Map<string, Map<string, Player>>();
  for (const entry of allRosters) {
    if (!rosterByMember.has(entry.league_member_id)) {
      rosterByMember.set(entry.league_member_id, new Map());
    }
    const player = playerMap.get(entry.player_id);
    if (player) {
      rosterByMember.get(entry.league_member_id)!.set(entry.slot, player);
    }
  }

  // Sort members by draft order
  const sorted = [...members].sort(
    (a, b) => (a.draft_order ?? 0) - (b.draft_order ?? 0)
  );

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((member) => {
        const profile = member.profiles as {
          display_name: string | null;
        } | null;
        const name =
          member.team_name || profile?.display_name || "Unknown";
        const isMe = member.id === currentMemberId;
        const slotMap = rosterByMember.get(member.id) ?? new Map();
        const filledCount = slotMap.size;

        return (
          <div
            key={member.id}
            className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
          >
            <div
              className={`flex items-center justify-between px-4 py-2 text-sm font-medium ${
                isMe
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              <span>
                {name}
                {isMe && " (You)"}
              </span>
              <span
                className={
                  isMe
                    ? "text-zinc-300 dark:text-zinc-600"
                    : "text-zinc-400 dark:text-zinc-500"
                }
              >
                {filledCount}/{slots.length}
              </span>
            </div>
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {slots.map((slot) => {
                  const player = slotMap.get(slot);
                  return (
                    <tr key={slot} className="bg-white dark:bg-zinc-950">
                      <td className="w-24 px-4 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {labels[slot]}
                      </td>
                      <td className="px-4 py-1.5 text-black dark:text-white">
                        {player ? (
                          <>
                            {getPlayerName(player)}{" "}
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">
                              {player.position} &middot;{" "}
                              {getTeamAbbr(player)}
                            </span>
                          </>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">
                            &mdash;
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
