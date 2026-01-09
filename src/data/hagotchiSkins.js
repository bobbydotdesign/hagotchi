// Hagotchi Skin Definitions
// Each skin represents a different form/appearance of the user's spirit companion

export const SKINS = [
  {
    id: 'pixel_spirit',
    name: 'Pixel Spirit',
    rarity: 'common',
    loreText: 'The original form of the Hagotchi. A simple, flickering spirit born from the first spark of intention. It watches and waits, eager to grow alongside its companion.',
    // ASCII art for different vitality states
    art: {
      thriving: [
        '    ∧ ∧    ',
        '  ( ◉ ◉ )  ',
        '   (  ω  )   ',
        '  /|    |\\  ',
        ' / |    | \\ ',
        '   └──┘   ',
      ],
      content: [
        '    ∧ ∧    ',
        '  ( ◕ ◕ )  ',
        '   (  ‿  )   ',
        '   |    |   ',
        '   |    |   ',
        '   └──┘   ',
      ],
      tired: [
        '    ∧ ∧    ',
        '  ( – – )  ',
        '   (  ‿  )   ',
        '   |    |   ',
        '   |    |   ',
        '   └──┘   ',
      ],
      dormant: [
        '    ∧ ∧    ',
        '  ( ᴗ ᴗ )  ',
        '   ( ‿ )   ',
        '  /|zZz|\\  ',
        '   └──┘   ',
        '           ',
      ],
    }
  },
  {
    id: 'ember_wisp',
    name: 'Ember Wisp',
    rarity: 'common',
    loreText: 'A spirit forged in the fires of dedication. The Ember Wisp glows brighter with each completed task, its warmth a testament to perseverance.',
    art: {
      thriving: [
        '   \\*/*   ',
        '  ╱(◆◆)╲  ',
        ' ╱ *  * ╲ ',
        ' \\  ∿∿  / ',
        '  ╲____╱  ',
        '    ∿∿    ',
      ],
      content: [
        '   \\|/    ',
        '  ╱(◇◇)╲  ',
        ' ╱      ╲ ',
        ' \\  ~~  / ',
        '  ╲____╱  ',
        '    ~     ',
      ],
      tired: [
        '          ',
        '  ╱(• •)╲  ',
        ' ╱      ╲ ',
        ' \\  ~~  / ',
        '  ╲____╱  ',
        '          ',
      ],
      dormant: [
        '          ',
        '  ╱(- -)╲  ',
        ' ╱ zZz  ╲ ',
        ' \\      / ',
        '  ╲____╱  ',
        '          ',
      ],
    }
  },
  {
    id: 'crystal_guardian',
    name: 'Crystal Guardian',
    rarity: 'uncommon',
    loreText: 'Crystallized from weeks of unwavering commitment. This form radiates with stored energy, each facet reflecting a completed goal.',
    art: {
      thriving: [
        '   /\\◆/\\   ',
        '  /◇◉◉◇\\  ',
        ' /◆ ⟡ ◆\\ ',
        ' \\◇ ◇◇ ◇/ ',
        '  \\ ◆◆ /  ',
        '   \\__/   ',
      ],
      content: [
        '   /\\◇/\\   ',
        '  /◇◕◕◇\\  ',
        ' /◇    ◇\\ ',
        ' \\◇ ‿‿ ◇/ ',
        '  \\ ◇◇ /  ',
        '   \\__/   ',
      ],
      tired: [
        '   /\\◇/\\   ',
        '  /◇• •◇\\  ',
        ' /◇    ◇\\ ',
        ' \\◇ __ ◇/ ',
        '  \\ ◇◇ /  ',
        '   \\__/   ',
      ],
      dormant: [
        '   /\\ /\\   ',
        '  /  - -  \\  ',
        ' /  zZz  \\ ',
        ' \\      / ',
        '  \\    /  ',
        '   \\__/   ',
      ],
    }
  },
  {
    id: 'void_walker',
    name: 'Void Walker',
    rarity: 'uncommon',
    loreText: 'Emerged from the space between habits, the Void Walker exists partially in shadow. It knows the weight of missed days and the triumph of return.',
    art: {
      thriving: [
        '  ▓▒░ ░▒▓  ',
        ' ▓(⬤ ⬤)▓ ',
        ' ░ (⌣⌣) ░ ',
        ' ▒ |  | ▒ ',
        ' ▓ |  | ▓ ',
        '  ░▒▓▓▒░  ',
      ],
      content: [
        '  ▒░   ░▒  ',
        ' ▒(● ●)▒ ',
        ' ░ (‿‿) ░ ',
        ' ▒ |  | ▒ ',
        ' ░ |  | ░ ',
        '  ░▒▒░   ',
      ],
      tired: [
        '  ░     ░  ',
        ' ░(• •)░ ',
        ' ░ (__) ░ ',
        '   |  |   ',
        '   |  |   ',
        '    ░░    ',
      ],
      dormant: [
        '          ',
        '  (- -)   ',
        '  (zZz)   ',
        '   |  |   ',
        '   └──┘   ',
        '          ',
      ],
    }
  },
  {
    id: 'neon_phoenix',
    name: 'Neon Phoenix',
    rarity: 'rare',
    loreText: 'Born from the ashes of broken streaks, the Neon Phoenix rises eternal. Its digital flames burn brightest after each rebirth, proof that every fall can lead to flight.',
    art: {
      thriving: [
        '  \\\\╲|╱//  ',
        '  =◉◆◆◉=  ',
        ' ╱╱(ωω)╲╲ ',
        '╱╱╱ ▼▼ ╲╲╲',
        '  ╲╲╱╱   ',
        ' ~≈~≈~≈~ ',
      ],
      content: [
        '   ╲|╱    ',
        '  =(◆◆)=  ',
        '  ╱(‿‿)╲  ',
        ' ╱  ▽▽  ╲ ',
        '   ╲╱╱   ',
        '  ~≈~≈~  ',
      ],
      tired: [
        '          ',
        '   (◇◇)   ',
        '   (__)   ',
        '   ╲  ╱   ',
        '    ╲╱    ',
        '   ~≈~    ',
      ],
      dormant: [
        '          ',
        '   (- -)   ',
        '   (zZz)   ',
        '   ╲__╱   ',
        '          ',
        '    ~     ',
      ],
    }
  },
  {
    id: 'quantum_byte',
    name: 'Quantum Byte',
    rarity: 'rare',
    loreText: 'Existing in multiple states simultaneously, the Quantum Byte processes reality at impossible speeds. Legends say it can see habits completed in parallel timelines.',
    art: {
      thriving: [
        ' 01|10|01 ',
        ' [◉▓▓◉] ',
        ' |=◈◈=| ',
        ' |01◆10| ',
        ' [▓▓▓▓] ',
        ' 10|01|10 ',
      ],
      content: [
        ' 01|  |01 ',
        ' [◕  ◕] ',
        ' |=  =| ',
        ' |01 10| ',
        ' [▒▒▒▒] ',
        ' 10|__|10 ',
      ],
      tired: [
        '  0|  |0  ',
        '  [• •]  ',
        '  |=  =|  ',
        '  | __ |  ',
        '  [░░░░]  ',
        '   |__|   ',
      ],
      dormant: [
        '  0    0  ',
        '  [- -]  ',
        '  |zZz|  ',
        '  |    |  ',
        '  [____]  ',
        '          ',
      ],
    }
  },
  {
    id: 'elder_glitch',
    name: 'Elder Glitch',
    rarity: 'rare',
    loreText: 'An ancient spirit corrupted by time itself, the Elder Glitch phases between realities. Its fragmented form holds secrets of habits long forgotten.',
    art: {
      thriving: [
        ' ▌█▐▀▌█▐ ',
        ' ▌(⬤⬤)▐ ',
        ' █▌≋≋▐█ ',
        ' ▐▌||▐▌ ',
        ' █▌▄▄▐█ ',
        ' ▀▄▀▄▀▄ ',
      ],
      content: [
        '  █▐▀▌█  ',
        '  (● ●)  ',
        '  ▌≋≋▐  ',
        '  ▌||▐  ',
        '  █▄▄█  ',
        '  ▀▄▀▄  ',
      ],
      tired: [
        '   ▐▀▌   ',
        '  (• •)  ',
        '   ▌▐   ',
        '   ||   ',
        '   ▄▄   ',
        '   ▀▀   ',
      ],
      dormant: [
        '         ',
        '  (- -)  ',
        '  zZz   ',
        '   ||   ',
        '   __   ',
        '         ',
      ],
    }
  },
  {
    id: 'cosmic_sage',
    name: 'Cosmic Sage',
    rarity: 'rare',
    loreText: 'The final evolution. The Cosmic Sage has witnessed countless habits born and completed. In its starlit eyes burns the wisdom of eternal consistency.',
    art: {
      thriving: [
        ' ✦ ✧ ★ ✧ ✦ ',
        ' ☆(✴✴)☆ ',
        ' ★ (∞∞) ★ ',
        ' ✧╱╲╱╲✧ ',
        ' ✦╲☆☆╱✦ ',
        ' ★✧✦✧★ ',
      ],
      content: [
        ' ✦  ★  ✦ ',
        '  (✴ ✴)  ',
        '   (‿‿)   ',
        '  ╱╲╱╲  ',
        '  ╲☆☆╱  ',
        '  ✧ ✦ ✧  ',
      ],
      tired: [
        '    ★    ',
        '  (• •)  ',
        '   (__)   ',
        '  ╱╲╱╲  ',
        '  ╲__╱  ',
        '    ✧    ',
      ],
      dormant: [
        '         ',
        '  (- -)  ',
        '  (zZz)   ',
        '  ╱__╲  ',
        '         ',
        '    ·    ',
      ],
    }
  },
];

