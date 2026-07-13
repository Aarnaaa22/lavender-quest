export interface ParsedLayout {
  grid: number[][]; // 0: path, 1: tree, 2: water, 3: bridge, 4: flower, 5: mushroom, 6: lantern, 7: candy tree, 8: crystal rock, 9: house
  start: { x: number; y: number };
  candidateChests: { x: number; y: number }[];
}

const RAW_LAYOUTS = [
  // Layout 0: River Crossing
  [
    "TTTTTTTTTTTTTTTTTTTTTTTT",
    "TS....K...WWBWW...R...HT",
    "T.TTT.T.T..W.W..T.T.TT.T",
    "T.F.T.D.T..W.W..T.F.T.HT",
    "T.T.T.TTT..W.W..TTT.TT.T",
    "T.M.T......W.W......K..T",
    "T.T.TTTTTTTWWWWWWTT.TT.T",
    "T.L.R......T.W.H.T.....T",
    "T.TTTTTT.T.T.W.T.T.TTTTT",
    "T.F.T..T.T.T.W.T.T.T.H.T",
    "T.T.T..T.T.T.W.T.T.T.T.T",
    "T.R.D..T...T.B.T...D.T.T",
    "T.T.TT.T.TTT.W.TTT.T.R.T",
    "T...M..T.....W.....T...T",
    "TTTTTTTTTTTTTTTTTTTTTT.T",
    "TTTTTTTTTTTTTTTTTTTTTTTT",
  ],
  // Layout 1: Lake Loop
  [
    "TTTTTTTTTTTTTTTTTTTTTTTT",
    "TS....K.H..TTT...F.TT..T",
    "TTT.T.T.TT.T.D.T.T.T.R.T",
    "T.M.T.R.T..L.T.T.T.T.H.T",
    "T.TTTTT.TTT.TT.T.T.TTT.T",
    "T.T...T........T.T.....T",
    "T.T.W.WWWWWWW.TT.TTTTT.T",
    "T...W.W.H.W.W.T........T",
    "TTT.W.W...W.B.T.TTTTTT.T",
    "T.H.W.WWWWWWW.T.T...F.TT",
    "T.T.W.W.......T.T.D.T..T",
    "T.R.B.W.TTTTTTT.T.T.TT.T",
    "T.T.W.W.........T.T.R..T",
    "T.D.W.WWWWWWWW..T.TTTT.T",
    "T.F............TT......T",
    "TTTTTTTTTTTTTTTTTTTTTTTT",
  ],
  // Layout 2: Forest Maze Clearings
  [
    "TTTTTTTTTTTTTTTTTTTTTTTT",
    "TS....TT.....H.....TT.HT",
    "T.TTT.T..WWWWWWWW..T.T.T",
    "T.F.T.T..W.F..M.W..T.R.T",
    "T.R.T.T..W..H...W..TTT.T",
    "T.T.D.T..WWWWWWWW..T...T",
    "T.T.L.T......B.....T.T.T",
    "T.TTTTTTTTT..W..TTTT.T.T",
    "T..........T.W.T.....T.T",
    "T.WWWWWWW..T.W.T.WWWWW.T",
    "T.W..H..W..T.B.T.W...W.T",
    "T.W.M...B....W...B.F.W.T",
    "T.WWWWWWW.TTTTTT.WWWWW.T",
    "T.F.......TT...T.....HT",
    "TTTTTTTTTTTT...TTTTTTTTT",
    "TTTTTTTTTTTTTTTTTTTTTTTT",
  ],
  // Layout 3: The Secret Garden
  [
    "TTTTTTTTTTTTTTTTTTTTTTTT",
    "TS...F..T....TTT.H...M.T",
    "TTTTTT.T.TTT.T.T.TTTTT.T",
    "T......T.T.H.T.T.....T.T",
    "T.TTTTTT.T.TTT.TTTTT.T.T",
    "T.D.M....T.T.......T.R.T",
    "T.T.TTTT.T.TTTTTT.TT.T.T",
    "T.T.T....T......T.T..T.T",
    "T.R.T.TTTTWWWWW.T.T.TT.T",
    "T.T.T.T..W.F..W.T.T.T.HT",
    "T.L.D.T..W.H..W.T.T.T.TT",
    "T.T.T.T..WWWWWW.T.R.T..T",
    "T.T.F.T......B....T.TT.T",
    "T.TTTTTTT.T..W..TTT....T",
    "T.......H.TTTTT.TTTTTT.T",
    "TTTTTTTTTTTTTTTTTTTTTTTT",
  ],
  // Layout 4: Crystal Valley
  [
    "TTTTTTTTTTTTTTTTTTTTTTTT",
    "TS...T...TT.H..T....TT.T",
    "TT.T.T.T.T..T.TT.TT.T.HT",
    "T.H.T.T.T.TT.T.T.M..T.TT",
    "TT.TT.T.T..T.T.TTTT.T..T",
    "T..T..T.TT.T.T......TT.T",
    "T.TT.TT..T.L.TTTTTT..T.T",
    "T....T.R.T...T.H..TT.T.T",
    "TTTT.T.T.T.T.T.TT..T.T.T",
    "T....T.T...T.T.F.T.T.F.T",
    "T.TTTT.TTTTT.TTTTT.T.T.T",
    "T.D..T.T.WWBWW...T.T.T.T",
    "TTT.TT.T.W.W.W.T.T.T.L.T",
    "T.F....T.W.H.W.T.T.....T",
    "T.TTTTTT.WWWWW.T.TTTTT.T",
    "TTTTTTTTTTTTTTTTTTTTTTTT",
  ],
  // Layout 5: Double Bridge Island
  [
    "TTTTTTTTTTTTTTTTTTTTTTTT",
    "TS...T......TTT.H..T.H.T",
    "TT.T.T.TTTT.T.T.TT.T.T.T",
    "T..T.T.T.M..T.T..T.T.T.T",
    "T.TT.T.T.TT.T.TT.T.T.T.T",
    "T.H..T.T..T.T..T.T.T.T.T",
    "TTTTTT.TT.L.TT.T.T.L.T.T",
    "T......T..T..T.T.T...T.T",
    "T.WWWWWWWWWW.T.T.TTTTT.T",
    "T.W.F..W.F.W.T.T.......T",
    "T.W..H.B.M.W.T.TTTTTTT.T",
    "T.WWWWWWWWWW.T.T....F..T",
    "T.T.D........T.T.TTTTT.T",
    "T.T.TTTTTTTTTT.T.T.H...T",
    "T.F............T...TTT.T",
    "TTTTTTTTTTTTTTTTTTTTTTTT",
  ],
];

