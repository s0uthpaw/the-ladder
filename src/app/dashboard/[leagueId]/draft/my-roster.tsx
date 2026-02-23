"use client";

import { ROSTER_SLOTS, SLOT_LABELS } from "@/lib/constants/roster";
import { NBA_ROSTER_SLOTS, NBA_SLOT_LABELS } from "@/lib/constants/nba-roster";

type RosterEntry = {
  id: string;
  slot: string;
  player_id: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Player = Record<string, any>;

export function MyRoster({
  roster,
  players,
  sport,
}: {
  roster: RosterEntry[];
  players: Player[];
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

  // Build a map: slot → player info
  const playerMap = new Map<number, Player>();
  for (const p of players) {
    playerMap.set(p.id, p);
  }

  const slotMap = new Map<string, Player>();
  for (const entry of roster) {
    const player = playerMap.get(entry.player_id);
    if (player) slotMap.set(entry.slot, player);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
              Slot
            </th>
            <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
              Player
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {slots.map((slot) => {
            const player = slotMap.get(slot);
            return (
              <tr key={slot} className="bg-white dark:bg-zinc-950">
                <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                  {labels[slot]}
                </td>
                <td className="px-4 py-3 text-black dark:text-white">
                  {player ? (
                    <>
                      {getPlayerName(player)}{" "}
                      <span className="text-zinc-400 dark:text-zinc-500">
                        ({getTeamAbbr(player)})
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500">
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
}
