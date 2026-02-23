/**
 * Auto-slot assignment for NBA drafted players.
 * Maps BDL positions (G, F, C, G-F, F-C, etc.) to slot candidates.
 * Util slots are fallback, available in later rounds.
 */

import { NBA_TOTAL_ROUNDS } from "@/lib/constants/nba-roster";

// BDL position → candidate slots (in priority order)
const NBA_SLOT_MAP: Record<string, string[]> = {
  G: ["pg", "sg", "g"],
  F: ["sf", "pf", "f"],
  C: ["c1", "c2"],
  "G-F": ["pg", "sg", "g", "sf", "pf", "f"],
  "F-G": ["sf", "pf", "f", "pg", "sg", "g"],
  "F-C": ["sf", "pf", "f", "c1", "c2"],
  "C-F": ["c1", "c2", "sf", "pf", "f"],
};

const UTIL_SLOTS = ["util1", "util2"];

/**
 * Given an NBA player's position, the set of already-filled slots, and the
 * current round, returns the first available slot or null if none.
 * Util slots become available starting at round 7 (of 10).
 */
export function assignNbaSlot(
  position: string,
  filledSlots: Set<string>,
  round: number
): string | null {
  const base = NBA_SLOT_MAP[position];
  if (!base) return null;

  // Build candidate list: base slots + util in later rounds
  const candidates = [...base];
  if (round >= NBA_TOTAL_ROUNDS - 3) {
    candidates.push(...UTIL_SLOTS);
  }

  for (const slot of candidates) {
    if (!filledSlots.has(slot)) return slot;
  }
  return null;
}
