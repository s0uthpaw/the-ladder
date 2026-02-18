import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center gap-6 pt-12">
      <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
        Welcome to The Ladder
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Leagues and drafts coming soon.
      </p>
      <UserButton />
    </div>
  );
}
