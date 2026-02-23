"use client";

import { useEffect, useState, useCallback } from "react";
import { getRound, getTotalPicks, TOTAL_ROUNDS } from "@/lib/utils/draft-order";
import { NBA_TOTAL_ROUNDS } from "@/lib/constants/nba-roster";

export function DraftHeader({
  currentPick,
  memberCount,
  currentTurnName,
  isMyTurn,
  secondsPerPick,
  lastPickTime,
  draftStatus,
  onTimerExpired,
  sport,
}: {
  currentPick: number;
  memberCount: number;
  currentTurnName: string;
  isMyTurn: boolean;
  secondsPerPick: number;
  lastPickTime: string;
  draftStatus: string;
  onTimerExpired: () => void;
  sport: string;
}) {
  const rounds = sport === "nba" ? NBA_TOTAL_ROUNDS : TOTAL_ROUNDS;
  const totalPicks = getTotalPicks(memberCount, rounds);
  const round = getRound(currentPick, memberCount);

  const calcRemaining = useCallback(() => {
    const elapsed = (Date.now() - new Date(lastPickTime).getTime()) / 1000;
    return Math.max(0, Math.ceil(secondsPerPick - elapsed));
  }, [lastPickTime, secondsPerPick]);

  const [secondsLeft, setSecondsLeft] = useState(calcRemaining);

  useEffect(() => {
    setSecondsLeft(calcRemaining());
  }, [calcRemaining]);

  useEffect(() => {
    if (draftStatus !== "in_progress") return;

    const interval = setInterval(() => {
      const remaining = calcRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onTimerExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [draftStatus, calcRemaining, onTimerExpired]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const timerColor =
    secondsLeft > 30
      ? "text-green-500"
      : secondsLeft > 10
        ? "text-yellow-500"
        : "text-red-500";

  const timerPulse = secondsLeft <= 10 && secondsLeft > 0 ? "animate-pulse" : "";

  if (draftStatus === "completed") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-sm font-medium text-green-600 dark:text-green-400">
          Draft Complete!
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-mono text-zinc-500 dark:text-zinc-400">
          Pick {currentPick} of {totalPicks}
        </span>
        <span className="text-zinc-400 dark:text-zinc-600">&middot;</span>
        <span className="text-zinc-500 dark:text-zinc-400">Round {round}</span>
        <span className="text-zinc-400 dark:text-zinc-600">&middot;</span>
        <span
          className={
            isMyTurn
              ? "font-semibold text-black dark:text-white"
              : "text-zinc-700 dark:text-zinc-300"
          }
        >
          {isMyTurn ? "Your Turn!" : `${currentTurnName}'s Turn`}
        </span>
      </div>
      <span className={`font-mono text-lg font-bold ${timerColor} ${timerPulse}`}>
        {timeDisplay}
      </span>
    </div>
  );
}
