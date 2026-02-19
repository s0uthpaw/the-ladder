"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { joinLeague, type ActionState } from "@/lib/actions/leagues";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
    >
      {pending ? "Joining..." : "Join League"}
    </button>
  );
}

export default function JoinLeaguePage() {
  const [state, action] = useActionState<ActionState, FormData>(
    joinLeague,
    undefined
  );

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-black dark:text-white">
        Join a League
      </h1>

      <form action={action} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="code"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Invite Code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            maxLength={8}
            placeholder="e.g. A7K9M2XP"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-widest text-black placeholder:text-zinc-400 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-white"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton />
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
