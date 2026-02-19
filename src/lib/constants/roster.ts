// Roster slot display order and labels
export const ROSTER_SLOTS = [
  "qb",
  "rb1",
  "rb2",
  "wr_te1",
  "wr_te2",
  "wr_te3",
  "dst",
  "k",
  "super_flex",
] as const;

export const SLOT_LABELS: Record<string, string> = {
  qb: "QB",
  rb1: "RB1",
  rb2: "RB2",
  wr_te1: "WR/TE1",
  wr_te2: "WR/TE2",
  wr_te3: "WR/TE3",
  dst: "DST",
  k: "K",
  super_flex: "Super Flex",
};

// Playoff round display order and labels
export const PLAYOFF_ROUNDS = [
  "wild_card",
  "divisional",
  "conference",
  "super_bowl",
] as const;

export const ROUND_LABELS: Record<string, string> = {
  wild_card: "Wild Card",
  divisional: "Divisional",
  conference: "Conference",
  super_bowl: "Super Bowl",
};
