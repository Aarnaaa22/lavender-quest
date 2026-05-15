export type Level = {
  id: number;
  name: string;
  game: string;
  emoji: string;
  // position in % on the map container
  x: number;
  y: number;
  description: string;
};

export const LEVELS: Level[] = [
  { id: 1,  name: "Bubble Beach",     game: "Bubble Pop",      emoji: "🫧", x: 18, y: 78, description: "Pop the drifting lavender bubbles before they reach the shore." },
  { id: 2,  name: "Petal Meadow",     game: "Flower Match",    emoji: "🌸", x: 32, y: 60, description: "Match pairs of blooming petals across the meadow." },
  { id: 3,  name: "Butterfly Glade",  game: "Butterfly Catch", emoji: "🦋", x: 46, y: 70, description: "Catch fluttering violet butterflies in your net." },
  { id: 4,  name: "Berry Trail",      game: "Berry Run",       emoji: "🍇", x: 58, y: 55, description: "Run the winding trail and collect every berry." },
  { id: 5,  name: "Tide Cove",        game: "Wave Balance",    emoji: "🌊", x: 70, y: 78, description: "Balance on the tide as soft waves roll in." },
  { id: 6,  name: "Potion Hut",       game: "Potion Mix",      emoji: "🧪", x: 80, y: 62, description: "Brew a swirling lilac potion from rare ingredients." },
  { id: 7,  name: "Shell Bay",        game: "Shell Sort",      emoji: "🐚", x: 86, y: 44, description: "Sort glittering shells by color and shape." },
  { id: 8,  name: "Firefly Cave",     game: "Firefly Maze",    emoji: "✨", x: 70, y: 30, description: "Follow the fireflies through a glowing cave maze." },
  { id: 9,  name: "Cloud Bakery",     game: "Bakery Rush",     emoji: "🧁", x: 52, y: 22, description: "Serve cloud pastries to hungry sky bunnies." },
  { id: 10, name: "Moonlit Peak",     game: "Treasure",        emoji: "💜", x: 36, y: 30, description: "Unlock the final treasure at the moonlit peak." },
];

export const TOTAL_LEVELS = LEVELS.length;