export function getRandomLayout(): ParsedLayout {
  const index = Math.floor(Math.random() * RAW_LAYOUTS.length);
  const raw = RAW_LAYOUTS[index];
  const rows = raw.length;
  const cols = raw[0].length;

  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  let start = { x: 1, y: 1 };
  const candidateChests: { x: number; y: number }[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const char = raw[y][x];
      // Grid cells mapping
      // 0: path, 1: tree, 2: water, 3: bridge, 4: flower, 5: mushroom, 6: lantern, 7: candy tree, 8: crystal rock, 9: house
      if (char === "T") {
        grid[y][x] = 1;
      } else if (char === "W") {
        grid[y][x] = 2;
      } else if (char === "B") {
        grid[y][x] = 3;
      } else if (char === "F") {
        grid[y][x] = 4;
      } else if (char === "M") {
        grid[y][x] = 5;
      } else if (char === "L") {
        grid[y][x] = 6;
      } else if (char === "K") {
        grid[y][x] = 7;
      } else if (char === "R") {
        grid[y][x] = 8;
      } else if (char === "D") {
        grid[y][x] = 9;
      } else if (char === "S") {
        grid[y][x] = 0;
        start = { x, y };
      } else if (char === "H") {
        grid[y][x] = 0; // Chest locations themselves are walkable path cells
        candidateChests.push({ x, y });
      } else {
        grid[y][x] = 0;
      }
    }
  }

  return { grid, start, candidateChests };
}
