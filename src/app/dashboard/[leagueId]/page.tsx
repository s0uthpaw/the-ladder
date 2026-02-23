import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueDetail } from "@/lib/actions/leagues";
import { DraftSetup } from "./components/draft-setup";
import { DraftOrderPanel } from "./components/draft-order-panel";
import { DeleteLeague } from "./components/delete-league";

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const data = await getLeagueDetail(leagueId);

  if (!data) redirect("/dashboard");

  const { league, members, draft, currentUserRole, sport } = data;
  const isCommissioner = currentUserRole === "commissioner";
  const rosterSize = sport === "nba" ? 10 : 9;

  return (
    <div>
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        &larr; Back to Dashboard
      </Link>

      {/* League header */}
      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
            {league.name}
          </h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {league.sport.toUpperCase()}
          </span>
          {isCommissioner && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              Commissioner
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            {league.sport.toUpperCase()} &middot; {league.season} Season
          </span>
          <span>{members.length} Members</span>
          <span>{league.is_free ? "Free" : `$${league.buy_in_amount} Buy-in`}</span>
        </div>

        {isCommissioner && (
          <div className="mt-3">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Invite Code
            </span>
            <div className="mt-1 inline-block rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-1 font-mono text-sm tracking-wider text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {league.invite_code}
            </div>
          </div>
        )}
      </div>

      {/* Standings */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-black dark:text-white">
          Standings
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Rank
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Team
                </th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Active Players
                </th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {members.map((member, index) => {
                const profile = member.profiles as unknown as {
                  id: string;
                  display_name: string | null;
                  avatar_url: string | null;
                } | null;

                return (
                  <tr
                    key={member.id}
                    className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {profile?.avatar_url && (
                          <img
                            src={profile.avatar_url}
                            alt=""
                            className="h-6 w-6 rounded-full"
                          />
                        )}
                        <Link
                          href={`/dashboard/${leagueId}/team/${member.id}`}
                          className="font-medium text-black hover:underline dark:text-white"
                        >
                          {member.team_name || profile?.display_name || "Unknown"}
                        </Link>
                        {member.role === "commissioner" && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            Commish
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 dark:text-zinc-400">
                      {member.activePlayerCount}/{rosterSize}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {Number(member.total_points)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Draft section */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-black dark:text-white">
          Draft
        </h2>

        {!draft && isCommissioner && <DraftSetup leagueId={leagueId} />}

        {!draft && !isCommissioner && (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No draft has been set up yet. The commissioner will set it up.
            </p>
          </div>
        )}

        {draft?.status === "pre_draft" && (
          <DraftOrderPanel
            leagueId={leagueId}
            members={members}
            isCommissioner={isCommissioner}
          />
        )}

        {draft?.status === "in_progress" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Draft In Progress
              </span>
            </div>
            <Link
              href={`/dashboard/${leagueId}/draft`}
              className="inline-block rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Enter Draft Room
            </Link>
          </div>
        )}

        {draft?.status === "completed" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Draft Complete
              </span>
            </div>
            <div className="mt-3">
              <Link
                href={`/dashboard/${leagueId}/draft`}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                View Draft Results &rarr;
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Commissioner tools */}
      {isCommissioner && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-black dark:text-white">
            Commissioner Tools
          </h2>
          <DeleteLeague leagueId={leagueId} leagueName={league.name} />
        </section>
      )}
    </div>
  );
}
