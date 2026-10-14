/**
 * Game Configuration for Pocket Pets AI
 */
export const CONFIG = {
  // Game Info
  title: {
    value: 'Yum Pets: Match & Feed',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 720,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 960,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Theme
  backgroundColor: {
    value: '#1e1b4b',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#fb7185',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'Fredoka, Quicksand, system-ui, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // Audio
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.6,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // Level Definitions & Rules
  levels: {
    value: [
      {
        level: 1,
        name: 'Sunny Meadow',
        targetHappiness: 1500,
        startingMoves: 25,
        pets: ['Pip'],
        description: 'Feed Pip the Bunny delicious treats to reach 1,500 Happiness!',
      },
      {
        level: 2,
        name: 'Bamboo Grove',
        targetHappiness: 2500,
        startingMoves: 20,
        pets: ['Pip', 'Bao'],
        description: 'Bao the Panda joins! Feed both pets to reach 2,500 Happiness!',
      },
      {
        level: 3,
        name: 'Festive Wonderland',
        targetHappiness: 4000,
        startingMoves: 18,
        pets: ['Pip', 'Bao', 'Gizmo'],
        description: 'Gizmo the Flying Squirrel joins! Match balloons for gliding frenzy!',
      },
    ],
    type: 'object',
    label: 'Levels Config',
    group: 'Rules',
  },
  targetHappiness: {
    value: 1500,
    type: 'number',
    label: 'Target Happiness',
    group: 'Rules',
  },
  startingMoves: {
    value: 25,
    type: 'number',
    label: 'Starting Moves',
    group: 'Rules',
  },
  pointsPerMatchPiece: {
    value: 20,
    type: 'number',
    label: 'Points Per Matched Piece',
    group: 'Rules',
  },
  superMatchBonus: {
    value: 80,
    type: 'number',
    label: 'Super Match Bonus',
    group: 'Rules',
  },
  petHappinessGain: {
    value: 5,
    type: 'number',
    label: 'Petting Happiness Gain',
    group: 'Rules',
  },
  bunnySpeed: {
    value: 180,
    type: 'number',
    label: 'Bunny Walk Speed',
    group: 'Physics',
  },
  spicyMultiplier: {
    value: 2.5,
    type: 'number',
    label: 'Spicy Turbo Multiplier',
    group: 'Physics',
  },
  freezeDuration: {
    value: 3.0,
    type: 'number',
    label: 'Frozen Duration (sec)',
    group: 'Physics',
  },

  // Asset Metadata Dimensions & Aspect Ratios
  bgIslandAspectRatio: {
    value: 1376 / 768,
    type: 'number',
    label: 'Island Background Aspect Ratio',
    group: 'ASSETS',
  },
  petBunnyAspectRatio: {
    value: 679 / 700,
    type: 'number',
    label: 'Pet Bunny Aspect Ratio',
    group: 'ASSETS',
  },
  petBunnySpicyAspectRatio: {
    value: 757 / 682,
    type: 'number',
    label: 'Spicy Bunny Aspect Ratio',
    group: 'ASSETS',
  },
  petBunnyFrozenAspectRatio: {
    value: 566 / 576,
    type: 'number',
    label: 'Frozen Bunny Aspect Ratio',
    group: 'ASSETS',
  },
  petBunnyFloatingAspectRatio: {
    value: 380 / 744,
    type: 'number',
    label: 'Floating Bunny Aspect Ratio',
    group: 'ASSETS',
  },
  treatBerryAspectRatio: {
    value: 563 / 725,
    type: 'number',
    label: 'Berry Aspect Ratio',
    group: 'ASSETS',
  },
  treatPepperAspectRatio: {
    value: 610 / 631,
    type: 'number',
    label: 'Pepper Aspect Ratio',
    group: 'ASSETS',
  },
  treatIceAspectRatio: {
    value: 590 / 582,
    type: 'number',
    label: 'Ice Cube Aspect Ratio',
    group: 'ASSETS',
  },
  itemIceCreamAspectRatio: {
    value: 338 / 822,
    type: 'number',
    label: 'Ice Cream Item Aspect Ratio',
    group: 'ASSETS',
  },
  treatBalloonAspectRatio: {
    value: 418 / 746,
    type: 'number',
    label: 'Balloon Aspect Ratio',
    group: 'ASSETS',
  },
  uiHeartAspectRatio: {
    value: 544 / 555,
    type: 'number',
    label: 'UI Heart Aspect Ratio',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const { playgroundConfig } = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], { value });
    }
  }
}

/** Type helper for reading values in game code */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}
