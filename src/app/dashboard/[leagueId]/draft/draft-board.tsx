"use client";

import { useEffect, useRef, useMemo } from "react";
import { getMemberDraftOrder, getRound } from "@/lib/utils/draft-order";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pick = Record<string, any>;

type Member = {
  id: string;
  team_name: string | null;
  draft_order: number | null;
  profiles: unknown;
};

type BoardRow = {
  pickNumber: number;
  round: number;
  memberName: string;
  memberId: string | null;
  playerName: string;
  position: string;
  isSkipped: boolean;
};

function getPickPlayerInfo(pick: Pick): { name: string; position: string } {
  // Try NFL first, then NBA
  const nfl = pick.nfl_players;
  const nba = pick.nba_players;
  if (nfl) return { name: nfl.name ?? "Unknown", position: nfl.position ?? "—" };
  if (nba) return { name: nba.name ?? `${nba.first_name} ${nba.last_name}`, position: nba.position ?? "—" };
  return { name: "Unknown", position: "—" };
}

export function DraftBoard({
  picks,
  members,
  currentMemberId,
  currentPick,
}: {
  picks: Pick[];
  members: Member[];
  currentMemberId: string;
  currentPick: number;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  // Build member maps
  const memberByOrder = new Map<number, Member>();
  for (const m of members) {
    if (m.draft_order !== null) memberByOrder.set(m.draft_order, m);
  }

  // Build pick map by pick_number
  const pickMap = new Map<number, Pick>();
  for (const p of picks) {
    pickMap.set(p.pick_number, p);
  }

  // Build board rows for all completed picks (including skips)
  const rows: BoardRow[] = useMemo(() => {
    const result: BoardRow[] = [];
    const memberCount = members.length;

    for (let pn = 1; pn < currentPick; pn++) {
      const pick = pickMap.get(pn);
      const round = getRound(pn, memberCount);
      const draftOrder = getMemberDraftOrder(pn, memberCount);
      const member = memberByOrder.get(draftOrder);
      const profile = member?.profiles as { display_name: string | null } | null;
      const memberName = member
        ? member.team_name || profile?.display_name || "Unknown"
        : "Unknown";

      if (pick) {
        const { name, position } = getPickPlayerInfo(pick);
        result.push({
          pickNumber: pn,
          round,
          memberName,
          memberId: pick.league_member_id,
          playerName: name,
          position,
          isSkipped: false,
        });
      } else {
        result.push({
          pickNumber: pn,
          round,
          memberName,
          memberId: member?.id ?? null,
          playerName: "Skipped",
          position: "—",
          isSkipped: true,
        });
      }
    }
    return result;
  }, [picks, currentPick, members.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows.length]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No picks yet. The draft is just getting started!
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
              Pick
            </th>
            <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
              Rd
            </th>
            <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
              Team
            </th>
            <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
              Player
            </th>
            <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
              Pos
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => {
            const isMine = row.memberId === currentMemberId;
            return (
              <tr
                key={row.pickNumber}
                className={
                  row.isSkipped
                    ? "bg-zinc-50 dark:bg-zinc-900"
                    : isMine
                      ? "bg-blue-50 dark:bg-blue-950/30"
                      : "bg-white dark:bg-zinc-950"
                }
              >
                <td className="px-3 py-2 font-mono text-zinc-500 dark:text-zinc-400">
                  {row.pickNumber}
                </td>
                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                  {row.round}
                </td>
                <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                  {row.memberName}
                </td>
                <td
                  className={`px-3 py-2 ${
                    row.isSkipped
                      ? "italic text-zinc-400 dark:text-zinc-500"
                      : "text-black dark:text-white"
                  }`}
                >
                  {row.playerName}
                </td>
                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                  {row.position}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div ref={endRef} />
    </div>
  );
}
