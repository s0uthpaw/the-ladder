"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  label = "Submit",
  pendingLabel = "Submitting...",
}: {
  label?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