// Unlock milestones
export const UNLOCK_MILESTONES = [
  { skinId: 'pixel_spirit', type: 'default', condition: null, description: 'Your starting companion' },
  { skinId: 'ember_wisp', type: 'streak', condition: 7, description: 'Achieve a 7-day streak' },
  { skinId: 'crystal_guardian', type: 'habits', condition: 50, description: 'Complete 50 total habits' },
  { skinId: 'void_walker', type: 'streak', condition: 14, description: 'Achieve a 14-day streak' },
  { skinId: 'neon_phoenix', type: 'habits', condition: 100, description: 'Complete 100 total habits' },
  { skinId: 'quantum_byte', type: 'streak', condition: 30, description: 'Achieve a 30-day streak' },
  { skinId: 'elder_glitch', type: 'habits', condition: 200, description: 'Complete 200 total habits' },
  { skinId: 'cosmic_sage', type: 'streak', condition: 60, description: 'Achieve a 60-day streak' },
];

// Get skin by ID
export const getSkinById = (id) => SKINS.find(s => s.id === id);

// Get vitality state based on vitality level
export const getVitalityState = (vitality) => {
  if (vitality >= 80) return 'thriving';
  if (vitality >= 40) return 'content';
  if (vitality >= 20) return 'tired';
  return 'dormant';
};

