import Link from "next/link";
import { redirect } from "next/navigation";
import { getTeamDetail } from "@/lib/actions/leagues";
import {
  ROSTER_SLOTS,
  SLOT_LABELS,
  PLAYOFF_ROUNDS,
  ROUND_LABELS,
} from "@/lib/constants/roster";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string; memberId: string }>;
}) {
  const { leagueId, memberId } = await params;
  const data = await getTeamDetail(leagueId, memberId);

  if (!data) redirect(`/dashboard/${leagueId}`);

  const { member, roster, scores, leagueName } = data;

  const profile = member.profiles as unknown as {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;

  // Build a map of roster_slot → player info
  type RosterPlayer = {
    name: string;
    abbreviation: string;
    isEliminated: boolean;
    nflPlayerId: string;
  };
  const rosterMap = new Map<string, RosterPlayer>();
  for (const r of roster) {
    const player = r.nfl_players as unknown as {
      id: string;
      name: string;
      position: string;
      team_id: string;
      nfl_teams: { abbreviation: string; full_name: string; is_eliminated: boolean } | null;
    } | null;
    if (player) {
      rosterMap.set(r.roster_slot, {
        name: player.name,
        abbreviation: player.nfl_teams?.abbreviation ?? "???",
        isEliminated: player.nfl_teams?.is_eliminated ?? false,
        nflPlayerId: player.id,
      });
    }
  }

  // Build a map of nfl_player_id → { round → points }
  const scoreMap = new Map<string, Map<string, number>>();
  for (const s of scores) {
    const game = s.nfl_games as unknown as { round: string } | null;
    if (!game) continue;
    if (!scoreMap.has(s.nfl_player_id)) {
      scoreMap.set(s.nfl_player_id, new Map());
    }
    const playerScores = scoreMap.get(s.nfl_player_id)!;
    playerScores.set(
      game.round,
      (playerScores.get(game.round) ?? 0) + Number(s.points)
    );
  }

  // Calculate round totals for summary row
  const roundTotals: Record<string, number> = {};
  for (const round of PLAYOFF_ROUNDS) {
    roundTotals[round] = 0;
  }
  let grandTotal = 0;

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/dashboard/${leagueId}`}
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        &larr; Back to {leagueName}
      </Link>

      {/* Team header */}
      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          {profile?.avatar_url && (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-10 w-10 rounded-full"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
                {member.team_name || profile?.display_name || "Unknown"}
              </h1>
              {member.role === "commissioner" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  Commissioner
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {Number(member.total_points)} Total Points
            </p>
          </div>
        </div>
      </div>

      {/* Roster table */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-black dark:text-white">
          Roster
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Position
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Player
                </th>
                <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">
                  Active?
                </th>
                {PLAYOFF_ROUNDS.map((round) => (
                  <th
                    key={round}
                    className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    {ROUND_LABELS[round]}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ROSTER_SLOTS.map((slot) => {
                const player = rosterMap.get(slot);
                const playerScores = player
                  ? scoreMap.get(player.nflPlayerId)
                  : undefined;

                let playerTotal = 0;

                return (
                  <tr
                    key={slot}
                    className="bg-white dark:bg-zinc-950"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                      {SLOT_LABELS[slot]}
                    </td>
                    <td className="px-4 py-3 text-black dark:text-white">
                      {player ? (
                        <>
                          {player.name}{" "}
                          <span className="text-zinc-400 dark:text-zinc-500">
                            ({player.abbreviation})
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          &mdash;
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {player ? (
                        player.isEliminated ? (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"
                            title="Eliminated"
                          />
                        ) : (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full bg-green-500"
                            title="Active"
                          />
                        )
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          &mdash;
                        </span>
                      )}
                    </td>
                    {PLAYOFF_ROUNDS.map((round) => {
                      const pts = playerScores?.get(round);
                      if (pts !== undefined) {
                        playerTotal += pts;
                        roundTotals[round] += pts;
                        grandTotal += pts;
                      }
                      return (
                        <td
                          key={round}
                          className="px-4 py-3 text-right font-mono text-zinc-700 dark:text-zinc-300"
                        >
                          {pts !== undefined ? pts : (
                            <span className="text-zinc-400 dark:text-zinc-500">
                              &mdash;
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right font-mono font-semibold text-black dark:text-white">
                      {playerTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-3 font-semibold text-black dark:text-white"
                >
                  Total
                </td>
                {PLAYOFF_ROUNDS.map((round) => (
                  <td
                    key={round}
                    className="px-4 py-3 text-right font-mono font-semibold text-black dark:text-white"
                  >
                    {roundTotals[round]}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-mono font-bold text-black dark:text-white">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
