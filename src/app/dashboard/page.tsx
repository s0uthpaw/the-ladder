import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getUserLeagues } from "@/lib/actions/leagues";

export default async function DashboardPage() {
  const leagues = await getUserLeagues();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
          My Leagues
        </h1>
        <UserButton />
      </div>

      <div className="mb-6 flex gap-3">
        <Link
          href="/dashboard/create"
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Create League
        </Link>
        <Link
          href="/dashboard/join"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Join League
        </Link>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">
            You&apos;re not in any leagues yet. Create one or join with an
            invite code.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {leagues.map((league) => (
            <div
              key={league.id}
              className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-black dark:text-white">
                  {league.name}
                </h2>
                {league.role === "commissioner" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    Commissioner
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                <span>
                  {league.sport.toUpperCase()} &middot; {league.season} Season
                </span>
                <span>
                  {league.memberCount} / {league.max_members} Members
                </span>
                <span className="font-mono text-xs tracking-wider">
                  Code: {league.invite_code}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
