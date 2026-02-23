"use client";

import { useActionState } from "react";
import { createDraft, type ActionState } from "@/lib/actions/draft";
import { SubmitButton } from "@/components/submit-button";

export function DraftSetup({ leagueId }: { leagueId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    createDraft,
    undefined
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-semibold text-black dark:text-white">
        Set Up Draft
      </h3>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="leagueId" value={leagueId} />

        <div>
          <label
            htmlFor="seconds_per_pick"
            className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            Seconds per Pick
          </label>
          <input
            id="seconds_per_pick"
            name="seconds_per_pick"
            type="number"
            defaultValue={90}
            min={30}
            max={300}
            step={10}
            className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <SubmitButton label="Create Draft" pendingLabel="Creating..." />
      </form>
    </div>
  );
}
