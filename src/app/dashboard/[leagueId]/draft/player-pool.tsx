"use client";

import { useState, useMemo } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Player = Record<string, any>;

type SortKey = "name" | "pts";
type SortDir = "asc" | "desc";

const NFL_POSITION_FILTERS = ["All", "QB", "RB", "WR", "TE", "K", "DST"] as const;
const NBA_POSITION_FILTERS = ["All", "G", "F", "C"] as const;

export function PlayerPool({
  players,
  draftedPlayerIds,
  isMyTurn,
  onDraft,
  isPicking,
  sport,
}: {
  players: Player[];
  draftedPlayerIds: Set<number>;
  isMyTurn: boolean;
  onDraft: (playerId: number) => void;
  isPicking: boolean;
  sport: string;
}) {
  const isNba = sport === "nba";
  const posFilters = isNba ? NBA_POSITION_FILTERS : NFL_POSITION_FILTERS;

  const [posFilter, setPosFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("pts");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const getPlayerName = (p: Player) => p.name ?? `${p.first_name} ${p.last_name}`;
  const getPlayerPts = (p: Player) => isNba ? (p.fantasy_avg_pts ?? 0) : (p.fantasy_points_2025 ?? 0);
  const getTeamAbbr = (p: Player) => {
    const team = isNba ? p.nba_teams : p.nfl_teams;
    return team?.abbreviation ?? "—";
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "pts" ? "desc" : "asc");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    const result = players.filter((p) => {
      if (draftedPlayerIds.has(p.id)) return false;
      if (posFilter !== "All") {
        if (isNba) {
          // NBA positions can be compound: G, F, C, G-F, F-C, etc.
          if (!p.position?.includes(posFilter)) return false;
        } else {
          if (p.position !== posFilter) return false;
        }
      }
      const name = getPlayerName(p);
      if (searchLower && !name.toLowerCase().includes(searchLower)) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sortKey === "pts") {
        const diff = getPlayerPts(a) - getPlayerPts(b);
        return sortDir === "asc" ? diff : -diff;
      }
      const cmp = getPlayerName(a).localeCompare(getPlayerName(b));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [players, draftedPlayerIds, posFilter, search, sortKey, sortDir, isNba]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-white"
      />

      {/* Position filter */}
      <div className="flex flex-wrap gap-1.5">
        {posFilters.map((pos) => (
          <button
            key={pos}
            onClick={() => setPosFilter(pos)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              posFilter === pos
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Player list */}
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th
                onClick={() => handleSort("name")}
                className="cursor-pointer select-none px-3 py-2 font-medium text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white"
              >
                Player{sortIndicator("name")}
              </th>
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                Pos
              </th>
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                Team
              </th>
              <th
                onClick={() => handleSort("pts")}
                className="cursor-pointer select-none px-3 py-2 text-right font-medium text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white"
              >
                {isNba ? "Avg" : "Pts"}{sortIndicator("pts")}
              </th>
              {isMyTurn && (
                <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.slice(0, 100).map((player) => (
              <tr
                key={player.id}
                className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <td className="px-3 py-2 text-black dark:text-white">
                  {getPlayerName(player)}
                </td>
                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                  {player.position}
                </td>
                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                  {getTeamAbbr(player)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {getPlayerPts(player) > 0
                    ? getPlayerPts(player).toFixed(1)
                    : "—"}
                </td>
                {isMyTurn && (
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onDraft(player.id)}
                      disabled={isPicking}
                      className="rounded bg-black px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      Draft
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No players found
          </div>
        )}
        {filtered.length > 100 && (
          <div className="px-4 py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Showing first 100 of {filtered.length} — use search or filters to narrow
          </div>
        )}
      </div>
    </div>
  );
}
