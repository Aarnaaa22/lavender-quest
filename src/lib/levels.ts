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
  { id: 3,  name: "Butterfly Glade",  game: "Butterfly Net",   emoji: "🦋", x: 46, y: 70, description: "Use your net to catch butterflies and drop them into the lavender basket." },
  { id: 4,  name: "Berry Trail",      game: "Berry Run",       emoji: "🍇", x: 58, y: 55, description: "Run the winding trail and collect every berry." },
  { id: 5,  name: "Tide Cove",        game: "Wave Balance",    emoji: "🌊", x: 70, y: 78, description: "Balance on the tide as soft waves roll in." },
  { id: 6,  name: "Potion Hut",       game: "Tap the Odd One", emoji: "💜", x: 80, y: 62, description: "Spot the subtly different lavender item in each grid before time runs out." },
  { id: 7,  name: "Shell Bay",        game: "Shell Garland",   emoji: "🐚", x: 86, y: 44, description: "Recreate the seashell garland pattern using shells and charms." },
  { id: 8,  name: "Sweet Tower",      game: "Balance Stack",   emoji: "🧁", x: 70, y: 30, description: "Stack dreamy lavender desserts as high as you can." },
  { id: 9,  name: "Hidden Haven",     game: "Hidden Haven",     emoji: "🎁", x: 52, y: 22, description: "Explore the misty forest to find the hidden lavender treasure chest using natural clues." },
  { id: 10, name: "Moonlit Peak",     game: "Treasure",        emoji: "💜", x: 36, y: 30, description: "Unlock the final treasure at the moonlit peak." },
];

export const TOTAL_LEVELS = LEVELS.length;
