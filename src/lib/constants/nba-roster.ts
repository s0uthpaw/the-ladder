// NBA roster slot display order and labels
export const NBA_ROSTER_SLOTS = [
  "pg",
  "sg",
  "g",
  "sf",
  "pf",
  "f",
  "c1",
  "c2",
  "util1",
  "util2",
] as const;

export const NBA_SLOT_LABELS: Record<string, string> = {
  pg: "PG",
  sg: "SG",
  g: "G",
  sf: "SF",
  pf: "PF",
  f: "F",
  c1: "C",
  c2: "C",
  util1: "Util",
  util2: "Util",
};

export const NBA_TOTAL_ROUNDS = 10;

// Fantasy scoring multipliers (defaults)
export const NBA_SCORING = {
  pts: 1.0,
  reb: 1.2,
  ast: 1.5,
  stl: 3.0,
  blk: 3.0,
  turnover: -1.0,
} as const;
