"use client";

import { useState, useActionState } from "react";
import { deleteLeague, type ActionState } from "@/lib/actions/leagues";
import { SubmitButton } from "@/components/submit-button";

export function DeleteLeague({
  leagueId,
  leagueName,
}: {
  leagueId: string;
  leagueName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(
    deleteLeague,
    undefined
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete League
        </button>
      ) : (
        <div>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-black dark:text-white">
              {leagueName}
            </span>
            ? This will permanently remove the league, all members, draft data,
            rosters, and scores. This cannot be undone.
          </p>

          {state?.error && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}

          <form action={action} className="flex items-center gap-3">
            <input type="hidden" name="leagueId" value={leagueId} />
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Confirm Delete
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
