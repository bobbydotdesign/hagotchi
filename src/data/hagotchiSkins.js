// Hagotchi Skin Definitions
// Each skin represents a different companion character

export const SKINS = [
  {
    id: 'egbert',
    name: 'Egbert',
    rarity: 'common',
    image: '/hagotchi/Egbert.svg',
    loreText: 'A mysterious egg that appeared when you first started your habit journey. Despite being "just an egg," Egbert radiates warmth and encouragement. Some say great things hatch from humble beginnings.',
  },
  {
    id: 'pum',
    name: 'Pum',
    rarity: 'common',
    image: '/hagotchi/Pum.svg',
    loreText: 'A cheerful pumpkin spirit born from the seeds of consistency. Pum glows brighter with each completed habit, its eternal smile a reminder that growth takes time.',
  },
  {
    id: 'bell',
    name: 'Bell',
    rarity: 'common',
    image: '/hagotchi/Bell.svg',
    loreText: 'A tiny bell guardian that rings with joy at every achievement. Bell was forged from the echoes of completed tasks, forever chiming in celebration of progress.',
  },
  {
    id: 'buns',
    name: 'Buns',
    rarity: 'uncommon',
    image: '/hagotchi/Buns.svg',
    loreText: 'A swift rabbit companion who knows that habits, like hops, are best taken one at a time. Buns embodies the power of showing up day after day.',
  },
  {
    id: 'doog',
    name: 'Doog',
    rarity: 'uncommon',
    image: '/hagotchi/Doog.svg',
    loreText: 'Loyal beyond measure, Doog has been waiting for someone consistent enough to befriend. This faithful companion celebrates your streaks with tail wags and unwavering support.',
  },
  {
    id: 'dock',
    name: 'Dock',
    rarity: 'uncommon',
    image: '/hagotchi/Dock.svg',
    loreText: 'A determined duck who waddles alongside you through every habit. Dock reminds you that even when progress feels slow, you\'re still moving forward.',
  },
  {
    id: 'gose',
    name: 'Gose',
    rarity: 'uncommon',
    image: '/hagotchi/Gose.svg',
    loreText: 'A mischievous goose with a mysterious past. Legend says Gose once caused chaos but has reformed, now channeling that chaotic energy into helping you stay on track.',
  },
  {
    id: 'axol',
    name: 'Axol',
    rarity: 'rare',
    image: '/hagotchi/Axol.svg',
    loreText: 'An ancient axolotl spirit that regenerates motivation like it regenerates limbs. Axol has witnessed countless habit journeys and chooses only the most dedicated companions.',
  },
  {
    id: 'snee',
    name: 'Snee',
    rarity: 'rare',
    image: '/hagotchi/Snee.svg',
    loreText: 'A sleek serpent of discipline that slithers through procrastination. Snee\'s unblinking gaze keeps you focused, shedding old excuses like dead skin.',
  },
  {
    id: 'turmy',
    name: 'Turmy',
    rarity: 'rare',
    image: '/hagotchi/Turmy.svg',
    loreText: 'Slow and steady wins the race. Turmy has traversed the longest habit journeys, its shell inscribed with the wisdom of patience and persistence.',
  },
  {
    id: 'boom',
    name: 'Boom',
    rarity: 'rare',
    image: '/hagotchi/Boom.svg',
    loreText: 'An explosive spirit born from breakthrough moments. Boom appears when habits finally click, celebrating those moments when everything comes together.',
  },
  {
    id: 'brr',
    name: 'Brr',
    rarity: 'epic',
    image: '/hagotchi/Brr.svg',
    loreText: 'A frost spirit that thrives in the cold discipline of routine. Brr teaches that comfort zones must be left behind for true growth to occur.',
  },
  {
    id: 'rac',
    name: 'Rac',
    rarity: 'epic',
    image: '/hagotchi/Rac.svg',
    loreText: 'A cunning raccoon who collects completed habits like treasures. Rac has a knack for finding motivation in unexpected places and never gives up on a goal.',
  },
  {
    id: 'ooo',
    name: 'OOO',
    rarity: 'epic',
    image: '/hagotchi/OOO.svg',
    loreText: 'A mysterious blob of pure habit energy that defies classification. OOO exists in a state of perpetual flow, embodying the effortless consistency masters achieve.',
  },
  {
    id: 'rad',
    name: 'Rad',
    rarity: 'legendary',
    image: '/hagotchi/Rad.svg',
    loreText: 'The ultimate companion, Rad radiates pure achievement energy. Only those who have proven their dedication through hundreds of completed habits can attract this legendary spirit.',
  },
];

// Unlock milestones - balanced progression
export const UNLOCK_MILESTONES = [
  { skinId: 'egbert', type: 'default', condition: null, description: 'Your starting companion' },
  { skinId: 'pum', type: 'streak', condition: 3, description: 'Achieve a 3-day streak' },
  { skinId: 'bell', type: 'habits', condition: 10, description: 'Complete 10 total habits' },
  { skinId: 'buns', type: 'streak', condition: 7, description: 'Achieve a 7-day streak' },
  { skinId: 'doog', type: 'habits', condition: 25, description: 'Complete 25 total habits' },
  { skinId: 'dock', type: 'streak', condition: 14, description: 'Achieve a 14-day streak' },
  { skinId: 'gose', type: 'habits', condition: 50, description: 'Complete 50 total habits' },
  { skinId: 'axol', type: 'streak', condition: 21, description: 'Achieve a 21-day streak' },
  { skinId: 'snee', type: 'habits', condition: 75, description: 'Complete 75 total habits' },
  { skinId: 'turmy', type: 'streak', condition: 30, description: 'Achieve a 30-day streak' },
  { skinId: 'boom', type: 'habits', condition: 100, description: 'Complete 100 total habits' },
  { skinId: 'brr', type: 'streak', condition: 45, description: 'Achieve a 45-day streak' },
  { skinId: 'rac', type: 'habits', condition: 150, description: 'Complete 150 total habits' },
  { skinId: 'ooo', type: 'streak', condition: 60, description: 'Achieve a 60-day streak' },
  { skinId: 'rad', type: 'habits', condition: 200, description: 'Complete 200 total habits' },
];

// Get skin by ID (with fallback to default)
export const getSkinById = (id) => SKINS.find(s => s.id === id) || SKINS[0];

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
    case 'rare': return '#00bfff';
    case 'epic': return '#ff00ff';
    case 'legendary': return '#ffaa00';
    default: return '#888';
  }
};
