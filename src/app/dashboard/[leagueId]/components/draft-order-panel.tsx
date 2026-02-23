"use client";

import { useActionState } from "react";
import {
  randomizeDraftOrder,
  startDraft,
  type ActionState,
} from "@/lib/actions/draft";
import { SubmitButton } from "@/components/submit-button";

type Member = {
  id: string;
  role: string;
  team_name: string | null;
  draft_order: number | null;
  total_points: number;
  profiles: unknown;
};

export function DraftOrderPanel({
  leagueId,
  members,
  isCommissioner,
}: {
  leagueId: string;
  members: Member[];
  isCommissioner: boolean;
}) {
  const [randomizeState, randomizeAction] = useActionState<
    ActionState,
    FormData
  >(randomizeDraftOrder, undefined);

  const [startState, startAction] = useActionState<ActionState, FormData>(
    startDraft,
    undefined
  );

  const ordered = [...members].sort(
    (a, b) => (a.draft_order ?? 999) - (b.draft_order ?? 999)
  );

  const allHaveOrder = members.every(
    (m) => m.draft_order !== null && m.draft_order !== undefined
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-block h-2 w-2 rounded-full bg-zinc-400" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Pre-Draft
        </span>
      </div>

      {/* Draft order list */}
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Draft Order
        </h3>
        <ol className="space-y-1">
          {ordered.map((member) => {
            const profile = member.profiles as {
              display_name: string | null;
            } | null;

            return (
              <li
                key={member.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm"
              >
                <span className="w-6 text-right font-mono text-zinc-400 dark:text-zinc-500">
                  {member.draft_order ?? "—"}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {member.team_name || profile?.display_name || "Unknown"}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Commissioner controls */}
      {isCommissioner && (
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <form action={randomizeAction}>
            <input type="hidden" name="leagueId" value={leagueId} />
            <SubmitButton
              label="Randomize Order"
              pendingLabel="Shuffling..."
            />
          </form>

          <form action={startAction}>
            <input type="hidden" name="leagueId" value={leagueId} />
            <button
              type="submit"
              disabled={!allHaveOrder}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600"
            >
              Start Draft
            </button>
          </form>

          {randomizeState?.error && (
            <p className="w-full text-sm text-red-600 dark:text-red-400">
              {randomizeState.error}
            </p>
          )}
          {startState?.error && (
            <p className="w-full text-sm text-red-600 dark:text-red-400">
              {startState.error}
            </p>
          )}
          {!allHaveOrder && (
            <p className="w-full text-xs text-zinc-400 dark:text-zinc-500">
              Randomize the order before starting the draft.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