// Get vitality state label
export const getVitalityStateLabel = (vitality) => {
  if (vitality >= 80) return 'thriving';
  if (vitality >= 40) return 'content';
  if (vitality >= 20) return 'tired';
  return 'dormant';
};

// Calculate vitality decay based on hours elapsed
export const calculateVitalityDecay = (lastFedAt, currentVitality) => {
  if (!lastFedAt) return currentVitality;

  const now = new Date();
  const lastFed = new Date(lastFedAt);
  const hoursElapsed = (now - lastFed) / (1000 * 60 * 60);

  // 2 points per hour decay
  const decay = Math.floor(hoursElapsed * 2);
  return Math.max(0, currentVitality - decay);
};

// Vitality gain per habit completion (random between 15-25)
export const getVitalityGain = () => {
  return Math.floor(Math.random() * 11) + 15; // 15-25
};

// Check if any new skins should be unlocked
export const checkMilestones = (currentStreak, longestStreak, totalHabitsCompleted, unlockedSkinIds) => {
  const newUnlocks = [];

  for (const milestone of UNLOCK_MILESTONES) {
    // Skip if already unlocked
    if (unlockedSkinIds.includes(milestone.skinId)) continue;

    // Skip default skin (should always be unlocked)
    if (milestone.type === 'default') continue;

    // Check streak milestones - use longestStreak to ensure past achievements count
    if (milestone.type === 'streak' && longestStreak >= milestone.condition) {
      newUnlocks.push(milestone.skinId);
    }

    // Check habit completion milestones
    if (milestone.type === 'habits' && totalHabitsCompleted >= milestone.condition) {
      newUnlocks.push(milestone.skinId);
    }
  }

  return newUnlocks;
};

// Get rarity color
export const getRarityColor = (rarity) => {
  switch (rarity) {
    case 'common': return '#888';
    case 'uncommon': return '#00ff41';
    case 'rare': return '#ff00ff';
    default: return '#888';
  }
};
