"use client";

import { useState, useActionState } from "react";
import { updateTeamProfile, type ActionState } from "@/lib/actions/leagues";
import { SubmitButton } from "@/components/submit-button";

export function EditTeamProfile({
  leagueId,
  memberId,
  currentTeamName,
  currentAvatarUrl,
}: {
  leagueId: string;
  memberId: string;
  currentTeamName: string;
  currentAvatarUrl: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, action] = useActionState<ActionState, FormData>(
    updateTeamProfile,
    undefined
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  const avatarSrc = preview ?? currentAvatarUrl;

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        title="Edit Profile"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5"
        >
          <path
            fillRule="evenodd"
            d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setExpanded(false); setPreview(null); }}>
          <div
            className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-sm font-semibold text-black dark:text-white">
              Edit Team Profile
            </h3>

            {state?.error && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            )}

            <form action={action} className="space-y-4">
              <input type="hidden" name="leagueId" value={leagueId} />
              <input type="hidden" name="memberId" value={memberId} />

              {/* Team name */}
              <div>
                <label
                  htmlFor="teamName"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Team Name
                </label>
                <input
                  id="teamName"
                  name="teamName"
                  type="text"
                  defaultValue={currentTeamName}
                  maxLength={100}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-zinc-500"
                />
              </div>

              {/* Avatar */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Avatar
                </label>
                <div className="flex items-center gap-3">
                  {avatarSrc && (
                    <img
                      src={avatarSrc}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <input
                    name="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  Max 2MB. JPG, PNG, or GIF.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <SubmitButton label="Save" pendingLabel="Saving..." />
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setPreview(null);
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
