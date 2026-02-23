export const TOTAL_ROUNDS = 9;

/** Total picks in the entire draft */
export function getTotalPicks(memberCount: number, totalRounds: number = TOTAL_ROUNDS): number {
  return totalRounds * memberCount;
}

/** Which round (1-indexed) a given pick number falls in */
export function getRound(pickNumber: number, memberCount: number): number {
  return Math.ceil(pickNumber / memberCount);
}

/**
 * Snake draft: returns which draft_order value picks at this pick number.
 * Odd rounds go 1→N, even rounds go N→1.
 */
export function getMemberDraftOrder(
  pickNumber: number,
  memberCount: number
): number {
  const round = getRound(pickNumber, memberCount);
  const positionInRound = ((pickNumber - 1) % memberCount) + 1;

  // Odd rounds: ascending (1, 2, 3, ...)
  // Even rounds: descending (N, N-1, N-2, ...)
  if (round % 2 === 1) {
    return positionInRound;
  } else {
    return memberCount - positionInRound + 1;
  }
}
