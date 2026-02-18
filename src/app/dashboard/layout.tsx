import { syncProfile } from "@/lib/auth/sync-profile";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await syncProfile();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold tracking-tight text-black dark:text-white">
            The Ladder
          </span>
          {profile && (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {profile.display_name}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
