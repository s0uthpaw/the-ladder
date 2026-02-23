/**
 * Auto-slot assignment for drafted players.
 * Each position has a priority list of slots it can fill.
 * super_flex is only available in the final round (round 9).
 */

import { TOTAL_ROUNDS } from "./draft-order";

const BASE_SLOTS: Record<string, string[]> = {
  QB: ["qb"],
  RB: ["rb1", "rb2"],
  WR: ["wr_te1", "wr_te2", "wr_te3"],
  TE: ["wr_te1", "wr_te2", "wr_te3"],
  K: ["k"],
  DST: ["dst"],
};

const SUPER_FLEX_ELIGIBLE = ["QB", "RB", "WR", "TE"];

/**
 * Given a player's position, the set of already-filled slots, and the current round,
 * returns the first available slot or null if none.
 * super_flex is only available when round === TOTAL_ROUNDS (9).
 */
export function assignSlot(
  position: string,
  filledSlots: Set<string>,
  round: number
): string | null {
  const base = BASE_SLOTS[position];
  if (!base) return null;

  // Build candidate list: base slots + super_flex only in final round
  const candidates = [...base];
  if (round >= TOTAL_ROUNDS && SUPER_FLEX_ELIGIBLE.includes(position)) {
    candidates.push("super_flex");
  }

  for (const slot of candidates) {
    if (!filledSlots.has(slot)) return slot;
  }
  return null;
}
