// tslint:disable
/* eslint-disable */
import {
  Heart,
  HelpCircle,
  Menu as MenuIcon,
  Music,
  Pause,
  Play,
  RotateCw,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
  Flame,
  Shield,
  Award,
  Info,
  RefreshCw,
  Gift,
  Coins,
  Check,
  Lock,
  ChevronRight,
  Home,
  ArrowUpCircle,
  Hammer,
} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {getConfig} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  createFixedStepper,
  formatTime,
  gameAudio,
  GameState,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  useAssets,
  useAutoFocus,
  useIsMobile,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

// --- PET SYSTEM DEFINITIONS & INTERFACES ---
export interface Pet {
  id: string;
  name: string;
  species: string;
  emoji: string;
  tagline: string;
  favoriteTreat: TreatType;
  favoriteName: string;
  unlocked: boolean;
  unlockCost?: number; // Coins cost to purchase
  unlockRequirement?: string; // Display text
  unlockLevel?: number; // Minimum player level requirement
  passiveBonus: string;
  passiveShort: string;
  color: string;
  accentColor: string;
  bgGradient: string;
}

// --- HABITAT BUILDING & ISLAND UPGRADE DEFINITIONS ---
export interface HabitatBuilding {
  id: 'food_bowl' | 'treehouse_log' | 'celestial_canopy';
  name: string;
  category: string;
  categoryBadge: string;
  categoryIcon: string;
  icon: string;
  currentLevel: number;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  description: string;
  benefitSummary: string;
  accentColor: string;
  bgGradient: string;
}

export const INITIAL_HABITAT_BUILDINGS: Record<string, HabitatBuilding> = {
  food_bowl: {
    id: 'food_bowl',
    name: 'Golden Food Bowl',
    category: 'Happiness Boost',
    categoryBadge: '💖 HAPPINESS BOOST',
    categoryIcon: '💖',
    icon: '🥣',
    currentLevel: 1,
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 1.8,
    description: 'Increases happiness gained from petting & feeding pets, plus automated treat & coin drops.',
    benefitSummary: 'Permanent Happiness Boost: +25%/lvl petting happiness & faster passive treat snacks.',
    accentColor: '#fbbf24',
    bgGradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
  },
  treehouse_log: {
    id: 'treehouse_log',
    name: 'Treehouse & Play Log',
    category: 'Extra Coins',
    categoryBadge: '🪙 EXTRA COINS',
    categoryIcon: '🪙',
    icon: '🏡',
    currentLevel: 1,
    maxLevel: 5,
    baseCost: 200,
    costMultiplier: 2.0,
    description: 'Multiplies gold coin rewards earned from completing match-3 puzzle levels and island acrobatics.',
    benefitSummary: 'Permanent Coin Multiplier: +20%/lvl extra coins earned on all level victories.',
    accentColor: '#34d399',
    bgGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
  },
  celestial_canopy: {
    id: 'celestial_canopy',
    name: 'Celestial Canopy',
    category: 'Puzzle Buffs',
    categoryBadge: '⚡ PUZZLE BUFFS',
    categoryIcon: '⚡',
    icon: '✨',
    currentLevel: 1,
    maxLevel: 5,
    baseCost: 250,
    costMultiplier: 2.2,
    description: 'Weaves starlight enchantments granting extra starting moves and higher special bomb spawn chances.',
    benefitSummary: 'Permanent Puzzle Buffs: +1 move every 2 lvls and +5%/lvl special bomb spawn rate.',
    accentColor: '#a855f7',
    bgGradient: 'from-purple-500/20 via-fuchsia-500/10 to-transparent',
  },
};

/** Calculates cost to upgrade from current level to next level */
export function getUpgradeCost(building: HabitatBuilding, currentLevel: number): number {
  if (currentLevel >= building.maxLevel) return 0;
  return Math.round(building.baseCost * Math.pow(building.costMultiplier, currentLevel - 1));
}

// --- SAVE GAME PROGRESS & PERSISTENCE ---
export interface SaveData {
  highestLevel: number;
  currentLevel: number;
  totalHappiness: number;
  highScore: number;
  unlockedPets: string[];
  selectedPetId: string;
  levelStars: Record<number, number>; // level -> stars earned (1..3)
  balloons: number; // Persistent Balloon Currency (🎈)
  stars: number; // Persistent Total Stars (⭐)
  coins: number; // Persistent Coin Currency (🪙)
  habitatBuildingLevels?: Record<string, number>; // buildingId -> level
  lastPlayedAt?: number;
}

export const PET_REGISTRY: Pet[] = [
  {
    id: 'pip',
    name: 'Pip the Bunny',
    species: 'Fluffy Bunny',
    emoji: '🐰',
    tagline: 'Energetic hopper with a huge craving for sweet crunchy carrots!',
    favoriteTreat: 'carrot',
    favoriteName: 'Crunchy Carrot',
    unlocked: true,
    unlockRequirement: 'Unlocked by default',
    passiveBonus: '+10% Base Happiness & +50% Bonus on Carrot matches',
    passiveShort: '+10% Score & Carrot Buff',
    color: '#fb7185',
    accentColor: '#f43f5e',
    bgGradient: 'from-pink-500/20 via-rose-500/10 to-transparent',
  },
  {
    id: 'bao',
    name: 'Bao the Panda',
    species: 'Zen Panda',
    emoji: '🐼',
    tagline: 'Calm bamboo master who loves fresh jade bamboo shoots.',
    favoriteTreat: 'bamboo',
    favoriteName: 'Jade Bamboo',
    unlocked: false,
    unlockRequirement: 'Reach Level 5',
    unlockLevel: 5,
    passiveBonus: '+2 Extra Moves & +50% Bonus on Bamboo matches',
    passiveShort: '+2 Moves & Bamboo Buff',
    color: '#34d399',
    accentColor: '#10b981',
    bgGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
  },
  {
    id: 'gizmo',
    name: 'Gizmo the Squirrel',
    species: 'Flying Squirrel',
    emoji: '🐿️',
    tagline: 'Fearless aviator who gathers golden acorns & pepper bombs!',
    favoriteTreat: 'acorn',
    favoriteName: 'Golden Acorn',
    unlocked: false,
    unlockRequirement: 'Reach Level 10',
    unlockLevel: 10,
    passiveBonus: '+15% Special Treat Chance & +50% Acorn Bonus',
    passiveShort: '+15% Bombs & Acorn Buff',
    color: '#38bdf8',
    accentColor: '#0284c7',
    bgGradient: 'from-sky-500/20 via-indigo-500/10 to-transparent',
  },
  {
    id: 'coco',
    name: 'Coco the Corgi',
    species: 'Royal Corgi',
    emoji: '🐶',
    tagline: 'Joyful treasure seeker who loves crunchy royal bone biscuits!',
    favoriteTreat: 'bone_biscuit',
    favoriteName: 'Royal Biscuit',
    unlocked: false,
    unlockRequirement: 'Unlock for 500 Coins',
    unlockCost: 500,
    passiveBonus: '+20% Coins Won & +50% Royal Biscuit Bonus',
    passiveShort: '+20% Coins & Biscuit Buff',
    color: '#facc15',
    accentColor: '#d97706',
    bgGradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
  },
  {
    id: 'mimi',
    name: 'Mimi the Fox',
    species: 'Mystic Fox',
    emoji: '🦊',
    tagline: 'Cunning spirit guardian empowered by glowing mystic starfruit!',
    favoriteTreat: 'star_berry',
    favoriteName: 'Mystic Starfruit',
    unlocked: false,
    unlockRequirement: 'Unlock for 1,000 Coins',
    unlockCost: 1000,
    passiveBonus: 'Breaks 3 Obstacles at match start & +50% Starfruit Bonus',
    passiveShort: 'Purges 3 Obstacles & Starfruit Buff',
    color: '#f97316',
    accentColor: '#ea580c',
    bgGradient: 'from-orange-500/20 via-rose-500/10 to-transparent',
  },
];

export const SAVE_KEY = 'yum_pets_save_v1';
export const LEGACY_SAVE_KEY = 'yum_pets_save_data_v2';
export const MUSIC_MUTE_KEY = 'yum_pets_music_muted';
export const SFX_MUTE_KEY = 'yum_pets_sfx_muted';

/** Strict move-based star calculation */
export function calculateStarsEarned(movesLeft: number): number {
  if (movesLeft >= 5) return 3;
  if (movesLeft >= 2) return 2;
  return 1;
}

export function loadGameProgress(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data === 'object' && data !== null) {
        const highestLevel = typeof data.highestLevel === 'number' ? Math.max(1, data.highestLevel) : 1;
        const currentLevel = typeof data.currentLevel === 'number' ? Math.max(1, data.currentLevel) : 1;
        const pets = Array.isArray(data.unlockedPets) && data.unlockedPets.length > 0
          ? [...data.unlockedPets]
          : ['pip'];
        
        // Auto-unlock level-based pets if level achieved
        if (highestLevel >= 5 && !pets.includes('bao')) pets.push('bao');
        if (highestLevel >= 10 && !pets.includes('gizmo')) pets.push('gizmo');

        const selectedPetId = typeof data.selectedPetId === 'string' && pets.includes(data.selectedPetId)
          ? data.selectedPetId
          : 'pip';

        const habitatBuildingLevels = typeof data.habitatBuildingLevels === 'object' && data.habitatBuildingLevels !== null
          ? {
              food_bowl: typeof data.habitatBuildingLevels.food_bowl === 'number' ? Math.min(5, Math.max(1, data.habitatBuildingLevels.food_bowl)) : 1,
              treehouse_log: typeof data.habitatBuildingLevels.treehouse_log === 'number' ? Math.min(5, Math.max(1, data.habitatBuildingLevels.treehouse_log)) : 1,
              celestial_canopy: typeof data.habitatBuildingLevels.celestial_canopy === 'number' ? Math.min(5, Math.max(1, data.habitatBuildingLevels.celestial_canopy)) : 1,
            }
          : { food_bowl: 1, treehouse_log: 1, celestial_canopy: 1 };

        return {
          highestLevel,
          currentLevel,
          totalHappiness: typeof data.totalHappiness === 'number' ? Math.max(0, data.totalHappiness) : 0,
          highScore: typeof data.highScore === 'number' ? Math.max(0, data.highScore) : 0,
          unlockedPets: pets,
          selectedPetId,
          levelStars: typeof data.levelStars === 'object' && data.levelStars !== null
            ? data.levelStars
            : {},
          balloons: typeof data.balloons === 'number' ? Math.max(0, data.balloons) : 15,
          stars: typeof data.stars === 'number' ? Math.max(0, data.stars) : 3,
          coins: typeof data.coins === 'number' ? Math.max(0, data.coins) : 250,
          habitatBuildingLevels,
          lastPlayedAt: data.lastPlayedAt || Date.now(),
        };
      }
    }
  } catch (err) {
    console.warn('[Storage] Error loading saved progress:', err);
  }

  return {
    highestLevel: 1,
    currentLevel: 1,
    totalHappiness: 0,
    highScore: 0,
    unlockedPets: ['pip'],
    selectedPetId: 'pip',
    levelStars: {},
    balloons: 15,
    stars: 3,
    coins: 250,
    habitatBuildingLevels: { food_bowl: 1, treehouse_log: 1, celestial_canopy: 1 },
    lastPlayedAt: Date.now(),
  };
}

export function saveGameProgress(data: Partial<SaveData>): SaveData {
  const current = loadGameProgress();

  const highestLvl = Math.max(current.highestLevel, data.highestLevel || 1);
  const pets = Array.from(new Set([...current.unlockedPets, ...(data.unlockedPets || [])]));
  if (highestLvl >= 5 && !pets.includes('bao')) pets.push('bao');
  if (highestLvl >= 10 && !pets.includes('gizmo')) pets.push('gizmo');

  const selectedPet = data.selectedPetId || current.selectedPetId || 'pip';

  const updated: SaveData = {
    ...current,
    ...data,
    highestLevel: highestLvl,
    currentLevel: Math.max(1, data.currentLevel ?? current.currentLevel),
    totalHappiness: Math.max(current.totalHappiness, data.totalHappiness ?? current.totalHappiness),
    highScore: Math.max(current.highScore, data.highScore ?? current.highScore),
    balloons: Math.max(0, data.balloons !== undefined ? data.balloons : current.balloons),
    stars: Math.max(0, data.stars !== undefined ? data.stars : current.stars),
    coins: Math.max(0, data.coins !== undefined ? data.coins : current.coins),
    selectedPetId: pets.includes(selectedPet) ? selectedPet : 'pip',
    levelStars: {
      ...current.levelStars,
      ...(data.levelStars || {}),
    },
    unlockedPets: pets,
    habitatBuildingLevels: {
      ...(current.habitatBuildingLevels || { food_bowl: 1, treehouse_log: 1, celestial_canopy: 1 }),
      ...(data.habitatBuildingLevels || {}),
    },
    lastPlayedAt: Date.now(),
  };

  try {
    const serialized = JSON.stringify(updated);
    localStorage.setItem(SAVE_KEY, serialized);
    localStorage.setItem(LEGACY_SAVE_KEY, serialized);
  } catch (err) {
    console.warn('[Storage] Error saving game progress:', err);
  }
  return updated;
}

// Treat & Piece definitions for 5x5 Match-3
export type TreatType =
  | 'berry'
  | 'pepper'
  | 'ice'
  | 'balloon'
  | 'carrot'
  | 'bamboo'
  | 'acorn'
  | 'bone_biscuit'
  | 'star_berry'
  | 'honey_pot';

export const TREAT_TYPES: TreatType[] = [
  'berry',
  'pepper',
  'ice',
  'balloon',
  'carrot',
  'bamboo',
  'acorn',
  'bone_biscuit',
  'star_berry',
];

export interface TreatMeta {
  name: string;
  emoji: string;
  color: string;
}

export const TREAT_METAS: Record<TreatType, TreatMeta> = {
  berry: { name: 'Sweet Berry', emoji: '🍓', color: '#f43f5e' },
  pepper: { name: 'Spicy Chili', emoji: '🌶️', color: '#ef4444' },
  ice: { name: 'Frost Popsicle', emoji: '🍧', color: '#38bdf8' },
  balloon: { name: 'Festive Balloon', emoji: '🎈', color: '#ec4899' },
  carrot: { name: 'Crunchy Carrot', emoji: '🥕', color: '#f97316' },
  bamboo: { name: 'Jade Bamboo', emoji: '🎋', color: '#10b981' },
  acorn: { name: 'Golden Acorn', emoji: '🌰', color: '#d97706' },
  bone_biscuit: { name: 'Royal Biscuit', emoji: '🦴', color: '#facc15' },
  star_berry: { name: 'Mystic Starfruit', emoji: '⭐', color: '#a855f7' },
  honey_pot: { name: 'Sweet Honey', emoji: '🍯', color: '#f59e0b' },
};

export interface ObstacleMeta {
  type: 'ice' | 'honey' | 'crate';
  layer: number;
}

// Biome definitions & environment mapping
export type BiomeType = 'sunny_meadow' | 'bamboo_grove' | 'dragonfly_lagoon' | 'berry_blossom_field';

export interface BiomeConfig {
  id: BiomeType;
  name: string;
  badge: string;
  icon: string;
  tagline: string;
  accentColor: string;
  signatureTreat: TreatType;
  signatureTreatName: string;
  cycle: number;
}

export function getBiomeForLevel(level: number): BiomeConfig {
  const safeLvl = Math.max(1, level);
  const cycle = Math.floor((safeLvl - 1) / 15) + 1;
  const cycleLvl = ((safeLvl - 1) % 15) + 1;

  if (cycleLvl <= 3) {
    return {
      id: 'sunny_meadow',
      name: 'Sunny Meadow',
      badge: '📍 Sunny Meadow',
      icon: '🌻',
      tagline: 'Rolling green hills & golden sunbeams',
      accentColor: '#facc15',
      signatureTreat: 'carrot',
      signatureTreatName: 'Crunchy Carrot 🥕',
      cycle,
    };
  } else if (cycleLvl <= 7) {
    return {
      id: 'bamboo_grove',
      name: 'Bamboo Grove',
      badge: '📍 Bamboo Grove',
      icon: '🎋',
      tagline: 'Lush jade bamboo & cascading waterfalls',
      accentColor: '#34d399',
      signatureTreat: 'bamboo',
      signatureTreatName: 'Jade Bamboo 🎋',
      cycle,
    };
  } else if (cycleLvl <= 11) {
    return {
      id: 'dragonfly_lagoon',
      name: 'Dragonfly Lagoon',
      badge: '📍 Dragonfly Lagoon',
      icon: '🪷',
      tagline: 'Turquoise ripples, lotus pads & neon dragonflies',
      accentColor: '#38bdf8',
      signatureTreat: 'star_berry',
      signatureTreatName: 'Mystic Starfruit ⭐',
      cycle,
    };
  } else {
    return {
      id: 'berry_blossom_field',
      name: 'Berry Blossom Field',
      badge: '📍 Berry Blossom Field',
      icon: '🌸',
      tagline: 'Sunset skies & drifting sakura blossom petals',
      accentColor: '#f472b6',
      signatureTreat: 'berry',
      signatureTreatName: 'Sweet Berry 🍓',
      cycle,
    };
  }
}

export interface LevelConfig {
  level: number;
  name: string;
  targetHappiness: number;
  startingMoves: number;
  iceCount: number;
  bombChance: number;
  description: string;
  activeTreatPool: TreatType[];
  obstacleCount: number;
  obstacleTypes: ('ice' | 'honey' | 'crate')[];
  maxObstacleLayers: number;
  biome: BiomeConfig;
}

const LEVEL_THEME_NAMES = [
  'Sunny Meadow - Pip\'s Garden',
  'Sunny Meadow - Daisy Hill',
  'Bamboo Grove - Panda Sanctuary',
  'Bamboo Grove - Jade Falls',
  'Bamboo Grove - Misty Pagoda',
  'Dragonfly Lagoon - Lotus Pond',
  'Dragonfly Lagoon - Turquoise Shimmer',
  'Dragonfly Lagoon - Neon Reeds',
  'Dragonfly Lagoon - Twilight Springs',
  'Berry Blossom Field - Sakura Sunrise',
  'Berry Blossom Field - Sweet Blossom Valley',
  'Berry Blossom Field - Rosewood Canopy',
  'Berry Blossom Field - Twilight Orchard',
  'Berry Blossom Field - Petal Paradise',
  'Grand Pet Utopia',
];

/** Dynamic, infinite procedural level generator */
export function getLevelConfig(level: number, unlockedPets?: string[]): LevelConfig {
  const safeLvl = Math.max(1, level);
  const themeIndex = (safeLvl - 1) % LEVEL_THEME_NAMES.length;
  const loopCount = Math.floor((safeLvl - 1) / LEVEL_THEME_NAMES.length);
  const name = loopCount === 0
    ? LEVEL_THEME_NAMES[themeIndex]
    : `${LEVEL_THEME_NAMES[themeIndex]} +${loopCount}`;

  // Target happiness scales by +500 per level
  const targetHappiness = 1200 + (safeLvl - 1) * 500;

  // Dynamic moves
  const startingMoves = Math.max(18, 24 + Math.min(8, Math.floor(safeLvl / 3)) - Math.min(6, Math.floor((safeLvl - 1) / 4)));

  // Obstacle counts
  const obstacleCount = safeLvl === 1 ? 0 : Math.min(6, Math.floor(safeLvl * 0.7) + (safeLvl >= 5 ? 1 : 0));
  const iceCount = obstacleCount;
  const bombChance = safeLvl >= 3 ? Math.min(0.25, 0.05 + safeLvl * 0.02) : 0;
  const maxObstacleLayers = safeLvl >= 4 ? 2 : 1;

  const obstacleTypes: ('ice' | 'honey' | 'crate')[] = ['ice'];
  if (safeLvl >= 3) obstacleTypes.push('honey');
  if (safeLvl >= 6) obstacleTypes.push('crate');

  const biome = getBiomeForLevel(safeLvl);

  // Active treat pool for Match-3
  const poolSet = new Set<TreatType>(['berry', 'pepper', 'ice', 'balloon']);
  if (biome.signatureTreat) {
    poolSet.add(biome.signatureTreat);
  }
  if (unlockedPets && unlockedPets.length > 0) {
    unlockedPets.forEach((pId) => {
      const pet = PET_REGISTRY.find((p) => p.id === pId);
      if (pet?.favoriteTreat) {
        poolSet.add(pet.favoriteTreat);
      }
    });
  }
  const activeTreatPool = Array.from(poolSet).slice(0, 5);

  const description = safeLvl === 1
    ? 'Feed your cozy pet delicious treats in the Sunny Meadow to reach the Happiness target!'
    : safeLvl === 2
    ? 'Crack ice and feed your companion pet under the warm sunshine!'
    : `Explore ${biome.name}! Match balloons to send your pet soaring through ${biome.name}!`;

  return {
    level: safeLvl,
    name,
    targetHappiness,
    startingMoves,
    iceCount,
    bombChance,
    description,
    activeTreatPool,
    obstacleCount,
    obstacleTypes,
    maxObstacleLayers,
    biome,
  };
}

export interface BoardPiece {
  id: number;
  type: TreatType;
  special?: 'line' | 'rainbow' | 'pepper_bomb';
  obstacle?: ObstacleMeta; // Dynamic obstacle: ice, honey, crate with multi-layer health
  iceLayer?: number; // legacy fallback compatibility
  row: number;
  col: number;
  // Visual positions & animations
  drawX: number;
  drawY: number;
  targetX: number;
  targetY: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  shakeTimer?: number;
  isClearing?: boolean;
  isSettling?: boolean;
}

// Helper to build a roaming pet entity with distinct species attributes
export function createRoamingPetEntity(
  id: string,
  index: number,
  totalPets: number,
  canvasWidth: number,
): RoamingPetEntity {
  const islandLeft = 110;
  const islandRight = canvasWidth - 110;
  const spacing = (islandRight - islandLeft) / Math.max(1, totalPets + 1);
  const startX = islandLeft + (index + 1) * spacing + (Math.random() - 0.5) * 30;

  let walkSpeedMultiplier = 1.0;
  if (id === 'bao' || id === 'panda') walkSpeedMultiplier = 0.7;
  if (id === 'gizmo' || id === 'squirrel') walkSpeedMultiplier = 1.3;
  if (id === 'coco' || id === 'corgi') walkSpeedMultiplier = 1.1;
  if (id === 'mimi' || id === 'fox') walkSpeedMultiplier = 1.2;

  const petDef = PET_REGISTRY.find((p) => p.id === id) || PET_REGISTRY[0];

  return {
    id,
    favoriteTreat: petDef.favoriteTreat,
    x: Math.max(islandLeft, Math.min(islandRight, startX)),
    y: 285,
    groundY: 285,
    vx: 0,
    vy: 0,
    targetX: startX,
    targetY: 285,
    facingRight: index % 2 === 0,
    state: 'NORMAL',
    stateTimer: 0,
    bounceTimer: Math.random() * 5,
    petSquishTimer: 0,
    idleTimer: Math.random() * 2,
    wiggleAngle: 0,
    tailWiggle: 0,
    rollAngle: 0,
    spicyTrailTimer: 0,
    frostSparkleTimer: 0,
    speechText: '',
    speechTimer: 0,
    walkSpeedMultiplier,
    hopTimer: Math.random() * 2,
    actionTimer: Math.random() * 4 + 2,
    napTimer: 0,
    interactCooldown: 2.0 + Math.random() * 3,
  };
}
export interface HabitatDrop {
  id: number;
  type: TreatType;
  isSuper?: boolean;
  isSpicyBomb?: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  groundY: number;
  bounces: number;
  state: 'falling' | 'on_ground' | 'eaten';
  lifeTime: number;
}

// Flying treat/star mote arcing up to feed companion pets
export interface FlyingMote {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  cpX: number;
  cpY: number;
  progress: number;
  speed: number;
  type: TreatType;
  color: string;
  size: number;
  rotation: number;
  vRot: number;
}

// Slapstick & emotion states for Pets
export type PetState =
  | 'NORMAL'
  | 'DANCING'
  | 'SPICY'
  | 'FROZEN'
  | 'FLOATING'
  | 'GLIDING'
  | 'PETTED'
  | 'NAPPING'
  | 'SNIFFING'
  | 'POUNCING';

export interface RoamingPetEntity {
  id: string; // 'pip' | 'bao' | 'gizmo' | 'coco' | 'mimi'
  favoriteTreat: TreatType;
  x: number;
  y: number;
  groundY: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  facingRight: boolean;
  state: PetState;
  stateTimer: number;
  bounceTimer: number;
  petSquishTimer: number;
  idleTimer: number;
  wiggleAngle: number;
  tailWiggle: number;
  rollAngle: number;
  spicyTrailTimer: number;
  frostSparkleTimer: number;
  speechText: string;
  speechTimer: number;
  // Unique personality & multi-pet interaction timers
  walkSpeedMultiplier: number;
  hopTimer: number;
  actionTimer: number;
  napTimer: number;
  interactCooldown: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  rotation?: number;
  vRot?: number;
  wobbleSpeed?: number;
  wobbleAmp?: number;
  shape?:
    | 'circle'
    | 'heart'
    | 'star'
    | 'smoke'
    | 'frost'
    | 'sparkle'
    | 'fire'
    | 'bamboo'
    | 'candy'
    | 'balloon'
    | 'bubble'
    | 'pollen'
    | 'bamboo_leaf'
    | 'dragonfly'
    | 'sakura_petal'
    | 'coin'
    | 'paw';
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  alpha: number;
  scale: number;
  life: number;
}

const ROWS = 5;
const COLS = 5;

// Background music asset path
const BACKGROUND_MUSIC_URL = 'assets/audio/bgm_pocket_pets.mp3';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>();
  const isMobile = useIsMobile();

  // --- PLAYGROUND SDK INTEGRATION ---
  const {sdk} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');

  // --- ASSETS MANIFEST ---
  const ASSETS_MANIFEST: Record<string, string> = {
    bg_island_habitat: 'assets/images/bg_island_habitat.png',
    pet_bunny: 'assets/images/pet_bunny.png',
    pet_bunny_spicy: 'assets/images/pet_bunny_spicy.png',
    pet_bunny_frozen: 'assets/images/pet_bunny_frozen.png',
    pet_bunny_floating: 'assets/images/pet_bunny_floating.png',
    treat_berry: 'assets/images/treat_berry.png',
    treat_pepper: 'assets/images/treat_pepper.png',
    treat_ice: 'assets/images/treat_ice.png',
    item_ice_cream: 'assets/images/item_ice_cream.png',
    treat_balloon: 'assets/images/treat_balloon.png',
    ui_happiness_heart: 'assets/images/ui_happiness_heart.png',
  };
  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  const canvasWidth = getConfig('baseCanvasWidth') as number;
  const canvasHeight = getConfig('baseCanvasHeight') as number;

  if (!stepperRef.current) {
    const stepMs = getConfig('stepMs');
    const maxSubSteps = getConfig('maxSubSteps');
    stepperRef.current = createFixedStepper(stepMs, maxSubSteps);
  }

  // --- PERSISTED PROGRESS & CURRENCIES (Hydrated synchronously on hard refresh) ---
  const [savedData, setSavedData] = useState<SaveData>(() => loadGameProgress());
  const [balloons, setBalloons] = useState<number>(() => {
    const s = loadGameProgress();
    return s.balloons;
  });
  const [stars, setStars] = useState<number>(() => {
    const s = loadGameProgress();
    return s.stars;
  });
  const [coins, setCoins] = useState<number>(() => {
    const s = loadGameProgress();
    return s.coins;
  });
  const [unlockedPetIds, setUnlockedPetIds] = useState<string[]>(() => {
    const s = loadGameProgress();
    return s.unlockedPets;
  });
  const [selectedPetId, setSelectedPetId] = useState<string>(() => {
    const s = loadGameProgress();
    return s.selectedPetId;
  });
  const [habitatBuildings, setHabitatBuildings] = useState<Record<string, number>>(() => {
    const s = loadGameProgress();
    return s.habitatBuildingLevels || { food_bowl: 1, treehouse_log: 1, celestial_canopy: 1 };
  });

  // Total upgrade purchases made across all habitat buildings (starts at 0 when all buildings are level 1)
  const totalUpgradesPurchased =
    (Math.max(1, habitatBuildings.food_bowl || 1) - 1) +
    (Math.max(1, habitatBuildings.treehouse_log || 1) - 1) +
    (Math.max(1, habitatBuildings.celestial_canopy || 1) - 1);

  // --- BOARD GEOMETRY ---
  const cellSize = 100;
  const boardMarginX = (canvasWidth - COLS * cellSize) / 2; // 110
  const boardStartY = 435; // leaves bottom padding
  const habitatHeight = 350;

  // --- REACT STATE ---
  const [gameState, setGameState] = useState<GameState>(() => {
    const s = loadGameProgress();
    const lvl = s.currentLevel || 1;
    return {
      status: 'START',
      score: 0,
      level: lvl,
      moves: getLevelConfig(lvl).startingMoves,
    };
  });

  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isPetCollectionOpen, setIsPetCollectionOpen] = useState(false);
  const [isHabitatShopOpen, setIsHabitatShopOpen] = useState(false);
  const [isVictoryModalDismissed, setIsVictoryModalDismissed] = useState(false);
  const [isSaveStreakModalOpen, setIsSaveStreakModalOpen] = useState(false);
  const [lastForfeitPenalty, setLastForfeitPenalty] = useState<{
    starLost: number;
    demoted: boolean;
    prevLevel: number;
    newLevel: number;
  } | null>(null);

  const [victoryRewards, setVictoryRewards] = useState<{
    baseCoins: number;
    movesBonus: number;
    starBonus: number;
    corgiBonus: number;
    treehouseBonus: number;
    totalCoinsWon: number;
    starsWon: number;
  } | null>(null);

  const [sfxMuted, setSfxMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SFX_MUTE_KEY);
      const isMuted = saved !== null ? JSON.parse(saved) === true : false;
      if (isMuted) {
        gameAudio.setMuted(true);
      }
      return isMuted;
    } catch {
      return false;
    }
  });

  const [musicMuted, setMusicMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(MUSIC_MUTE_KEY);
      return saved !== null ? JSON.parse(saved) === true : false;
    } catch {
      return false;
    }
  });

  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const audioNoticeTimeoutRef = useRef<number | null>(null);

  const toggleMusicMute = () => {
    setMusicMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUSIC_MUTE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Could not save music mute preference:', e);
      }
      gameAudio.playCrispClick();
      setAudioNotice(next ? '🔇 Music Muted' : '🎵 Music Playing');
      if (audioNoticeTimeoutRef.current) window.clearTimeout(audioNoticeTimeoutRef.current);
      audioNoticeTimeoutRef.current = window.setTimeout(() => setAudioNotice(null), 1800);
      return next;
    });
  };

  const toggleSfxMute = () => {
    const muted = gameAudio.toggleMute();
    setSfxMuted(muted);
    try {
      localStorage.setItem(SFX_MUTE_KEY, JSON.stringify(muted));
    } catch (e) {
      console.warn('Could not save sfx mute preference:', e);
    }
    setAudioNotice(muted ? '🔇 Sound Effects Muted' : '🔊 Sound Effects On');
    if (audioNoticeTimeoutRef.current) window.clearTimeout(audioNoticeTimeoutRef.current);
    audioNoticeTimeoutRef.current = window.setTimeout(() => setAudioNotice(null), 1800);
  };

  const [comboBanner, setComboBanner] = useState<{
    text: string;
    subtext: string;
    tier: number;
    key: number;
  } | null>(null);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const balloonsRef = useRef(balloons);
  balloonsRef.current = balloons;

  const starsRef = useRef(stars);
  starsRef.current = stars;

  const coinsRef = useRef(coins);
  coinsRef.current = coins;

  const selectedPetIdRef = useRef(selectedPetId);
  selectedPetIdRef.current = selectedPetId;

  const habitatBuildingsRef = useRef(habitatBuildings);
  habitatBuildingsRef.current = habitatBuildings;

  const currentLevelConfig = getLevelConfig(gameState.level, savedData?.unlockedPets ?? unlockedPetIds);
  const currentBiome = getBiomeForLevel(gameState.level);
  const targetHappiness = currentLevelConfig.targetHappiness;
  const activePetDef = PET_REGISTRY.find((p) => p.id === selectedPetId) || PET_REGISTRY[0];

  // Sync saved data on mount
  useEffect(() => {
    const loaded = loadGameProgress();
    if (loaded) {
      setSavedData(loaded);
      setBalloons(loaded.balloons);
      setStars(loaded.stars);
      setCoins(loaded.coins);
      setUnlockedPetIds(loaded.unlockedPets);
      setSelectedPetId(loaded.selectedPetId);
      if (loaded.habitatBuildingLevels) {
        setHabitatBuildings(loaded.habitatBuildingLevels);
      }
    }
  }, []);

  useEffect(() => {
    (window as any).canHandleBackKey = gameState.status !== 'START';
  }, [gameState.status]);

  // Audio win/loss cues & celebratory effects & auto-persistence
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
      console.log('GAME_OVER');
    } else if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
      setIsVictoryModalDismissed(false);
      setIsSaveStreakModalOpen(false);
      console.log('LEVEL_COMPLETE', `Level ${gameState.level}`);

      // Calculate star rating strictly from remaining moves
      const movesLeft = gameState.moves ?? 0;
      const starsEarned = calculateStarsEarned(movesLeft);

      // Calculate Coin Rewards
      const baseCoins = 100;
      const movesBonus = movesLeft * 15;
      const starBonus = starsEarned * 25;
      const isCorgiActive = selectedPetIdRef.current === 'coco';
      const corgiBonus = isCorgiActive ? Math.round((baseCoins + movesBonus + starBonus) * 0.2) : 0;
      
      // Treehouse & Play Log Perk: +20% bonus coins per level above 1
      const treehouseLvl = habitatBuildingsRef.current.treehouse_log || 1;
      const treehouseBonus = Math.round((baseCoins + movesBonus + starBonus) * ((treehouseLvl - 1) * 0.20));
      const totalCoinsWon = baseCoins + movesBonus + starBonus + corgiBonus + treehouseBonus;

      setVictoryRewards({
        baseCoins,
        movesBonus,
        starBonus,
        corgiBonus,
        treehouseBonus,
        totalCoinsWon,
        starsWon: starsEarned,
      });

      // Persist progress into localStorage (+award stars and coins)
      const nextStars = (savedData?.stars ?? starsRef.current) + starsEarned;
      const nextCoins = (savedData?.coins ?? coinsRef.current) + totalCoinsWon;
      setStars(nextStars);
      setCoins(nextCoins);

      // Check level-based pet unlocks (Bao at Level 5, Gizmo at Level 10)
      const newHighestLevel = Math.max((savedData?.highestLevel || 1), gameState.level + 1);
      const nextUnlockedPets = [...(savedData?.unlockedPets || unlockedPetIds)];
      if (newHighestLevel >= 5 && !nextUnlockedPets.includes('bao')) {
        nextUnlockedPets.push('bao');
        addFloatingText('BAO THE PANDA UNLOCKED! 🐼🎉', canvasWidth / 2, boardStartY - 50, '#34d399');
      }
      if (newHighestLevel >= 10 && !nextUnlockedPets.includes('gizmo')) {
        nextUnlockedPets.push('gizmo');
        addFloatingText('GIZMO SQUIRREL UNLOCKED! 🐿️🎉', canvasWidth / 2, boardStartY - 50, '#38bdf8');
      }
      setUnlockedPetIds(nextUnlockedPets);

      const updated = saveGameProgress({
        highestLevel: newHighestLevel,
        currentLevel: gameState.level + 1,
        totalHappiness: (savedData?.totalHappiness || 0) + gameState.score,
        highScore: Math.max((savedData?.highScore || 0), gameState.score),
        stars: nextStars,
        coins: nextCoins,
        balloons: balloonsRef.current,
        unlockedPets: nextUnlockedPets,
        selectedPetId: selectedPetIdRef.current,
        levelStars: {
          ...(savedData?.levelStars || {}),
          [gameState.level]: Math.max(savedData?.levelStars?.[gameState.level] || 0, starsEarned),
        },
      });
      setSavedData(updated);

      // Burst celebratory candy, coin, and star confetti!
      for (let i = 0; i < 45; i++) {
        spawnCelebrationParticle();
      }
    }
  }, [gameState.status, gameState.level]);

  // --- SIMULATION REFS ---
  const boardRef = useRef<(BoardPiece | null)[][]>([]);
  const selectedCellRef = useRef<{r: number; c: number} | null>(null);
  const isProcessingRef = useRef(false);
  const nextPieceIdRef = useRef(1);
  const nextDropIdRef = useRef(1);
  const nextTextIdRef = useRef(1);
  const nextMoteIdRef = useRef(1);

  // Drag / Swipe tracking ref
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startRow: number;
    startCol: number;
    swiped: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startRow: -1,
    startCol: -1,
    swiped: false,
  });

  // Habitat Physical World & Visual Juice
  const dropsRef = useRef<HabitatDrop[]>([]);
  const motesRef = useRef<FlyingMote[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const screenShakeRef = useRef({ timer: 0, intensity: 0 });
  const globalTimeRef = useRef(0);
  const ambientTimerRef = useRef(0);
  const passiveDropTimerRef = useRef(0);
  const cloudsRef = useRef<{ x: number; y: number; speed: number; scale: number; alpha: number }[]>([
    { x: 30, y: 50, speed: 10, scale: 0.85, alpha: 0.65 },
    { x: 260, y: 85, speed: 16, scale: 1.15, alpha: 0.75 },
    { x: 500, y: 40, speed: 12, scale: 0.9, alpha: 0.6 },
  ]);

  // Multi-Pet Roaming Simulation Entities Ref (Simulates ALL Unlocked Pets)
  const petEntitiesRef = useRef<RoamingPetEntity[]>([]);

  // Helper to create or sync roaming pet entities for all unlocked pets
  const syncRoamingPetEntities = useCallback((unlockedIds: string[]) => {
    const currentList = petEntitiesRef.current;
    const safeIds = unlockedIds && unlockedIds.length > 0 ? unlockedIds : ['pip'];

    const newList: RoamingPetEntity[] = [];

    safeIds.forEach((id, index) => {
      const existing = currentList.find((p) => p.id === id);
      if (existing) {
        newList.push(existing);
      } else {
        newList.push(createRoamingPetEntity(id, index, safeIds.length, canvasWidth));
      }
    });

    petEntitiesRef.current = newList;
  }, [canvasWidth]);

  // Immediately initialize pet entities on mount
  useEffect(() => {
    const currentUnlocked = savedData?.unlockedPets ?? unlockedPetIds;
    syncRoamingPetEntities(currentUnlocked);
  }, [unlockedPetIds, savedData, syncRoamingPetEntities]);

  // Idle hint tracking
  const idleHintTimerRef = useRef(0);
  const hintPairRef = useRef<[{r: number; c: number}, {r: number; c: number}] | null>(
    null,
  );

  // Helper to get active treat pool for current level
  const getActiveTreatPool = useCallback((targetLvl: number) => {
    const config = getLevelConfig(targetLvl, savedData?.unlockedPets ?? unlockedPetIds);
    return config.activeTreatPool;
  }, [savedData, unlockedPetIds]);

  // --- MATCH-3 HELPER FUNCTIONS ---
  const getCellCenter = (r: number, c: number) => {
    return {
      x: boardMarginX + c * cellSize + cellSize / 2,
      y: boardStartY + r * cellSize + cellSize / 2,
    };
  };

  const createRandomPiece = (r: number, c: number, allowBomb = false, treatPool?: TreatType[]): BoardPiece => {
    const pool = treatPool && treatPool.length > 0 ? treatPool : getActiveTreatPool(gameStateRef.current.level);
    const type = pool[Math.floor(Math.random() * pool.length)] || 'berry';
    const targetX = boardMarginX + c * cellSize + cellSize / 2;
    const targetY = boardStartY + r * cellSize + cellSize / 2;
    
    // Gizmo Passive Perk: +15% chance of special treats / bombs
    const isGizmoActive = selectedPetIdRef.current === 'gizmo';
    // Celestial Canopy Perk: +5% extra special treat spawn chance per level above 1
    const canopyLvl = habitatBuildingsRef.current?.celestial_canopy || 1;
    const canopyBonus = (canopyLvl - 1) * 0.05;

    const baseBombChance = isGizmoActive ? 0.35 : 0.20;
    const bombThreshold = Math.min(0.60, baseBombChance + canopyBonus);
    const isBomb = allowBomb && (type === 'pepper' || Math.random() < 0.08) && Math.random() < bombThreshold;

    return {
      id: nextPieceIdRef.current++,
      type,
      special: isBomb ? 'pepper_bomb' : undefined,
      obstacle: undefined,
      iceLayer: 0,
      row: r,
      col: c,
      drawX: targetX,
      drawY: targetY - 260,
      targetX,
      targetY,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      isSettling: true,
    };
  };

  const findMatchesOnBoard = (board: (BoardPiece | null)[][]) => {
    const matchedCoords = new Set<string>();
    const matchGroups: {
      type: TreatType;
      coords: {r: number; c: number}[];
      hasSpecial: boolean;
      hasBomb: boolean;
    }[] = [];

    // Horizontal check
    for (let r = 0; r < ROWS; r++) {
      let currentType: TreatType | null = null;
      let streak: {r: number; c: number}[] = [];
      for (let c = 0; c < COLS; c++) {
        const piece = board[r]?.[c];
        if (piece && (!currentType || piece.type === currentType)) {
          currentType = piece.type;
          streak.push({r, c});
        } else {
          if (streak.length >= 3 && currentType) {
            const hasBomb = streak.some((pt) => board[pt.r]?.[pt.c]?.special === 'pepper_bomb');
            matchGroups.push({
              type: currentType,
              coords: [...streak],
              hasSpecial: streak.some((pt) => !!board[pt.r]?.[pt.c]?.special),
              hasBomb,
            });
            streak.forEach((pt) => matchedCoords.add(`${pt.r},${pt.c}`));
          }
          if (piece) {
            currentType = piece.type;
            streak = [{r, c}];
          } else {
            currentType = null;
            streak = [];
          }
        }
      }
      if (streak.length >= 3 && currentType) {
        const hasBomb = streak.some((pt) => board[pt.r]?.[pt.c]?.special === 'pepper_bomb');
        matchGroups.push({
          type: currentType,
          coords: [...streak],
          hasSpecial: streak.some((pt) => !!board[pt.r]?.[pt.c]?.special),
          hasBomb,
        });
        streak.forEach((pt) => matchedCoords.add(`${pt.r},${pt.c}`));
      }
    }

    // Vertical check
    for (let c = 0; c < COLS; c++) {
      let currentType: TreatType | null = null;
      let streak: {r: number; c: number}[] = [];
      for (let r = 0; r < ROWS; r++) {
        const piece = board[r]?.[c];
        if (piece && (!currentType || piece.type === currentType)) {
          currentType = piece.type;
          streak.push({r, c});
        } else {
          if (streak.length >= 3 && currentType) {
            const hasBomb = streak.some((pt) => board[pt.r]?.[pt.c]?.special === 'pepper_bomb');
            matchGroups.push({
              type: currentType,
              coords: [...streak],
              hasSpecial: streak.some((pt) => !!board[pt.r]?.[pt.c]?.special),
              hasBomb,
            });
            streak.forEach((pt) => matchedCoords.add(`${pt.r},${pt.c}`));
          }
          if (piece) {
            currentType = piece.type;
            streak = [{r, c}];
          } else {
            currentType = null;
            streak = [];
          }
        }
      }
      if (streak.length >= 3 && currentType) {
        const hasBomb = streak.some((pt) => board[pt.r]?.[pt.c]?.special === 'pepper_bomb');
        matchGroups.push({
          type: currentType,
          coords: [...streak],
          hasSpecial: streak.some((pt) => !!board[pt.r]?.[pt.c]?.special),
          hasBomb,
        });
        streak.forEach((pt) => matchedCoords.add(`${pt.r},${pt.c}`));
      }
    }

    return {matchedCoords, matchGroups};
  };

  const isPieceImmovable = (p: BoardPiece | null | undefined): boolean => {
    if (!p) return false;
    if (p.obstacle && p.obstacle.layer > 1) return true;
    if (p.iceLayer && p.iceLayer > 1) return true;
    return false;
  };

  const checkHasValidMoves = (board: (BoardPiece | null)[][]): boolean => {
    const b = board.map((row) =>
      row.map((cell) => (cell ? {...cell} : null)),
    );
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const pCurrent = b[r][c];
        if (!pCurrent || isPieceImmovable(pCurrent)) continue;

        // Swap right
        if (c + 1 < COLS) {
          const pRight = b[r][c + 1];
          if (pRight && !isPieceImmovable(pRight)) {
            const temp = b[r][c];
            b[r][c] = b[r][c + 1];
            b[r][c + 1] = temp;
            const {matchedCoords} = findMatchesOnBoard(b);
            b[r][c + 1] = b[r][c];
            b[r][c] = temp;
            if (matchedCoords.size >= 3) {
              hintPairRef.current = [
                {r, c},
                {r, c: c + 1},
              ];
              return true;
            }
          }
        }
        // Swap down
        if (r + 1 < ROWS) {
          const pDown = b[r + 1][c];
          if (pDown && !isPieceImmovable(pDown)) {
            const temp = b[r][c];
            b[r][c] = b[r + 1][c];
            b[r + 1][c] = temp;
            const {matchedCoords} = findMatchesOnBoard(b);
            b[r + 1][c] = b[r][c];
            b[r][c] = temp;
            if (matchedCoords.size >= 3) {
              hintPairRef.current = [
                {r, c},
                {r: r + 1, c},
              ];
              return true;
            }
          }
        }
      }
    }
    hintPairRef.current = null;
    return false;
  };

  const initBoard = (targetLvl = gameStateRef.current.level) => {
    const lvlCfg = getLevelConfig(targetLvl, savedData?.unlockedPets ?? unlockedPetIds);
    const pool = lvlCfg.activeTreatPool;
    let newBoard: (BoardPiece | null)[][] = [];
    let attempts = 0;

    do {
      newBoard = [];
      for (let r = 0; r < ROWS; r++) {
        const row: (BoardPiece | null)[] = [];
        for (let c = 0; c < COLS; c++) {
          let allowedTypes = [...pool];
          if (
            c >= 2 &&
            row[c - 1]?.type &&
            row[c - 2]?.type &&
            row[c - 1]!.type === row[c - 2]!.type
          ) {
            allowedTypes = allowedTypes.filter((t) => t !== row[c - 1]!.type);
          }
          if (
            r >= 2 &&
            newBoard[r - 1]?.[c]?.type &&
            newBoard[r - 2]?.[c]?.type &&
            newBoard[r - 1]![c]!.type === newBoard[r - 2]![c]!.type
          ) {
            allowedTypes = allowedTypes.filter(
              (t) => t !== newBoard[r - 1]![c]!.type,
            );
          }
          const chosenType =
            allowedTypes[Math.floor(Math.random() * allowedTypes.length)] ||
            pool[0] ||
            'berry';
          const {x, y} = getCellCenter(r, c);
          row.push({
            id: nextPieceIdRef.current++,
            type: chosenType,
            special: undefined,
            obstacle: undefined,
            iceLayer: 0,
            row: r,
            col: c,
            drawX: x,
            drawY: y,
            targetX: x,
            targetY: y,
            scale: 1,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            isSettling: false,
          });
        }
        newBoard.push(row);
      }
      attempts++;
    } while (!checkHasValidMoves(newBoard) && attempts < 50);

    // Seed procedural dynamic obstacles (Ice, Honey, Crates)
    if (lvlCfg.obstacleCount > 0 && lvlCfg.obstacleTypes.length > 0) {
      const candidates: {r: number; c: number}[] = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          candidates.push({r, c});
        }
      }
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const actualCount = Math.min(lvlCfg.obstacleCount, candidates.length);
      for (let i = 0; i < actualCount; i++) {
        const {r, c} = candidates[i];
        if (newBoard[r]?.[c]) {
          const obsType = lvlCfg.obstacleTypes[Math.floor(Math.random() * lvlCfg.obstacleTypes.length)];
          const layer = lvlCfg.maxObstacleLayers > 1 && Math.random() < 0.45 ? 2 : 1;
          newBoard[r][c]!.obstacle = { type: obsType, layer };
          if (obsType === 'ice') {
            newBoard[r][c]!.iceLayer = layer;
          }
        }
      }
    }

    // Seed Pepper Bomb on higher levels (boosted by Gizmo if active)
    const isGizmoActive = selectedPetIdRef.current === 'gizmo';
    const effectiveBombChance = isGizmoActive ? Math.max(0.15, lvlCfg.bombChance + 0.15) : lvlCfg.bombChance;
    if (effectiveBombChance > 0) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (
            newBoard[r]?.[c] &&
            !newBoard[r][c]!.obstacle &&
            Math.random() < effectiveBombChance
          ) {
            newBoard[r][c]!.special = 'pepper_bomb';
          }
        }
      }
    }

    // --- MIMI THE FOX PASSIVE BONUS: SHATTER 3 RANDOM OBSTACLES AT MATCH START ---
    if (selectedPetIdRef.current === 'mimi') {
      const obstacledPieces: {r: number; c: number}[] = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (newBoard[r]?.[c]?.obstacle || (newBoard[r]?.[c]?.iceLayer && newBoard[r][c]!.iceLayer! > 0)) {
            obstacledPieces.push({r, c});
          }
        }
      }

      if (obstacledPieces.length > 0) {
        // Shuffle & clear up to 3
        for (let i = obstacledPieces.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [obstacledPieces[i], obstacledPieces[j]] = [obstacledPieces[j], obstacledPieces[i]];
        }
        const toClear = obstacledPieces.slice(0, 3);
        toClear.forEach(({r, c}) => {
          if (newBoard[r]?.[c]) {
            newBoard[r][c]!.obstacle = undefined;
            newBoard[r][c]!.iceLayer = 0;
            const {x, y} = getCellCenter(r, c);
            setTimeout(() => {
              spawnParticles(x, y, '#ea580c', 16, 'fire');
              spawnParticles(x, y, '#facc15', 10, 'sparkle');
            }, 300);
          }
        });
        setTimeout(() => {
          gameAudio.playPowerupChime();
          addFloatingText('MIMI: MYSTIC PURGE! 🦊✨ -3 OBSTACLES!', canvasWidth / 2, boardStartY + 80, '#f97316');
        }, 350);
      }
    }

    boardRef.current = newBoard;
  };

  const spawnParticles = (
    x: number,
    y: number,
    color: string,
    count = 14,
    shape: Particle['shape'] = 'circle',
  ) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 210 + 60;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 70,
        color,
        size: Math.random() * 9 + 4,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.55 + 0.45,
        shape,
      });
    }
  };

  const spawnFlyingMotes = (
    startX: number,
    startY: number,
    type: TreatType,
    count = 2,
  ) => {
    const meta = TREAT_METAS[type] || TREAT_METAS.berry;
    const color = meta.color;

    for (let i = 0; i < count; i++) {
      const swingDir = Math.random() < 0.5 ? -1 : 1;
      const cpX = (startX + canvasWidth / 2) / 2 + swingDir * (Math.random() * 140 + 70);
      const cpY = (startY + 240) / 2 - (Math.random() * 120 + 50);

      motesRef.current.push({
        id: nextMoteIdRef.current++,
        startX,
        startY,
        x: startX,
        y: startY,
        cpX,
        cpY,
        progress: 0,
        speed: Math.random() * 0.35 + 1.15,
        type,
        color,
        size: Math.random() * 6 + 18,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 8,
      });
    }
  };

  const spawnCelebrationParticle = () => {
    const colors = ['#f43f5e', '#ec4899', '#facc15', '#38bdf8', '#4ade80', '#a855f7', '#f97316'];
    const shapes: Particle['shape'][] = ['candy', 'star', 'heart', 'sparkle', 'balloon', 'coin', 'paw'];
    const startX = Math.random() * canvasWidth;
    const startY = Math.random() * (canvasHeight * 0.5);
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 220 + 80;
    particlesRef.current.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 12 + 6,
      alpha: 1,
      life: 0,
      maxLife: Math.random() * 1.5 + 1.0,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    });
  };

  const addFloatingText = (
    text: string,
    x: number,
    y: number,
    color = '#fef08a',
  ) => {
    floatingTextsRef.current.push({
      id: nextTextIdRef.current++,
      text,
      x,
      y,
      vy: -75,
      color,
      alpha: 1,
      scale: 1.2,
      life: 0,
    });
  };

  const spawnHabitatDrop = (type: TreatType, isSuper = false, isSpicyBomb = false, customX?: number, customY?: number) => {
    const spawnX = customX !== undefined ? customX : Math.random() * (canvasWidth - 220) + 110;
    const spawnY = customY !== undefined ? customY : -20;
    const drop: HabitatDrop = {
      id: nextDropIdRef.current++,
      type,
      isSuper,
      isSpicyBomb,
      x: Math.max(90, Math.min(canvasWidth - 90, spawnX)),
      y: spawnY,
      vx: (Math.random() - 0.5) * 80,
      vy: customY !== undefined ? Math.random() * 40 - 20 : Math.random() * 90 + 130,
      rotation: (Math.random() - 0.5) * 0.5,
      vRot: (Math.random() - 0.5) * 4,
      groundY: 275 + Math.random() * 20,
      bounces: 0,
      state: 'falling',
      lifeTime: 0,
    };
    dropsRef.current.push(drop);

    if (isSpicyBomb) {
      gameAudio.playChiptuneExplosion();
    } else if (isSuper) {
      gameAudio.playPowerupChime();
    } else {
      gameAudio.playCoinPickup();
    }

    // Alert all unlocked roaming pets to scamper over!
    const allPets = petEntitiesRef.current;
    allPets.forEach((pet) => {
      pet.targetX = drop.x + (Math.random() - 0.5) * 40;
      pet.facingRight = drop.x > pet.x;
      if (pet.state === 'NORMAL' || pet.state === 'NAPPING') {
        pet.state = 'NORMAL';
        if (Math.random() < 0.6) {
          const alertEmotes = ['Treat! 🍓', 'Ooh! 😋', 'Yum! ✨', 'Mine! 🐾', 'Snack! 🎈'];
          pet.speechText = alertEmotes[Math.floor(Math.random() * alertEmotes.length)];
          pet.speechTimer = 1.8;
          if (pet.y >= pet.groundY) pet.vy = -90;
        }
      }
    });
  };

  // --- TRIGGER MULTI-PET SLAPSTICK & JOYFUL REACTION ---
  const triggerPetReaction = (type: TreatType, triggeringPetId?: string) => {
    const currentCompanionId = selectedPetIdRef.current;
    const allPets = petEntitiesRef.current;
    if (!allPets || allPets.length === 0) return;

    allPets.forEach((pet) => {
      const isCompanion = pet.id === currentCompanionId;
      const isTriggering = triggeringPetId ? pet.id === triggeringPetId : isCompanion;
      const petDef = PET_REGISTRY.find((p) => p.id === pet.id) || PET_REGISTRY[0];
      const isPetFavorite = pet.favoriteTreat === type;

      if (type === 'pepper') {
        if (isTriggering) {
          pet.state = 'SPICY';
          pet.stateTimer = 3.6;
          pet.vx = pet.facingRight ? 480 : -480;
          pet.vy = -190;
          pet.speechText = 'SPICY TURBO! 🔥';
          pet.speechTimer = 3.0;
          gameAudio.playChiptuneExplosion();
          addFloatingText(`${petDef.name.split(' ')[0].toUpperCase()}: SPICY TURBO! 🔥`, pet.x, pet.y - 70, '#ef4444');
          spawnParticles(pet.x, pet.y - 30, '#ea580c', 28, 'fire');
        } else {
          pet.vy = -120;
          pet.speechText = '🔥 Whoa!';
          pet.speechTimer = 1.8;
          spawnParticles(pet.x, pet.y - 30, '#f97316', 8, 'fire');
        }
      } else if (type === 'ice') {
        if (isTriggering) {
          pet.state = 'FROZEN';
          pet.stateTimer = 3.0;
          pet.vx = 0;
          pet.vy = 0;
          pet.speechText = 'BRAIN FREEZE! ❄️';
          pet.speechTimer = 2.5;
          addFloatingText(`${petDef.name.split(' ')[0].toUpperCase()}: BRAIN FREEZE! ❄️`, pet.x, pet.y - 70, '#38bdf8');
          spawnParticles(pet.x, pet.y - 30, '#bae6fd', 25, 'frost');
        } else {
          pet.speechText = '❄️ Brrr!';
          pet.speechTimer = 1.8;
          spawnParticles(pet.x, pet.y - 30, '#bae6fd', 6, 'frost');
        }
      } else if (type === 'balloon') {
        pet.state = pet.id === 'gizmo' ? 'GLIDING' : 'FLOATING';
        pet.stateTimer = isTriggering ? 4.0 : 2.5;
        pet.vy = -95;
        if (isTriggering) {
          pet.speechText = pet.id === 'gizmo' ? 'SOARING GLIDE! 🐿️🎈' : 'FLOATING HIGH! 🎈';
          pet.speechTimer = 3.0;
          gameAudio.playPowerupChime();
          addFloatingText(`${petDef.name.split(' ')[0].toUpperCase()}: FLOATING HIGH! 🎈`, pet.x, pet.y - 70, '#fbbf24');
          spawnParticles(pet.x, pet.y - 30, '#fde047', 22, 'sparkle');
        } else {
          pet.speechText = '🎈 Wheee!';
          pet.speechTimer = 1.8;
          spawnParticles(pet.x, pet.y - 30, '#facc15', 8, 'sparkle');
        }
      } else {
        // Standard or Favorite treats (berry, carrot, bamboo, acorn, bone_biscuit, star_berry, honey_pot)
        pet.state = 'DANCING';
        pet.stateTimer = isPetFavorite || isTriggering ? 3.0 : 1.8;
        pet.vy = isPetFavorite ? -240 : isTriggering ? -200 : -140;
        const treatMeta = TREAT_METAS[type] || TREAT_METAS.berry;

        if (isPetFavorite) {
          pet.speechText = `${petDef.name.split(' ')[0]}: My Favorite ${treatMeta.name}! 💖`;
          pet.speechTimer = 2.8;
          addFloatingText(`${petDef.name.split(' ')[0].toUpperCase()}: FAVORITE ${treatMeta.emoji} (+50% ♥)`, pet.x, pet.y - 70, petDef.accentColor);
          spawnParticles(pet.x, pet.y - 30, treatMeta.color, 24, 'heart');
          spawnParticles(pet.x, pet.y - 30, '#fef08a', 12, 'star');
        } else if (isTriggering) {
          pet.speechText = `${petDef.name.split(' ')[0]}: Yummy ${treatMeta.name}! ${treatMeta.emoji}`;
          pet.speechTimer = 2.2;
          addFloatingText(`YUMMY ${treatMeta.name.toUpperCase()}! ${treatMeta.emoji}`, pet.x, pet.y - 70, treatMeta.color);
          spawnParticles(pet.x, pet.y - 30, treatMeta.color, 16, 'heart');
        } else {
          pet.speechText = `✨ Yum ${treatMeta.emoji}!`;
          pet.speechTimer = 1.6;
          spawnParticles(pet.x, pet.y - 30, treatMeta.color, 6, 'sparkle');
        }
      }
    });
  };

  // --- CASCADE MATCH-3 PROCESSING WITH PASSIVE & PET FAVORITE BONUSES ---
  const processMatchesAndCascades = async (combo = 1) => {
    isProcessingRef.current = true;
    idleHintTimerRef.current = 0;

    const currentBoard = boardRef.current;
    const {matchedCoords, matchGroups} = findMatchesOnBoard(currentBoard);

    if (matchedCoords.size === 0) {
      if (!checkHasValidMoves(boardRef.current)) {
        addFloatingText('BOARD RESHUFFLED!', canvasWidth / 2, boardStartY + 200, '#a855f7');
        gameAudio.playPowerupChime();
        initBoard();
      }

      // Check if player is out of moves and hasn't reached target happiness
      const curLvlCfg = getLevelConfig(gameStateRef.current.level, savedData?.unlockedPets ?? unlockedPetIds);
      if (gameStateRef.current.moves !== undefined && gameStateRef.current.moves <= 0) {
        if (gameStateRef.current.score < curLvlCfg.targetHappiness) {
          // Trigger SAVE YOUR STREAK modal dialog
          setIsSaveStreakModalOpen(true);
        } else {
          setGameState((prev) => ({...prev, status: 'VICTORY'}));
        }
      }

      isProcessingRef.current = false;
      return;
    }

    let gainedScore = 0;
    let balloonPiecesCount = 0;
    const pointsPerPiece = getConfig('pointsPerMatchPiece') as number;
    const superBonus = getConfig('superMatchBonus') as number;
    let hadBombExplosion = false;

    // Active companion definition & bonuses
    const activeCompanion = PET_REGISTRY.find((p) => p.id === selectedPetIdRef.current) || PET_REGISTRY[0];
    const isPipActive = activeCompanion.id === 'pip';
    const baseMultiplier = isPipActive ? 1.10 : 1.0;
    const lvlCfg = getLevelConfig(gameStateRef.current.level, savedData?.unlockedPets ?? unlockedPetIds);
    const biomeSigTreat = lvlCfg.biome.signatureTreat;

    // Count balloon tiles matched
    matchGroups.forEach((group) => {
      if (group.type === 'balloon') {
        balloonPiecesCount += group.coords.length;
      }
    });

    if (balloonPiecesCount > 0) {
      // Award persistent balloon currency (+1 per balloon piece)
      setBalloons((prev) => {
        const nextBalloons = prev + balloonPiecesCount;
        saveGameProgress({ balloons: nextBalloons });
        return nextBalloons;
      });
      addFloatingText(`+${balloonPiecesCount} 🎈`, canvasWidth / 2 + 60, boardStartY - 10, '#facc15');

      if (balloonPiecesCount >= 3) {
        triggerPetReaction('balloon');
      }
    }

    // Check for Pepper Bomb Blasts
    matchGroups.forEach((group) => {
      if (group.hasBomb) {
        hadBombExplosion = true;
        group.coords.forEach((pt) => {
          const piece = currentBoard[pt.r]?.[pt.c];
          if (piece?.special === 'pepper_bomb') {
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const nr = pt.r + dr;
                const nc = pt.c + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                  matchedCoords.add(`${nr},${nc}`);
                  const targetPiece = currentBoard[nr]?.[nc];
                  if (targetPiece) {
                    targetPiece.obstacle = undefined;
                    targetPiece.iceLayer = 0;
                    const {x, y} = getCellCenter(nr, nc);
                    spawnParticles(x, y, '#f97316', 15, 'fire');
                  }
                }
              }
            }
          }
        });
      }
    });

    // Damage & Break Obstacles on adjacent tiles or matched tiles
    matchedCoords.forEach((coordStr) => {
      const [r, c] = coordStr.split(',').map(Number);
      const neighbours = [
        {r, c}, // current matched cell
        {r: r - 1, c},
        {r: r + 1, c},
        {r, c: c - 1},
        {r, c: c + 1},
      ];
      neighbours.forEach((nb) => {
        if (nb.r >= 0 && nb.r < ROWS && nb.c >= 0 && nb.c < COLS) {
          const adjPiece = currentBoard[nb.r]?.[nb.c];
          if (adjPiece && (adjPiece.obstacle || (adjPiece.iceLayer && adjPiece.iceLayer > 0))) {
            const {x, y} = getCellCenter(nb.r, nb.c);
            const obsType = adjPiece.obstacle?.type || 'ice';
            let curLayer = adjPiece.obstacle?.layer || adjPiece.iceLayer || 1;
            curLayer--;

            if (curLayer <= 0) {
              adjPiece.obstacle = undefined;
              adjPiece.iceLayer = 0;
              if (obsType === 'ice') {
                spawnParticles(x, y, '#bae6fd', 16, 'frost');
                addFloatingText('ICE CLEARED! ❄️🔨', x, y - 20, '#38bdf8');
              } else if (obsType === 'honey') {
                spawnParticles(x, y, '#fbbf24', 16, 'sparkle');
                addFloatingText('HONEY SCOOPED! 🍯✨', x, y - 20, '#facc15');
              } else {
                spawnParticles(x, y, '#d97706', 16, 'candy');
                addFloatingText('CRATE BROKEN! 📦💥', x, y - 20, '#f97316');
              }
              gameAudio.playShieldBlock();
            } else {
              if (adjPiece.obstacle) adjPiece.obstacle.layer = curLayer;
              if (adjPiece.iceLayer) adjPiece.iceLayer = curLayer;
              if (obsType === 'ice') spawnParticles(x, y, '#bae6fd', 10, 'frost');
              else if (obsType === 'honey') spawnParticles(x, y, '#fbbf24', 10, 'sparkle');
              else spawnParticles(x, y, '#d97706', 10, 'candy');
              gameAudio.playCrispClick();
            }
          }
        }
      });
    });

    matchGroups.forEach((group) => {
      const isSuper = group.coords.length >= 4;
      const meta = TREAT_METAS[group.type] || TREAT_METAS.berry;

      // Pet Favorite Treat Bonus (+50% bonus if matching active pet's favorite treat!)
      const isFavoriteTreat = group.type === activeCompanion.favoriteTreat;
      const isBiomeSigTreat = group.type === biomeSigTreat;

      let treatMultiplier = baseMultiplier;
      if (isFavoriteTreat) {
        treatMultiplier *= 1.5; // +50% Favorite Treat Happiness Charge!
      } else if (isBiomeSigTreat) {
        treatMultiplier *= 1.25; // +25% Biome Resonance Bonus!
      }

      const baseGroupScore =
        group.coords.length * pointsPerPiece * combo +
        (isSuper ? superBonus : 0) +
        (group.hasBomb ? 150 : 0);
      
      const groupScore = Math.round(baseGroupScore * treatMultiplier);
      gainedScore += groupScore;

      if (isSuper) {
        screenShakeRef.current = { timer: 0.22, intensity: 7 };
      }

      if (isFavoriteTreat) {
        addFloatingText(`${activeCompanion.emoji} FAVORITE ${meta.name.toUpperCase()}! (+50% ♥)`, canvasWidth / 2, boardStartY - 35, activeCompanion.accentColor);
        gameAudio.playPowerupChime();
      }

      // Drop treats into habitat
      spawnHabitatDrop(group.type, isSuper, group.hasBomb);
      if (isSuper) {
        setTimeout(() => spawnHabitatDrop(group.type, true), 120);
      }

      group.coords.forEach((pt) => {
        const piece = currentBoard[pt.r]?.[pt.c];
        if (piece) {
          piece.isClearing = true;
          const {x, y} = getCellCenter(pt.r, pt.c);
          
          // Rich particle burst + confetti spark
          spawnParticles(x, y, meta.color, isSuper ? 20 : 12, isSuper ? 'star' : 'sparkle');
          spawnParticles(x, y, '#fef08a', 6, 'star');

          // Smooth arcing flying mote heading up to feed companion pet
          spawnFlyingMotes(x, y, group.type, isSuper ? 3 : 2);
        }
      });
    });

    if (hadBombExplosion) {
      gameAudio.playChiptuneExplosion();
      screenShakeRef.current = { timer: 0.28, intensity: 11 };
      addFloatingText('SPICY BOMB EXPLOSION! 🔥💣', canvasWidth / 2, boardStartY - 30, '#f97316');
    }

    if (combo >= 2) {
      const comboTitles = [
        'TASTY MATCH!',
        'YUMMY COMBO!',
        'SUPER FEAST!',
        'PET FRENZY! 🌟',
        'ULTRA DELICIOUS! 👑',
      ];
      const title = comboTitles[Math.min(comboTitles.length - 1, combo - 2)];
      setComboBanner({
        text: `${combo}x ${title}`,
        subtext: `+${gainedScore} Happiness!`,
        tier: combo,
        key: Date.now(),
      });
      screenShakeRef.current = {
        timer: 0.24,
        intensity: Math.min(14, 5 + combo * 2.5),
      };
      gameAudio.playLevelUpStinger();
      console.log('COMBO_COUNT', combo);

      if (matchGroups.length > 0) {
        triggerPetReaction(matchGroups[0].type);
      }
    } else {
      gameAudio.playCoinPickup();
    }

    const curLvlTarget = lvlCfg.targetHappiness;

    // Update Happiness Score in state
    setGameState((prev) => {
      const newScore = prev.score + gainedScore;
      console.log('SCORE_UPDATED', newScore);
      let newStatus = prev.status;
      if (newScore >= curLvlTarget) {
        newStatus = 'VICTORY';
      }
      return {...prev, score: newScore, status: newStatus};
    });

    await new Promise((resolve) => setTimeout(resolve, 220));

    // Clear matched cells
    matchedCoords.forEach((coordStr) => {
      const [r, c] = coordStr.split(',').map(Number);
      if (currentBoard[r]) currentBoard[r][c] = null;
    });

    // Apply Gravity with Active Treat Pool
    const bombChance = lvlCfg.bombChance;
    const treatPool = lvlCfg.activeTreatPool;
    for (let c = 0; c < COLS; c++) {
      let emptyRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (currentBoard[r][c] !== null) {
          if (emptyRow !== r) {
            currentBoard[emptyRow][c] = currentBoard[r][c];
            currentBoard[r][c] = null;
            if (currentBoard[emptyRow][c]) {
              currentBoard[emptyRow][c]!.row = emptyRow;
              const {x, y} = getCellCenter(emptyRow, c);
              currentBoard[emptyRow][c]!.targetX = x;
              currentBoard[emptyRow][c]!.targetY = y;
              currentBoard[emptyRow][c]!.isSettling = true;
            }
          }
          emptyRow--;
        }
      }
      // Fill remaining empty spots from top using dynamic treat pool
      for (let r = emptyRow; r >= 0; r--) {
        const newP = createRandomPiece(r, c, bombChance > 0, treatPool);
        const {x, y} = getCellCenter(r, c);
        newP.drawY = boardStartY - (emptyRow - r + 1) * cellSize;
        newP.targetX = x;
        newP.targetY = y;
        newP.isSettling = true;
        currentBoard[r][c] = newP;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 260));
    await processMatchesAndCascades(combo + 1);
  };

  // --- PLAYER SWAP ACTION ---
  const handleSwap = async (r1: number, c1: number, r2: number, c2: number) => {
    if (isProcessingRef.current || gameStateRef.current.status !== 'PLAYING')
      return;

    const b = boardRef.current;
    const p1 = b[r1]?.[c1];
    const p2 = b[r2]?.[c2];
    if (!p1 || !p2) return;

    if (isPieceImmovable(p1) || isPieceImmovable(p2)) {
      gameAudio.playErrorBuzz();
      addFloatingText('LOCKED TILE! Match next to it! 🔨', canvasWidth / 2, boardStartY + 100, '#38bdf8');
      p1.shakeTimer = 0.25;
      p2.shakeTimer = 0.25;
      return;
    }

    isProcessingRef.current = true;
    idleHintTimerRef.current = 0;
    gameAudio.playCrispClick();

    b[r1][c1] = p2;
    b[r2][c2] = p1;
    p1.row = r2;
    p1.col = c2;
    p2.row = r1;
    p2.col = c1;

    const c1Pos = getCellCenter(r1, c1);
    const c2Pos = getCellCenter(r2, c2);
    p1.targetX = c2Pos.x;
    p1.targetY = c2Pos.y;
    p2.targetX = c1Pos.x;
    p2.targetY = c1Pos.y;

    await new Promise((resolve) => setTimeout(resolve, 190));

    const {matchedCoords} = findMatchesOnBoard(b);

    if (matchedCoords.size > 0) {
      setGameState((prev) => {
        const curCfg = getLevelConfig(prev.level, savedData?.unlockedPets ?? unlockedPetIds);
        const movesLeft = Math.max(0, (prev.moves ?? curCfg.startingMoves) - 1);
        console.log('MOVE_MADE', `Moves left: ${movesLeft}`);
        return {...prev, moves: movesLeft};
      });

      await processMatchesAndCascades(1);
    } else {
      gameAudio.playErrorBuzz();
      p1.shakeTimer = 0.25;
      p2.shakeTimer = 0.25;

      b[r1][c1] = p1;
      b[r2][c2] = p2;
      p1.row = r1;
      p1.col = c1;
      p2.row = r2;
      p2.col = c2;
      p1.targetX = c1Pos.x;
      p1.targetY = c1Pos.y;
      p2.targetX = c2Pos.x;
      p2.targetY = c2Pos.y;

      await new Promise((resolve) => setTimeout(resolve, 200));
      isProcessingRef.current = false;
    }
  };

  // --- HABITAT PETTING & TREAT TAPPING INTERACTION (SUPPORTS ALL UNLOCKED PETS) ---
  const handlePetHabitat = (clickX: number, clickY: number) => {
    const curLvlTarget = currentLevelConfig.targetHappiness;
    const baseGain = getConfig('petHappinessGain') as number;
    // Food Bowl Perk: +25% petting happiness gain per level
    const foodBowlLvl = habitatBuildingsRef.current.food_bowl || 1;
    const foodMultiplier = 1 + (foodBowlLvl - 1) * 0.25;
    const petGain = Math.round(baseGain * foodMultiplier);

    const pets = petEntitiesRef.current;

    // Check if clicked near the Food Bowl structure (x: 180, y: 300)
    const distToBowl = Math.hypot(clickX - 180, clickY - 300);
    if (distToBowl < 45) {
      // Tap food bowl to immediately spawn treats for all pets!
      const randomTreat = TREAT_TYPES[Math.floor(Math.random() * TREAT_TYPES.length)];
      spawnHabitatDrop(randomTreat, foodBowlLvl >= 3, false, 180, 260);
      spawnParticles(180, 290, '#fbbf24', 16, 'sparkle');
      addFloatingText(`BOWL FEAST! 🥣✨ (+${foodBowlLvl}x Treats)`, 180, 250, '#fde047');
      gameAudio.playPowerupChime();
      return true;
    }

    // Check if clicked near the Treehouse & Play Log structure (x: 540, y: 280)
    const distToTreehouse = Math.hypot(clickX - 540, clickY - 275);
    if (distToTreehouse < 50) {
      // Trigger Treehouse Acrobatic frenzy for island pets!
      pets.forEach((p) => {
        p.targetX = 540 + (Math.random() - 0.5) * 60;
        p.vy = -180;
        p.state = 'DANCING';
        p.stateTimer = 2.5;
        p.speechText = 'Treehouse Play! 🏡🎉';
        p.speechTimer = 2.0;
      });
      spawnParticles(540, 270, '#34d399', 18, 'star');
      addFloatingText('TREEHOUSE PLAYTIME! 🏡✨', 540, 230, '#6ee7b7');
      gameAudio.playRetroJump();
      return true;
    }

    // Find clicked pet closest to click position
    let closestPet: RoamingPetEntity | null = null;
    let minDist = 70;

    for (const p of pets) {
      const dist = Math.hypot(clickX - p.x, clickY - (p.y - 30));
      if (dist < minDist) {
        minDist = dist;
        closestPet = p;
      }
    }

    if (closestPet) {
      const clickedPet = closestPet;
      const petDef = PET_REGISTRY.find((p) => p.id === clickedPet.id) || PET_REGISTRY[0];

      clickedPet.state = 'PETTED';
      clickedPet.stateTimer = 1.4;
      clickedPet.petSquishTimer = 0.5;
      clickedPet.vy = -160;

      const loveMessages: Record<string, string> = {
        pip: 'Pip Loves You! ♥ 🐰',
        bao: 'Bao Purrs Softly! 🐼 ♥',
        gizmo: 'Gizmo Chitters Happily! 🐿️ ✨',
        coco: 'Coco Barks & Wiggles! 🐶 💖',
        mimi: 'Mimi Mystically Smiles! 🦊 ✨',
      };

      clickedPet.speechText = loveMessages[clickedPet.id] || `${petDef.name} Loves You! ♥`;
      clickedPet.speechTimer = 2.4;

      setGameState((prev) => {
        const newScore = prev.score + petGain;
        console.log('SCORE_UPDATED', newScore);
        const newStatus = newScore >= curLvlTarget ? 'VICTORY' : prev.status;
        return {...prev, score: newScore, status: newStatus};
      });

      addFloatingText(`+${petGain} ♥ ${clickedPet.speechText}`, clickedPet.x, clickedPet.y - 80, petDef.color);
      spawnParticles(clickedPet.x, clickedPet.y - 40, petDef.color, 18, 'heart');
      gameAudio.playRetroJump();

      // Nearby pets also react joyfully
      pets.forEach((other) => {
        if (other.id !== clickedPet.id) {
          const d = Math.hypot(other.x - clickedPet.x, other.y - clickedPet.y);
          if (d < 220) {
            other.facingRight = other.x < clickedPet.x;
            if (other.state === 'NORMAL') {
              other.speechText = '♥ Friends!';
              other.speechTimer = 1.8;
              if (other.y >= other.groundY) other.vy = -80;
            }
          }
        }
      });
      return true;
    } else {
      // Tapped on empty habitat space: Drop a delicious snack for all pets to scamper toward!
      const randomTreat = TREAT_TYPES[Math.floor(Math.random() * TREAT_TYPES.length)];
      spawnHabitatDrop(randomTreat, false, false, clickX, clickY);
      spawnParticles(clickX, clickY, '#facc15', 10, 'sparkle');
      return true;
    }
  };

  // --- POINTER EVENT HANDLING (MOUSE & TOUCH) ---
  const getCanvasCoords = (e: {clientX: number; clientY: number}) => {
    const canvas = canvasRef.current;
    if (!canvas) return {x: 0, y: 0};
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return {x: 0, y: 0};
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    const {x, y} = getCanvasCoords(e);

    // 1. Top Island (Petting interaction)
    if (y < boardStartY - 20) {
      handlePetHabitat(x, y);
      dragStateRef.current = {
        active: true,
        startX: x,
        startY: y,
        startRow: -1,
        startCol: -1,
        swiped: true,
      };
      return;
    }

    // 2. Match-3 Grid Area
    if (isProcessingRef.current) return;

    const col = Math.floor((x - boardMarginX) / cellSize);
    const row = Math.floor((y - boardStartY) / cellSize);

    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      dragStateRef.current = {
        active: true,
        startX: x,
        startY: y,
        startRow: row,
        startCol: col,
        swiped: false,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.swiped || drag.startRow < 0) return;
    if (isProcessingRef.current || gameStateRef.current.status !== 'PLAYING')
      return;

    const {x, y} = getCanvasCoords(e);
    const dx = x - drag.startX;
    const dy = y - drag.startY;
    const swipeThreshold = 26;

    if (Math.hypot(dx, dy) >= swipeThreshold) {
      drag.swiped = true;
      const {startRow, startCol} = drag;
      let targetRow = startRow;
      let targetCol = startCol;

      if (Math.abs(dx) > Math.abs(dy)) {
        targetCol = dx > 0 ? startCol + 1 : startCol - 1;
      } else {
        targetRow = dy > 0 ? startRow + 1 : startRow - 1;
      }

      if (
        targetRow >= 0 &&
        targetRow < ROWS &&
        targetCol >= 0 &&
        targetCol < COLS
      ) {
        selectedCellRef.current = null;
        void handleSwap(startRow, startCol, targetRow, targetCol);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    if (drag.active && !drag.swiped && drag.startRow >= 0) {
      if (!isProcessingRef.current && gameStateRef.current.status === 'PLAYING') {
        const {startRow: row, startCol: col} = drag;
        const sel = selectedCellRef.current;

        if (!sel) {
          selectedCellRef.current = {r: row, c: col};
          gameAudio.playCrispClick();
          const {x, y} = getCellCenter(row, col);
          spawnParticles(x, y, '#facc15', 8, 'sparkle');
        } else if (sel.r === row && sel.c === col) {
          selectedCellRef.current = null;
          gameAudio.playCrispClick();
        } else {
          const dist = Math.abs(sel.r - row) + Math.abs(sel.c - col);
          if (dist === 1) {
            const fromR = sel.r;
            const fromC = sel.c;
            selectedCellRef.current = null;
            void handleSwap(fromR, fromC, row, col);
          } else {
            selectedCellRef.current = {r: row, c: col};
            gameAudio.playCrispClick();
            const {x, y} = getCellCenter(row, col);
            spawnParticles(x, y, '#facc15', 8, 'sparkle');
          }
        }
      }
    }

    dragStateRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      startRow: -1,
      startCol: -1,
      swiped: false,
    };
  };

  // --- PET SELECTION & PURCHASE LOGIC ---
  const handleSelectPet = (petId: string) => {
    if (!unlockedPetIds.includes(petId)) {
      gameAudio.playErrorBuzz();
      return;
    }
    gameAudio.playConfirmSelect();
    setSelectedPetId(petId);
    selectedPetIdRef.current = petId;
    const updated = saveGameProgress({ selectedPetId: petId });
    setSavedData(updated);

    const pet = PET_REGISTRY.find((p) => p.id === petId);
    if (pet) {
      addFloatingText(`${pet.name.toUpperCase()} ACTIVE COMPANION! 👑`, canvasWidth / 2, boardStartY - 30, pet.color);
      const entity = petEntitiesRef.current.find((e) => e.id === petId);
      if (entity) {
        entity.speechText = `I'm your active guide! ${pet.passiveShort} 👑✨`;
        entity.speechTimer = 3.0;
        entity.vy = -160;
        spawnParticles(entity.x, entity.y - 30, '#facc15', 16, 'star');
      }
    }
  };

  const handleUnlockPetWithCoins = (pet: Pet) => {
    const cost = pet.unlockCost || 0;
    if (coins < cost) {
      gameAudio.playErrorBuzz();
      addFloatingText(`Need ${cost} Coins! (Have ${coins}) 🪙`, canvasWidth / 2, boardStartY - 30, '#ef4444');
      return;
    }

    const nextCoins = coins - cost;
    const nextUnlocked = Array.from(new Set([...unlockedPetIds, pet.id]));
    setCoins(nextCoins);
    setUnlockedPetIds(nextUnlocked);
    setSelectedPetId(pet.id);
    selectedPetIdRef.current = pet.id;

    const updated = saveGameProgress({
      coins: nextCoins,
      unlockedPets: nextUnlocked,
      selectedPetId: pet.id,
    });
    setSavedData(updated);

    gameAudio.playLevelUpStinger();
    addFloatingText(`🐾 UNLOCKED ${pet.name.toUpperCase()}! 🎉`, canvasWidth / 2, boardStartY - 30, pet.color);
    for (let i = 0; i < 30; i++) spawnCelebrationParticle();
  };

  // --- HABITAT BUILDING UPGRADE PURCHASE HANDLER ---
  const handleUpgradeBuilding = (buildingKey: string) => {
    const building = INITIAL_HABITAT_BUILDINGS[buildingKey];
    if (!building) return;

    const currentLvl = habitatBuildings[buildingKey] || 1;
    if (currentLvl >= building.maxLevel) {
      gameAudio.playErrorBuzz();
      return;
    }

    const cost = getUpgradeCost(building, currentLvl);
    if (coins < cost) {
      gameAudio.playErrorBuzz();
      addFloatingText(`Need ${cost} Coins! (Have ${coins}) 🪙`, canvasWidth / 2, boardStartY - 30, '#ef4444');
      return;
    }

    const nextCoins = coins - cost;
    const nextLevels = {
      ...habitatBuildings,
      [buildingKey]: currentLvl + 1,
    };

    setCoins(nextCoins);
    setHabitatBuildings(nextLevels);
    habitatBuildingsRef.current = nextLevels;

    const updated = saveGameProgress({
      coins: nextCoins,
      habitatBuildingLevels: nextLevels,
    });
    setSavedData(updated);

    gameAudio.playLevelUpStinger();
    addFloatingText(`✨ UPGRADED ${building.name.toUpperCase()} TO LVL ${currentLvl + 1}!`, canvasWidth / 2, boardStartY - 40, building.accentColor);

    // Island celebration burst!
    for (let i = 0; i < 30; i++) spawnCelebrationParticle();

    // Pets celebrate upgrade!
    const pets = petEntitiesRef.current;
    pets.forEach((p) => {
      p.state = 'DANCING';
      p.stateTimer = 2.5;
      p.vy = -180;
      p.speechText = 'Yay! Island Upgrade! 🎉✨';
      p.speechTimer = 2.4;
    });
  };

  // --- START SPECIFIC LEVEL ---
  const startLevel = useCallback((targetLevelNum: number) => {
    const safeLvl = Math.max(1, targetLevelNum);
    const lvlCfg = getLevelConfig(safeLvl, savedData?.unlockedPets ?? unlockedPetIds);

    nextPieceIdRef.current = 1;
    nextDropIdRef.current = 1;
    nextTextIdRef.current = 1;
    nextMoteIdRef.current = 1;
    dropsRef.current = [];
    motesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    screenShakeRef.current = { timer: 0, intensity: 0 };
    selectedCellRef.current = null;
    dragStateRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      startRow: -1,
      startCol: -1,
      swiped: false,
    };
    isProcessingRef.current = false;
    idleHintTimerRef.current = 0;
    setIsVictoryModalDismissed(false);
    setIsSaveStreakModalOpen(false);

    // Synchronize All Unlocked Roaming Pets
    syncRoamingPetEntities(unlockedPetIds);

    // Bao the Panda passive bonus: +2 Extra Starting Moves
    const isBaoActive = selectedPetIdRef.current === 'bao';

    // Celestial Canopy Upgrade Bonus: +1 move at lvl 2-3, +2 moves at lvl 4, +3 moves at lvl 5
    const canopyLvl = habitatBuildingsRef.current?.celestial_canopy || 1;
    const canopyMoveBonus = canopyLvl >= 5 ? 3 : canopyLvl >= 4 ? 2 : canopyLvl >= 2 ? 1 : 0;

    const effectiveStartingMoves = lvlCfg.startingMoves + (isBaoActive ? 2 : 0) + canopyMoveBonus;

    initBoard(safeLvl);

    setGameState({
      status: 'PLAYING',
      score: 0,
      level: safeLvl,
      moves: effectiveStartingMoves,
    });
    setIsGameMenuOpen(false);
    setIsHowToPlayOpen(false);
    setIsPetCollectionOpen(false);
    setIsHabitatShopOpen(false);

    // Save current active level
    const updated = saveGameProgress({
      currentLevel: safeLvl,
    });
    setSavedData(updated);

    console.log('GAME_STARTED', `Level ${safeLvl}`);
    if (sdk) {
      sdk.startGame();
    }
  }, [sdk, canvasWidth, syncRoamingPetEntities, unlockedPetIds, savedData]);

  usePlaygroundGameLifecycle(gameState, sdk);

  // URL autoplay support
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      startLevel(1);
    }
  }, [startLevel]);

  // --- SAVE YOUR STREAK: SPEND 30 BALLOONS FOR +3 MOVES ---
  const handleSpendBalloonsForMoves = () => {
    if (balloons < 30) {
      gameAudio.playErrorBuzz();
      return;
    }

    const nextBalloons = balloons - 30;
    setBalloons(nextBalloons);
    saveGameProgress({ balloons: nextBalloons });

    gameAudio.playPowerupChime();
    setIsSaveStreakModalOpen(false);

    setGameState((prev) => ({
      ...prev,
      moves: (prev.moves || 0) + 3,
      status: 'PLAYING',
    }));

    addFloatingText('+3 MOVES! STREAK SAVED! 🎈', canvasWidth / 2, boardStartY + 50, '#facc15');
    spawnCelebrationParticle();
    spawnCelebrationParticle();
    spawnCelebrationParticle();
  };

  // --- FORFEIT LEVEL & STAR LOSS LOGIC ---
  const handleForfeitLevel = () => {
    setIsSaveStreakModalOpen(false);
    gameAudio.playDefeatMotif();

    const currentLevel = gameState.level;
    const currentStars = stars;
    const nextStars = Math.max(0, currentStars - 1);

    let demoted = false;
    let finalLevel = currentLevel;
    let finalStars = nextStars;

    if (nextStars <= 0) {
      if (currentLevel > 1) {
        demoted = true;
        finalLevel = currentLevel - 1;
        finalStars = 2; // Restore a buffer of 2 stars on lower level
      } else {
        finalLevel = 1;
        finalStars = 0;
      }
    }

    setStars(finalStars);
    const updated = saveGameProgress({
      stars: finalStars,
      currentLevel: finalLevel,
    });
    setSavedData(updated);

    setLastForfeitPenalty({
      starLost: 1,
      demoted,
      prevLevel: currentLevel,
      newLevel: finalLevel,
    });

    setGameState((prev) => ({
      ...prev,
      status: 'GAME_OVER',
      level: finalLevel,
    }));
  };

  // --- SIMULATION UPDATE LOOP ---
  const update = (dt: number) => {
    globalTimeRef.current += dt;

    if (screenShakeRef.current.timer > 0) {
      screenShakeRef.current.timer -= dt;
    }

    // Update drifting clouds across habitat sky
    cloudsRef.current.forEach((cloud) => {
      cloud.x += cloud.speed * dt;
      if (cloud.x > canvasWidth + 120) {
        cloud.x = -130;
        cloud.y = 30 + Math.random() * 75;
      }
    });

    // Ambient particles spawner for active level biome
    ambientTimerRef.current += dt;
    const biome = getBiomeForLevel(gameState.level);
    if (ambientTimerRef.current >= 0.18) {
      ambientTimerRef.current = 0;

      if (biome.id === 'sunny_meadow') {
        if (particlesRef.current.length < 50) {
          particlesRef.current.push({
            x: Math.random() * (canvasWidth - 60) + 30,
            y: Math.random() * 200 + 100,
            vx: (Math.random() - 0.5) * 15,
            vy: -Math.random() * 25 - 10,
            color: Math.random() < 0.6 ? '#fde047' : '#fef08a',
            size: Math.random() * 3 + 2,
            alpha: Math.random() * 0.5 + 0.3,
            life: 0,
            maxLife: Math.random() * 3.5 + 2.5,
            wobbleSpeed: Math.random() * 2 + 2,
            wobbleAmp: Math.random() * 12 + 6,
            shape: 'pollen',
          });
        }
      } else if (biome.id === 'bamboo_grove') {
        if (particlesRef.current.length < 45) {
          particlesRef.current.push({
            x: Math.random() * canvasWidth,
            y: 20 + Math.random() * 60,
            vx: Math.random() * 35 + 20,
            vy: Math.random() * 25 + 25,
            color: Math.random() < 0.5 ? '#34d399' : '#10b981',
            size: Math.random() * 5 + 6,
            alpha: Math.random() * 0.6 + 0.4,
            life: 0,
            maxLife: Math.random() * 4.0 + 3.0,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 2.5,
            wobbleSpeed: Math.random() * 3 + 2,
            wobbleAmp: 18,
            shape: 'bamboo_leaf',
          });
        }
      } else if (biome.id === 'dragonfly_lagoon') {
        if (Math.random() < 0.4 && particlesRef.current.length < 50) {
          particlesRef.current.push({
            x: Math.random() * (canvasWidth - 100) + 50,
            y: 310 + Math.random() * 30,
            vx: (Math.random() - 0.5) * 10,
            vy: -Math.random() * 35 - 20,
            color: Math.random() < 0.5 ? '#38bdf8' : '#67e8f9',
            size: Math.random() * 4 + 2.5,
            alpha: 0.8,
            life: 0,
            maxLife: Math.random() * 2.5 + 1.5,
            shape: 'bubble',
          });
        }
      } else if (biome.id === 'berry_blossom_field') {
        if (particlesRef.current.length < 50) {
          particlesRef.current.push({
            x: Math.random() * (canvasWidth + 100) - 50,
            y: 10 + Math.random() * 40,
            vx: Math.random() * 35 + 25,
            vy: Math.random() * 30 + 35,
            color: Math.random() < 0.5 ? '#fbcfe8' : '#f472b6',
            size: Math.random() * 5 + 6,
            alpha: Math.random() * 0.5 + 0.5,
            life: 0,
            maxLife: Math.random() * 4.5 + 3.0,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 3,
            wobbleSpeed: Math.random() * 3 + 2,
            wobbleAmp: 22,
            shape: 'sakura_petal',
          });
        }
      }
    }

    if (gameState.status !== 'PLAYING') {
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.rotation !== undefined && p.vRot) p.rotation += p.vRot * dt;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }
      return;
    }

    // Passive Food Bowl Treat & Coin Auto-Manifestation
    passiveDropTimerRef.current += dt;
    const foodBowlLvl = habitatBuildingsRef.current.food_bowl || 1;
    const passiveInterval = Math.max(7, 22 - foodBowlLvl * 3); // 19s at lvl 1 down to 7s at lvl 5
    if (passiveDropTimerRef.current >= passiveInterval) {
      passiveDropTimerRef.current = 0;
      const randomTreat = TREAT_TYPES[Math.floor(Math.random() * TREAT_TYPES.length)];
      spawnHabitatDrop(randomTreat, foodBowlLvl >= 3, false, 180, 260);
      
      if (foodBowlLvl >= 2) {
        const bonusCoin = Math.floor(foodBowlLvl * 3);
        setCoins((c) => {
          const next = c + bonusCoin;
          saveGameProgress({ coins: next });
          return next;
        });
        addFloatingText(`+${bonusCoin} 🪙 (Bowl)`, 180, 250, '#facc15');
      }
    }

    // 1. Update Board Pieces with Squash & Stretch bounce settling
    const board = boardRef.current;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r]?.[c];
        if (p) {
          const prevDiffY = Math.abs(p.targetY - p.drawY);
          p.drawX += (p.targetX - p.drawX) * Math.min(1, dt * 22);
          p.drawY += (p.targetY - p.drawY) * Math.min(1, dt * 22);
          const newDiffY = Math.abs(p.targetY - p.drawY);

          // Squash & stretch settling impact when landing
          if (p.isSettling && prevDiffY > 3 && newDiffY <= 3) {
            p.isSettling = false;
            p.scaleX = 1.20;
            p.scaleY = 0.82;
          }

          p.scaleX += (1 - p.scaleX) * Math.min(1, dt * 14);
          p.scaleY += (1 - p.scaleY) * Math.min(1, dt * 14);

          if (p.shakeTimer && p.shakeTimer > 0) {
            p.shakeTimer -= dt;
          }
          if (p.isClearing) {
            p.scale = Math.max(0, p.scale - dt * 4.5);
            p.alpha = Math.max(0, p.alpha - dt * 4.5);
          }
        }
      }
    }

    // 2. Idle Hint Timer
    if (!isProcessingRef.current) {
      idleHintTimerRef.current += dt;
    }

    // 3. Update Habitat Drops Physics & Multi-Pet Feeding
    const drops = dropsRef.current;
    const gravity = 520;
    const allPets = petEntitiesRef.current;

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.lifeTime += dt;
      if (d.state === 'falling') {
        d.vy += gravity * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rotation += d.vRot * dt;

        if (d.y >= d.groundY) {
          d.y = d.groundY;
          d.vy = -d.vy * 0.4;
          d.vx *= 0.6;
          d.vRot *= 0.5;
          d.bounces++;
          if (Math.abs(d.vy) < 40 || d.bounces >= 3) {
            d.state = 'on_ground';
            d.vy = 0;
            d.vx = 0;
          }
        }
      }

      // Nearby pets notice dropped treat and scamper excitedly toward it
      allPets.forEach((p) => {
        if (p.state === 'NORMAL' || p.state === 'PETTED') {
          const dist = Math.hypot(d.x - p.x, d.y - p.y);
          if (dist < 260) {
            p.targetX = d.x + (Math.random() - 0.5) * 20;
          }
        }
      });

      // Check if any roaming pet reaches and eats the treat
      let eatenByPet: RoamingPetEntity | null = null;
      for (const p of allPets) {
        const distToPet = Math.hypot(d.x - p.x, d.y - (p.y - 15));
        if (distToPet < 60 && d.state !== 'eaten') {
          eatenByPet = p;
          break;
        }
      }

      if (eatenByPet) {
        d.state = 'eaten';
        gameAudio.playPotionGulp();
        triggerPetReaction(d.type, eatenByPet.id);
        drops.splice(i, 1);
      } else if (d.lifeTime > 15) {
        drops.splice(i, 1);
      }
    }

    // 4. Update Flying Food & Star Motes (Bezier arc flight to pets)
    const motes = motesRef.current;
    const companionPet = allPets.find((p) => p.id === selectedPetIdRef.current) || allPets[0];

    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.progress += m.speed * dt;
      m.rotation += m.vRot * dt;

      const targetX = companionPet ? companionPet.x : canvasWidth / 2;
      const targetY = (companionPet ? companionPet.y : 285) - 30;

      const t = Math.min(1, m.progress);
      const invT = 1 - t;
      m.x = invT * invT * m.startX + 2 * invT * t * m.cpX + t * t * targetX;
      m.y = invT * invT * m.startY + 2 * invT * t * m.cpY + t * t * targetY;

      if (Math.random() < 0.35) {
        particlesRef.current.push({
          x: m.x,
          y: m.y,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          color: m.color,
          size: Math.random() * 4 + 2,
          alpha: 0.85,
          life: 0,
          maxLife: 0.3,
          shape: 'sparkle',
        });
      }

      if (m.progress >= 1) {
        spawnParticles(targetX, targetY, m.color, 8, 'heart');
        if (companionPet) companionPet.petSquishTimer = 0.25;
        motes.splice(i, 1);
      }
    }

    // 5. Update Multi-Pet Roaming Simulation (Every Unlocked Pet Roams Simultaneously)
    const baseWalkSpeed = (getConfig('bunnySpeed') as number);
    const islandLeft = 90;
    const islandRight = canvasWidth - 90;

    allPets.forEach((pet, petIdx) => {
      pet.bounceTimer += dt * 4;
      if (pet.stateTimer > 0) {
        pet.stateTimer -= dt;
        if (pet.stateTimer <= 0) pet.state = 'NORMAL';
      }
      if (pet.petSquishTimer > 0) pet.petSquishTimer -= dt;
      if (pet.speechTimer > 0) pet.speechTimer -= dt;
      if (pet.interactCooldown > 0) pet.interactCooldown -= dt;
      if (pet.actionTimer > 0) pet.actionTimer -= dt;
      if (pet.hopTimer > 0) pet.hopTimer -= dt;

      const effectiveSpeed = baseWalkSpeed * pet.walkSpeedMultiplier;

      // Unique Personality Behaviors
      if (pet.id === 'pip') {
        // Pip: Quick hops & ear wiggles
        if (pet.hopTimer <= 0 && pet.y >= pet.groundY && pet.state === 'NORMAL') {
          pet.vy = -110;
          pet.hopTimer = 1.0 + Math.random() * 1.6;
        }
      } else if (pet.id === 'bao') {
        // Bao: Gentle waddles, sitting down to snack or nap
        if (pet.actionTimer <= 0 && pet.state === 'NORMAL') {
          pet.actionTimer = 8.0 + Math.random() * 6.0;
          pet.state = 'NAPPING';
          pet.stateTimer = 3.2;
          pet.vx = 0;
          pet.speechText = 'Zzz... 🐼💤';
          pet.speechTimer = 2.8;
          spawnParticles(pet.x, pet.y - 45, '#a7f3d0', 6, 'bubble');
        }
      } else if (pet.id === 'gizmo') {
        // Gizmo: Rapid scurrying, gliding leaps, tail fluffs
        if (pet.actionTimer <= 0 && pet.state === 'NORMAL') {
          pet.actionTimer = 6.0 + Math.random() * 5.0;
          pet.vy = -160;
          pet.vx = pet.facingRight ? 190 : -190;
          pet.speechText = 'Chitter! 🐿️✨';
          pet.speechTimer = 2.0;
          pet.tailWiggle = Math.sin(pet.bounceTimer * 8) * 0.6;
          spawnParticles(pet.x, pet.y - 30, '#38bdf8', 6, 'sparkle');
        }
      } else if (pet.id === 'coco') {
        // Coco: Playful trots, joyful tail wags, bouncy barks
        if (pet.actionTimer <= 0 && pet.state === 'NORMAL') {
          pet.actionTimer = 5.5 + Math.random() * 4.5;
          pet.vy = -135;
          pet.speechText = 'Woof! 🐶💖';
          pet.speechTimer = 2.0;
          spawnParticles(pet.x, pet.y - 30, '#facc15', 6, 'paw');
        }
      } else if (pet.id === 'mimi') {
        // Mimi: Sleek trotting, curious sniffing, elegant pounces
        if (pet.actionTimer <= 0 && pet.state === 'NORMAL') {
          pet.actionTimer = 7.0 + Math.random() * 5.5;
          pet.state = 'POUNCING';
          pet.stateTimer = 1.8;
          pet.vy = -175;
          pet.vx = pet.facingRight ? 170 : -170;
          pet.speechText = 'Mystic Pounce! 🦊✨';
          pet.speechTimer = 2.0;
          spawnParticles(pet.x, pet.y - 30, '#f97316', 8, 'sparkle');
        }
      }

      // Pet-to-Pet Interactions (When 2 roaming pets meet on island)
      if (pet.state === 'NORMAL' && pet.interactCooldown <= 0) {
        for (let j = petIdx + 1; j < allPets.length; j++) {
          const other = allPets[j];
          if (other.state === 'NORMAL' && other.interactCooldown <= 0) {
            const dist = Math.hypot(pet.x - other.x, pet.y - other.y);
            if (dist < 65) {
              // Face each other
              pet.facingRight = pet.x < other.x;
              other.facingRight = other.x < pet.x;
              pet.vx = 0;
              other.vx = 0;
              // Synchronous cheerful bounce
              pet.vy = -120;
              other.vy = -120;
              const emotes = ['🐾 Friends!', '✨ Hi!', '❤️ Besties!', '🌸 Yay!', '🎶 La la!', '💖 Hugs!'];
              const chosen = emotes[Math.floor(Math.random() * emotes.length)];
              pet.speechText = chosen;
              pet.speechTimer = 2.2;
              other.speechText = chosen;
              other.speechTimer = 2.2;
              pet.interactCooldown = 6.0 + Math.random() * 4.0;
              other.interactCooldown = 6.0 + Math.random() * 4.0;
              spawnParticles((pet.x + other.x) / 2, pet.y - 35, '#f472b6', 6, 'heart');
              break;
            }
          }
        }
      }

      // State machine handling
      switch (pet.state) {
        case 'NORMAL':
        case 'PETTED': {
          let targetDrop: HabitatDrop | null = null;
          let minDist = Infinity;
          for (const drop of drops) {
            const dist = Math.hypot(drop.x - pet.x, drop.y - pet.y);
            if (dist < minDist) {
              minDist = dist;
              targetDrop = drop;
            }
          }

          if (targetDrop && minDist < 280) {
            pet.targetX = targetDrop.x;
            const dx = pet.targetX - pet.x;
            if (Math.abs(dx) > 10) {
              pet.vx = Math.sign(dx) * effectiveSpeed;
              pet.facingRight = dx > 0;
              if (pet.y >= pet.groundY && Math.random() < 0.08) {
                pet.vy = -80;
              }
            } else {
              pet.vx = 0;
            }
          } else {
            pet.idleTimer += dt;
            if (pet.idleTimer > 2.5 + petIdx * 0.5) {
              pet.idleTimer = 0;
              pet.targetX = Math.random() * (islandRight - islandLeft) + islandLeft;
            }
            const dx = pet.targetX - pet.x;
            if (Math.abs(dx) > 15) {
              pet.vx = Math.sign(dx) * (effectiveSpeed * 0.6);
              pet.facingRight = dx > 0;
              if (pet.y >= pet.groundY && Math.random() < 0.04) {
                pet.vy = -70;
              }
            } else {
              pet.vx = 0;
            }
          }

          pet.vy += 450 * dt;
          pet.x += pet.vx * dt;
          pet.y += pet.vy * dt;
          if (pet.y >= pet.groundY) {
            pet.y = pet.groundY;
            pet.vy = 0;
          }
          pet.x = Math.max(islandLeft, Math.min(islandRight, pet.x));
          pet.tailWiggle = Math.sin(pet.bounceTimer * 3) * 0.25;
          break;
        }

        case 'NAPPING': {
          pet.vx = 0;
          pet.vy += 450 * dt;
          pet.x += pet.vx * dt;
          pet.y += pet.vy * dt;
          if (pet.y >= pet.groundY) {
            pet.y = pet.groundY;
            pet.vy = 0;
          }
          if (Math.random() < 0.05) {
            spawnParticles(pet.x + (Math.random() - 0.5) * 20, pet.y - 45, '#a7f3d0', 1, 'bubble');
          }
          break;
        }

        case 'POUNCING': {
          pet.vy += 420 * dt;
          pet.x += pet.vx * dt;
          pet.y += pet.vy * dt;
          if (pet.y >= pet.groundY) {
            pet.y = pet.groundY;
            pet.vy = 0;
            pet.vx = 0;
            pet.state = 'NORMAL';
          }
          pet.x = Math.max(islandLeft, Math.min(islandRight, pet.x));
          break;
        }

        case 'DANCING': {
          pet.vx = 0;
          pet.vy += 450 * dt;
          pet.x += pet.vx * dt;
          pet.y += pet.vy * dt;
          if (pet.y >= pet.groundY) {
            pet.y = pet.groundY;
            pet.vy = -180;
            spawnParticles(pet.x + (Math.random() - 0.5) * 30, pet.y - 20, '#fb7185', 2, 'heart');
          }
          pet.wiggleAngle = Math.sin(pet.bounceTimer * 3) * 0.25;
          pet.tailWiggle = Math.sin(pet.bounceTimer * 6) * 0.5;
          break;
        }

        case 'SPICY': {
          const turboSpeed = effectiveSpeed * 2.5;
          pet.spicyTrailTimer += dt;
          if (pet.spicyTrailTimer > 0.04) {
            pet.spicyTrailTimer = 0;
            spawnParticles(pet.x, pet.y - 20, '#f97316', 3, 'fire');
          }
          pet.vy += 350 * dt;
          pet.x += pet.vx * dt;
          pet.y += pet.vy * dt;
          if (pet.y >= pet.groundY) {
            pet.y = pet.groundY;
            pet.vy = -120;
          }
          if (pet.x <= islandLeft) {
            pet.x = islandLeft;
            pet.vx = turboSpeed;
            pet.facingRight = true;
            spawnParticles(pet.x, pet.y - 20, '#ef4444', 8, 'fire');
          } else if (pet.x >= islandRight) {
            pet.x = islandRight;
            pet.vx = -turboSpeed;
            pet.facingRight = false;
            spawnParticles(pet.x, pet.y - 20, '#ef4444', 8, 'fire');
          }
          break;
        }

        case 'FROZEN': {
          pet.vx = 0;
          pet.vy = 0;
          pet.wiggleAngle = Math.sin(Date.now() * 0.05) * 0.08;
          pet.frostSparkleTimer += dt;
          if (pet.frostSparkleTimer > 0.12) {
            pet.frostSparkleTimer = 0;
            spawnParticles(pet.x + (Math.random() - 0.5) * 50, pet.y - Math.random() * 60, '#e0f2fe', 2, 'frost');
          }
          break;
        }

        case 'GLIDING':
        case 'FLOATING': {
          if (pet.stateTimer > 2.0) {
            pet.vy = -80;
            pet.vx = Math.sin(pet.bounceTimer) * 45;
          } else {
            pet.vy = 65;
            pet.vx = Math.sin(pet.bounceTimer * 1.5) * 35;
          }
          pet.x += pet.vx * dt;
          pet.y += pet.vy * dt;
          if (pet.y >= pet.groundY) {
            pet.y = pet.groundY;
            pet.state = 'NORMAL';
          }
          pet.x = Math.max(islandLeft + 20, Math.min(islandRight - 20, pet.x));
          break;
        }
      }
    });

    // 6. Update Particles
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.wobbleSpeed && p.wobbleAmp) {
        p.x += Math.sin((globalTimeRef.current + i) * p.wobbleSpeed) * p.wobbleAmp * dt;
      }
      if (p.rotation !== undefined && p.vRot) {
        p.rotation += p.vRot * dt;
      }

      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
      }
    }

    // 7. Update Floating Texts
    const texts = floatingTextsRef.current;
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life += dt;
      t.y += t.vy * dt;
      t.alpha = Math.max(0, 1 - t.life / 1.5);
      if (t.life >= 1.5) {
        texts.splice(i, 1);
      }
    }
  };

  // --- PROCEDURAL TREAT VECTOR DRAWING HELPER ---
  const drawTreatIcon = (ctx: CanvasRenderingContext2D, type: TreatType, size: number) => {
    ctx.save();

    // Check if matching sprite image exists in loaded assets (for berry, pepper, ice, balloon)
    let assetKey: string | null = null;
    if (type === 'berry') assetKey = 'treat_berry';
    else if (type === 'pepper') assetKey = 'treat_pepper';
    else if (type === 'ice') assetKey = 'treat_ice';
    else if (type === 'balloon') assetKey = 'treat_balloon';

    const img = assetKey ? assets[assetKey] : null;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    // High-Definition Procedural Vector Artwork for All Treats
    const r = size * 0.42;

    switch (type) {
      case 'carrot': {
        // 🥕 Crunchy Carrot
        // Green top foliage
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(-4, -r * 0.9, r * 0.25, r * 0.45, -0.3, 0, Math.PI * 2);
        ctx.ellipse(4, -r * 0.9, r * 0.25, r * 0.45, 0.3, 0, Math.PI * 2);
        ctx.ellipse(0, -r * 1.05, r * 0.2, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Carrot body
        const grad = ctx.createLinearGradient(-r * 0.6, -r * 0.4, r * 0.6, r * 0.8);
        grad.addColorStop(0, '#fb923c');
        grad.addColorStop(0.4, '#f97316');
        grad.addColorStop(1, '#ea580c');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, -r * 0.45);
        ctx.quadraticCurveTo(0, -r * 0.6, r * 0.65, -r * 0.45);
        ctx.quadraticCurveTo(r * 0.45, r * 0.3, 0, r * 0.95);
        ctx.quadraticCurveTo(-r * 0.45, r * 0.3, -r * 0.65, -r * 0.45);
        ctx.closePath();
        ctx.fill();

        // Rib lines
        ctx.strokeStyle = 'rgba(194, 65, 12, 0.6)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.15);
        ctx.lineTo(r * 0.1, -r * 0.15);
        ctx.moveTo(-r * 0.2, r * 0.2);
        ctx.lineTo(r * 0.35, r * 0.2);
        ctx.moveTo(-r * 0.15, r * 0.55);
        ctx.lineTo(r * 0.2, r * 0.55);
        ctx.stroke();

        // Specular shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.25, -r * 0.25, r * 0.14, r * 0.32, -0.25, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'bamboo': {
        // 🎋 Jade Bamboo Shoot
        // Main stalk
        const grad = ctx.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
        grad.addColorStop(0, '#34d399');
        grad.addColorStop(0.4, '#10b981');
        grad.addColorStop(1, '#059669');
        ctx.fillStyle = grad;

        // Two stalk segments
        ctx.beginPath();
        ctx.roundRect(-r * 0.4, -r * 0.85, r * 0.8, r * 0.75, 4);
        ctx.roundRect(-r * 0.44, 0, r * 0.88, r * 0.85, 4);
        ctx.fill();

        // Node rings
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.roundRect(-r * 0.52, -r * 0.12, r * 1.04, r * 0.22, 3);
        ctx.roundRect(-r * 0.54, r * 0.75, r * 1.08, r * 0.2, 3);
        ctx.fill();

        // Side Leaves
        ctx.fillStyle = '#6ee7b7';
        ctx.beginPath();
        ctx.ellipse(-r * 0.55, -r * 0.4, r * 0.25, r * 0.5, -0.7, 0, Math.PI * 2);
        ctx.ellipse(r * 0.55, -r * 0.3, r * 0.25, r * 0.5, 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(-r * 0.15, -r * 0.75, r * 0.16, r * 0.55);
        ctx.fillRect(-r * 0.15, r * 0.1, r * 0.16, r * 0.6);
        break;
      }

      case 'acorn': {
        // 🌰 Golden Acorn
        // Cap
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(0, -r * 0.3, r * 0.7, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        // Stem
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.7);
        ctx.quadraticCurveTo(r * 0.15, -r * 1.0, r * 0.25, -r * 1.05);
        ctx.stroke();

        // Nut body
        const nutGrad = ctx.createRadialGradient(-r * 0.2, 0, r * 0.1, 0, r * 0.2, r * 0.8);
        nutGrad.addColorStop(0, '#fde047');
        nutGrad.addColorStop(0.35, '#d97706');
        nutGrad.addColorStop(1, '#92400e');
        ctx.fillStyle = nutGrad;
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, -r * 0.3);
        ctx.quadraticCurveTo(-r * 0.7, r * 0.4, 0, r * 0.95);
        ctx.quadraticCurveTo(r * 0.7, r * 0.4, r * 0.65, -r * 0.3);
        ctx.closePath();
        ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.25, r * 0.1, r * 0.15, r * 0.3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'bone_biscuit': {
        // 🦴 Royal Biscuit / Bone
        const bGrad = ctx.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.6, r * 0.6);
        bGrad.addColorStop(0, '#fef08a');
        bGrad.addColorStop(0.5, '#facc15');
        bGrad.addColorStop(1, '#d97706');
        ctx.fillStyle = bGrad;

        // Bone ends
        ctx.beginPath();
        ctx.arc(-r * 0.45, -r * 0.35, r * 0.32, 0, Math.PI * 2);
        ctx.arc(-r * 0.45, r * 0.35, r * 0.32, 0, Math.PI * 2);
        ctx.arc(r * 0.45, -r * 0.35, r * 0.32, 0, Math.PI * 2);
        ctx.arc(r * 0.45, r * 0.35, r * 0.32, 0, Math.PI * 2);
        ctx.roundRect(-r * 0.45, -r * 0.28, r * 0.9, r * 0.56, 4);
        ctx.fill();

        // Heart stamped in center
        ctx.fillStyle = '#b45309';
        ctx.font = `bold ${Math.round(r * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', 0, 1);
        break;
      }

      case 'star_berry': {
        // ⭐ Mystic Starfruit
        const starGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.9);
        starGrad.addColorStop(0, '#fef08a');
        starGrad.addColorStop(0.45, '#c084fc');
        starGrad.addColorStop(1, '#7e22ce');
        ctx.fillStyle = starGrad;

        // 5-point star
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const outerAngle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const innerAngle = outerAngle + Math.PI / 5;
          const ox = Math.cos(outerAngle) * r * 0.9;
          const oy = Math.sin(outerAngle) * r * 0.9;
          const ix = Math.cos(innerAngle) * r * 0.45;
          const iy = Math.sin(innerAngle) * r * 0.45;
          if (i === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();

        // Center sparkle gem
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'honey_pot': {
        // 🍯 Sweet Honey Pot
        // Pot body
        const pGrad = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
        pGrad.addColorStop(0, '#f97316');
        pGrad.addColorStop(0.4, '#ea580c');
        pGrad.addColorStop(1, '#c2410c');
        ctx.fillStyle = pGrad;

        ctx.beginPath();
        ctx.ellipse(0, r * 0.15, r * 0.65, r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // Jar Rim
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath();
        ctx.roundRect(-r * 0.48, -r * 0.65, r * 0.96, r * 0.28, 4);
        ctx.fill();

        // Dripping Golden Honey
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.42, r * 0.4, r * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(-r * 0.12, -r * 0.1, r * 0.18, 0, Math.PI * 2);
        ctx.arc(r * 0.18, 0, r * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, r * 0.1, r * 0.12, r * 0.3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'pepper': {
        // 🌶️ Spicy Chili
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, -r * 0.5);
        ctx.quadraticCurveTo(r * 0.6, -r * 0.2, r * 0.4, r * 0.7);
        ctx.quadraticCurveTo(-r * 0.1, r * 0.9, -r * 0.4, -r * 0.2);
        ctx.closePath();
        ctx.fill();

        // Green stem
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.roundRect(-r * 0.35, -r * 0.8, r * 0.3, r * 0.35, 3);
        ctx.fill();
        break;
      }

      case 'ice': {
        // 🍧 Frost Popsicle
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(-r * 0.45, -r * 0.75, r * 0.9, r * 1.1, [12, 12, 4, 4]);
        ctx.fill();
        // Stick
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-r * 0.12, r * 0.35, r * 0.24, r * 0.45);
        break;
      }

      case 'balloon': {
        // 🎈 Festive Balloon
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.15, r * 0.65, r * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        // Specular
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.25, -r * 0.4, r * 0.14, r * 0.25, -0.4, 0, Math.PI * 2);
        ctx.fill();
        // Knot
        ctx.fillStyle = '#db2777';
        ctx.beginPath();
        ctx.moveTo(-r * 0.12, r * 0.6);
        ctx.lineTo(r * 0.12, r * 0.6);
        ctx.lineTo(0, r * 0.75);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'berry':
      default: {
        // 🍓 Sweet Berry
        const berryGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 2, 0, 0, r * 0.8);
        berryGrad.addColorStop(0, '#fda4af');
        berryGrad.addColorStop(0.4, '#f43f5e');
        berryGrad.addColorStop(1, '#be123c');
        ctx.fillStyle = berryGrad;

        ctx.beginPath();
        ctx.moveTo(0, -r * 0.55);
        ctx.quadraticCurveTo(r * 0.75, -r * 0.4, r * 0.5, r * 0.4);
        ctx.quadraticCurveTo(0, r * 0.95, -r * 0.5, r * 0.4);
        ctx.quadraticCurveTo(-r * 0.75, -r * 0.4, 0, -r * 0.55);
        ctx.closePath();
        ctx.fill();

        // Seeds
        ctx.fillStyle = '#fef08a';
        [
          [-r * 0.25, -r * 0.1],
          [r * 0.25, -r * 0.1],
          [0, r * 0.15],
          [-r * 0.2, r * 0.35],
          [r * 0.2, r * 0.35],
        ].forEach(([sx, sy]) => {
          ctx.beginPath();
          ctx.ellipse(sx, sy, 2, 3, 0.2, 0, Math.PI * 2);
          ctx.fill();
        });

        // Green leaves
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, -r * 0.6, r * 0.22, r * 0.14, -0.4, 0, Math.PI * 2);
        ctx.ellipse(r * 0.3, -r * 0.6, r * 0.22, r * 0.14, 0.4, 0, Math.PI * 2);
        ctx.ellipse(0, -r * 0.65, r * 0.2, r * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  };

  // --- PROCEDURAL DYNAMIC OBSTACLE DRAWING HELPER ---
  const drawObstacleOverlay = (
    ctx: CanvasRenderingContext2D,
    obstacle: ObstacleMeta,
    renderSize: number,
    time: number,
  ) => {
    ctx.save();
    const half = renderSize * 0.52;
    const full = renderSize * 1.04;

    if (obstacle.type === 'ice') {
      // ❄️ ICE OBSTACLE (1-layer frost vs 2-layer deep glacial ice)
      if (obstacle.layer > 1) {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.75)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(-half, -half, full, full, 14);
        ctx.fill();
        ctx.stroke();

        // Glacial Cracks
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-half + 10, -half + 12);
        ctx.lineTo(-4, -6);
        ctx.lineTo(8, 14);
        ctx.lineTo(half - 12, half - 10);
        ctx.stroke();

        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❄️x2', 0, half - 8);
      } else {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-half, -half, full, full, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❄️', 0, half - 8);
      }
    } else if (obstacle.type === 'honey') {
      // 🍯 HONEY OBSTACLE (1-layer sweet glaze vs 2-layer thick honeycomb)
      if (obstacle.layer > 1) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.78)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(-half, -half, full, full, 14);
        ctx.fill();
        ctx.stroke();

        // Honeycomb hex grid lines
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-half + 8, 0);
        ctx.lineTo(half - 8, 0);
        ctx.moveTo(0, -half + 8);
        ctx.lineTo(0, half - 8);
        ctx.stroke();

        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🍯x2', 0, half - 8);
      } else {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.48)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-half, -half, full, full, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🍯', 0, half - 8);
      }
    } else if (obstacle.type === 'crate') {
      // 📦 WOODEN CRATE OBSTACLE (1-layer wood box vs 2-layer reinforced crate)
      if (obstacle.layer > 1) {
        ctx.fillStyle = 'rgba(146, 64, 14, 0.88)';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(-half, -half, full, full, 12);
        ctx.fill();
        ctx.stroke();

        // Metal reinforcing bands
        ctx.fillStyle = '#475569';
        ctx.fillRect(-half, -6, full, 12);
        ctx.fillRect(-6, -half, 12, full);

        // Rivets
        ctx.fillStyle = '#cbd5e1';
        [[-half + 8, -half + 8], [half - 8, -half + 8], [-half + 8, half - 8], [half - 8, half - 8]].forEach(([rx, ry]) => {
          ctx.beginPath();
          ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('📦x2', 0, half - 8);
      } else {
        ctx.fillStyle = 'rgba(180, 83, 9, 0.72)';
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-half, -half, full, full, 10);
        ctx.fill();
        ctx.stroke();

        // Diagonal wooden brace
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-half + 6, -half + 6);
        ctx.lineTo(half - 6, half - 6);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('📦', 0, half - 8);
      }
    }

    ctx.restore();
  };
  const drawRoamingPet = (
    ctx: CanvasRenderingContext2D,
    pet: RoamingPetEntity,
    isActiveCompanion: boolean,
  ) => {
    ctx.save();
    ctx.translate(pet.x, pet.y);

    if (!pet.facingRight) {
      ctx.scale(-1, 1);
    }

    let sx = 1;
    let sy = 1;
    if (pet.petSquishTimer > 0) {
      sx = 1.25;
      sy = 0.8;
    } else if (pet.state === 'DANCING') {
      sx = 1 + Math.sin(pet.bounceTimer * 2) * 0.15;
      sy = 1 - Math.sin(pet.bounceTimer * 2) * 0.15;
      ctx.rotate(pet.wiggleAngle);
    } else if (pet.state === 'FROZEN') {
      ctx.rotate(pet.wiggleAngle);
    } else if (pet.state === 'NAPPING') {
      sx = 1.1;
      sy = 0.85;
    } else if (pet.state === 'POUNCING') {
      sx = 1.15;
      sy = 0.9;
    }

    ctx.scale(sx, sy);

    // Active Companion Radiant Golden Halo / Aura disc on ground
    if (isActiveCompanion) {
      ctx.save();
      const glowPulse = 0.4 + Math.sin(globalTimeRef.current * 4) * 0.18;
      const auraGrad = ctx.createRadialGradient(0, 4, 10, 0, 4, 52 * sx);
      auraGrad.addColorStop(0, `rgba(250, 204, 21, ${glowPulse})`);
      auraGrad.addColorStop(0.7, `rgba(234, 179, 8, ${glowPulse * 0.5})`);
      auraGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.ellipse(0, 4, 52 * sx, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ground Shadow
    if (pet.state !== 'FLOATING' && pet.state !== 'GLIDING') {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 38 * sx, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Balloon when floating or gliding
    if (pet.state === 'FLOATING' || pet.state === 'GLIDING') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, -45);
      ctx.quadraticCurveTo(20, -70, 15, -100);
      ctx.stroke();

      ctx.fillStyle = pet.id === 'gizmo' ? '#38bdf8' : '#ec4899';
      ctx.beginPath();
      ctx.ellipse(15, -115, 22, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(9, -125, 6, 9, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ice cube wrapper if frozen
    if (pet.state === 'FROZEN') {
      ctx.save();
      ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-48, -90, 96, 92, 16);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const isPip = pet.id === 'pip' || pet.id === 'bunny';
    const isBao = pet.id === 'bao' || pet.id === 'panda';
    const isGizmo = pet.id === 'gizmo' || pet.id === 'squirrel';
    const isCoco = pet.id === 'coco' || pet.id === 'corgi';
    const isMimi = pet.id === 'mimi' || pet.id === 'fox';

    // RENDER SPECIES-SPECIFIC BODY & FEATURES
    if (isPip) {
      // 1. PIP THE BUNNY
      const bunnyImg = assets[
        pet.state === 'SPICY'
          ? 'pet_bunny_spicy'
          : pet.state === 'FROZEN'
          ? 'pet_bunny_frozen'
          : pet.state === 'FLOATING'
          ? 'pet_bunny_floating'
          : 'pet_bunny'
      ];
      const bw = 96;
      const bh = 96;
      if (bunnyImg && bunnyImg.complete && bunnyImg.naturalWidth > 0) {
        ctx.drawImage(bunnyImg, -bw / 2, -bh + 10, bw, bh);
      } else {
        // High-Quality Vector Procedural Pip Bunny
        // Feet
        ctx.fillStyle = '#fce7f3';
        ctx.beginPath();
        ctx.ellipse(-18, -4, 14, 8, -0.1, 0, Math.PI * 2);
        ctx.ellipse(18, -4, 14, 8, 0.1, 0, Math.PI * 2);
        ctx.fill();
        // Tail
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-26, -22, 10, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath();
        ctx.ellipse(0, -28, 32, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        // Belly
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, -24, 20, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        const earWiggle = Math.sin(pet.bounceTimer * 4) * 0.08;
        ctx.save();
        ctx.rotate(-0.15 + earWiggle);
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath();
        ctx.ellipse(-16, -72, 10, 24, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.ellipse(-16, -72, 5, 18, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.rotate(0.15 - earWiggle);
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath();
        ctx.ellipse(16, -72, 10, 24, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.ellipse(16, -72, 5, 18, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Head
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath();
        ctx.ellipse(0, -48, 30, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        // Cheeks
        ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
        ctx.beginPath();
        ctx.ellipse(-18, -42, 6, 4, 0, 0, Math.PI * 2);
        ctx.ellipse(18, -42, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-11, -48, 4, 0, Math.PI * 2);
        ctx.arc(11, -48, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-12, -49, 1.5, 0, Math.PI * 2);
        ctx.arc(10, -49, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Nose & Mouth
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.ellipse(0, -42, 3, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isBao) {
      // 2. BAO THE PANDA (Black & White Giant Panda)
      // Feet
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.ellipse(-22, -4, 14, 10, -0.1, 0, Math.PI * 2);
      ctx.ellipse(22, -4, 14, 10, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Chubby Body
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, -32, 36, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      // Black Arms / Shoulders
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.ellipse(-30, -32, 12, 20, 0.3, 0, Math.PI * 2);
      ctx.ellipse(30, -32, 12, 20, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // White belly
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(0, -28, 22, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.arc(-26, -72, 13, 0, Math.PI * 2);
      ctx.arc(26, -72, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(-26, -72, 6, 0, Math.PI * 2);
      ctx.arc(26, -72, 6, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, -56, 35, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eye Patches
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.ellipse(-16, -56, 12, 10, -0.25, 0, Math.PI * 2);
      ctx.ellipse(16, -56, 12, 10, 0.25, 0, Math.PI * 2);
      ctx.fill();
      // Eyes (Sleepy if napping)
      if (pet.state === 'NAPPING') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-15, -56, 4, 0.2, Math.PI - 0.2);
        ctx.arc(17, -56, 4, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-15, -57, 4.5, 0, Math.PI * 2);
        ctx.arc(17, -57, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-14, -57, 2.5, 0, Math.PI * 2);
        ctx.arc(18, -57, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Cheeks & Nose
      ctx.fillStyle = 'rgba(244, 114, 182, 0.6)';
      ctx.beginPath();
      ctx.ellipse(-24, -48, 7, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(24, -48, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.ellipse(0, -48, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (isGizmo) {
      // 3. GIZMO THE FLYING SQUIRREL (Chestnut & Cream, Fluffy Bushy Tail & Gliding Membranes)
      // Bushy Curled Tail
      ctx.save();
      ctx.rotate(pet.tailWiggle);
      ctx.fillStyle = '#9a3412';
      ctx.beginPath();
      ctx.ellipse(-28, -28, 20, 32, 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.ellipse(-32, -34, 9, 16, 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Gliding Wing Membranes (if gliding or hopping)
      if (pet.state === 'GLIDING' || pet.y < pet.groundY - 10) {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(-28, -32);
        ctx.quadraticCurveTo(-45, -16, -26, -4);
        ctx.lineTo(-20, -18);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(28, -32);
        ctx.quadraticCurveTo(45, -16, 26, -4);
        ctx.lineTo(20, -18);
        ctx.closePath();
        ctx.fill();
      }
      // Body
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.ellipse(0, -20, 26, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // Belly
      ctx.fillStyle = '#ffedd5';
      ctx.beginPath();
      ctx.ellipse(0, -18, 16, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Little Paws
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.ellipse(-12, -2, 6, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(12, -2, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(0, -38, 28, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pointed Squirrel Ears
      ctx.fillStyle = '#9a3412';
      ctx.beginPath();
      ctx.ellipse(-18, -56, 8, 13, -0.3, 0, Math.PI * 2);
      ctx.ellipse(18, -56, 8, 13, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.ellipse(-18, -56, 4, 8, -0.3, 0, Math.PI * 2);
      ctx.ellipse(18, -56, 4, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Aviator Goggles on forehead
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.roundRect(-24, -51, 48, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-11, -47, 7, 0, Math.PI * 2);
      ctx.arc(11, -47, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(-13, -49, 2.5, 0, Math.PI * 2);
      ctx.arc(9, -49, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Expressive Eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-10, -36, 4.5, 0, Math.PI * 2);
      ctx.arc(10, -36, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-11, -37, 1.8, 0, Math.PI * 2);
      ctx.arc(9, -37, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // Snout & Cheeks
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.ellipse(0, -31, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.ellipse(0, -32, 3, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (isCoco) {
      // 4. COCO THE CORGI (Golden Tan, Pointed Bat-Ears, White Blaze, Wagging Fluffy Butt)
      // Wagging Tail / Heart Butt
      ctx.save();
      ctx.rotate(pet.tailWiggle);
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(-26, -24, 12, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-26, -24, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Corgi Body
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(0, -22, 34, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // White Chest Ascot & Belly
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(10, -20, 20, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Little Stubby Corgi Paws
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-16, -2, 8, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(16, -2, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Upright Corgi Bat-Ears
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(-18, -64, 11, 22, -0.22, 0, Math.PI * 2);
      ctx.ellipse(18, -64, 11, 22, 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.ellipse(-18, -64, 6, 15, -0.22, 0, Math.PI * 2);
      ctx.ellipse(18, -64, 6, 15, 0.22, 0, Math.PI * 2);
      ctx.fill();
      // Corgi Head
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(0, -42, 28, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // White Muzzle Blaze
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -56);
      ctx.lineTo(-12, -34);
      ctx.lineTo(12, -34);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -36, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // Shiny Black Button Nose
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.ellipse(0, -38, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Sparkling Eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-14, -45, 4.5, 0, Math.PI * 2);
      ctx.arc(14, -45, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-15, -46, 1.8, 0, Math.PI * 2);
      ctx.arc(13, -46, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // Pink Tongue
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.ellipse(0, -28, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (isMimi) {
      // 5. MIMI THE MYSTIC FOX (Flame Orange, Huge White-Tipped Brush Tail, Mystic Gem)
      // Giant Fluffy Bushy Tail with Snow-White Tip
      ctx.save();
      ctx.rotate(pet.tailWiggle * 1.3);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(-28, -28, 19, 36, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-36, -46, 10, 16, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Sleek Fox Body
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(0, -22, 30, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      // Fluffy White Chest Ruff
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(8, -20, 18, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // Black Sock Paws
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.ellipse(-14, -2, 7, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(14, -2, 7, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tall Pointed Fennec/Fox Ears with Black Backs
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.moveTo(-24, -48);
      ctx.lineTo(-20, -74);
      ctx.lineTo(-6, -50);
      ctx.closePath();
      ctx.fill();
      ctx.moveTo(24, -48);
      ctx.lineTo(20, -74);
      ctx.lineTo(6, -50);
      ctx.closePath();
      ctx.fill();
      // Inner Ear White Fur
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-20, -50);
      ctx.lineTo(-18, -68);
      ctx.lineTo(-8, -52);
      ctx.closePath();
      ctx.fill();
      ctx.moveTo(20, -50);
      ctx.lineTo(18, -68);
      ctx.lineTo(8, -52);
      ctx.closePath();
      ctx.fill();
      // Fox Head
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(0, -42, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      // White Cheeks & Snout
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-14, -36, 10, 8, -0.2, 0, Math.PI * 2);
      ctx.ellipse(14, -36, 10, 8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.lineTo(-6, -40);
      ctx.lineTo(6, -40);
      ctx.closePath();
      ctx.fill();
      // Glowing Mystic Forehead Gem
      const gemPulse = Math.sin(globalTimeRef.current * 6) * 1.5;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(0, -52, 3.5 + gemPulse * 0.3, 5 + gemPulse * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -53, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Black Nose
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.ellipse(0, -32, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Slanted Golden Eyes
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(-11, -44, 4.5, 3.5, 0.2, 0, Math.PI * 2);
      ctx.ellipse(11, -44, 4.5, 3.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(-11, -44, 2.5, 3.5, 0, 0, Math.PI * 2);
      ctx.ellipse(11, -44, 2.5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ACTIVE COMPANION SHIMMERING GOLDEN CROWN & PERK BADGE
    if (isActiveCompanion) {
      ctx.save();
      const crownBounce = Math.sin(globalTimeRef.current * 5) * 3;
      ctx.translate(0, -82 + crownBounce);

      // Shimmering Golden Crown
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-12, -4);
      ctx.lineTo(-16, -16);
      ctx.lineTo(-6, -9);
      ctx.lineTo(0, -18);
      ctx.lineTo(6, -9);
      ctx.lineTo(16, -16);
      ctx.lineTo(12, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Crown Jewels
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, -8, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-8, -6, 1.5, 0, Math.PI * 2);
      ctx.arc(8, -6, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // "★ ACTIVE" Pill Tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-24, 0, 48, 13, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 8px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★ ACTIVE', 0, 7);
      ctx.restore();
    }

    // Mood status indicator
    if (pet.state === 'DANCING') {
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 20px Fredoka, sans-serif';
      ctx.fillText('🎵', -10, -95);
    } else if (pet.state === 'SPICY') {
      ctx.fillStyle = '#ea580c';
      ctx.font = 'bold 20px Fredoka, sans-serif';
      ctx.fillText('🔥', -10, -95);
    } else if (pet.state === 'FROZEN') {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px Fredoka, sans-serif';
      ctx.fillText('❄️', -10, -95);
    }

    // Speech Bubble
    if (pet.speechTimer > 0 && pet.speechText) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = isActiveCompanion ? '#facc15' : '#fb7185';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-75, -115, 150, 26, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pet.speechText, 0, -98);
      ctx.restore();
    }

    ctx.restore();
  };

  // --- DRAWING / RENDERING ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    prepareCanvas(ctx, canvasWidth, canvasHeight);

    const time = globalTimeRef.current;

    // Apply Screen Shake
    let shakeX = 0;
    let shakeY = 0;
    if (screenShakeRef.current.timer > 0) {
      const progress = screenShakeRef.current.timer / 0.28;
      const intensity = screenShakeRef.current.intensity * progress;
      shakeX = (Math.sin(time * 60) * 0.7 + (Math.random() - 0.5)) * intensity;
      shakeY = (Math.cos(time * 50) * 0.7 + (Math.random() - 0.5)) * intensity;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Overall Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Upper Island Habitat Viewport
    const currentBiome = getBiomeForLevel(gameState.level);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(14, 14, canvasWidth - 28, habitatHeight, 20);
    ctx.clip();

    // RENDER BIOME SCENERY
    if (currentBiome.id === 'sunny_meadow') {
      // Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 14, 0, habitatHeight);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.55, '#bae6fd');
      skyGrad.addColorStop(1, '#86efac');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(14, 14, canvasWidth - 28, habitatHeight);

      // Rotating Golden Sunbeams
      ctx.save();
      const sunX = canvasWidth * 0.2;
      const sunY = 50;
      const numRays = 10;
      const sunAngleOffset = time * 0.12;
      const sunPulse = 0.14 + Math.sin(time * 1.5) * 0.04;
      ctx.fillStyle = `rgba(254, 240, 138, ${sunPulse})`;

      for (let i = 0; i < numRays; i++) {
        const angle = sunAngleOffset + (i * Math.PI * 2) / numRays;
        const rayWidth = 0.14;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(
          sunX + Math.cos(angle - rayWidth) * 500,
          sunY + Math.sin(angle - rayWidth) * 500,
        );
        ctx.lineTo(
          sunX + Math.cos(angle + rayWidth) * 500,
          sunY + Math.sin(angle + rayWidth) * 500,
        );
        ctx.closePath();
        ctx.fill();
      }

      // Sun Orb
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Distant rolling hills
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(canvasWidth * 0.15, 230, 260, 90, 0, 0, Math.PI * 2);
      ctx.ellipse(canvasWidth * 0.85, 220, 290, 100, 0, 0, Math.PI * 2);
      ctx.fill();

      // Midground Island Mound
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.ellipse(canvasWidth / 2, 295, canvasWidth * 0.48, 85, 0, 0, Math.PI * 2);
      ctx.fill();

      // Foreground Grassy Plateau
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(canvasWidth / 2, 315, canvasWidth * 0.45, 65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Daisy Flowers & Grass
      const meadowFlowers = [
        { x: 70, y: 312, type: 'daisy' },
        { x: 130, y: 308, type: 'yellow' },
        { x: 220, y: 306, type: 'daisy' },
        { x: 380, y: 305, type: 'yellow' },
        { x: 490, y: 308, type: 'daisy' },
        { x: 580, y: 312, type: 'yellow' },
        { x: 640, y: 316, type: 'daisy' },
      ];

      meadowFlowers.forEach((fl, idx) => {
        const sway = Math.sin(time * 2.5 + idx * 1.2) * 5;
        const fx = fl.x + sway;
        const fy = fl.y - 14;

        ctx.save();
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(fl.x, fl.y);
        ctx.quadraticCurveTo(fl.x + sway * 0.4, fl.y - 8, fx, fy);
        ctx.stroke();

        if (fl.type === 'daisy') {
          ctx.fillStyle = '#ffffff';
          for (let p = 0; p < 6; p++) {
            const pa = (p * Math.PI * 2) / 6;
            ctx.beginPath();
            ctx.arc(fx + Math.cos(pa) * 5, fy + Math.sin(pa) * 5, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#facc15';
          for (let p = 0; p < 5; p++) {
            const pa = (p * Math.PI * 2) / 5;
            ctx.beginPath();
            ctx.arc(fx + Math.cos(pa) * 5, fy + Math.sin(pa) * 5, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#ea580c';
          ctx.beginPath();
          ctx.arc(fx, fy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

    } else if (currentBiome.id === 'bamboo_grove') {
      const skyGrad = ctx.createLinearGradient(0, 14, 0, habitatHeight);
      skyGrad.addColorStop(0, '#022c22');
      skyGrad.addColorStop(0.5, '#064e3b');
      skyGrad.addColorStop(1, '#059669');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(14, 14, canvasWidth - 28, habitatHeight);

      // Waterfall
      const wfX = canvasWidth * 0.72;
      const wfWidth = 42;
      ctx.fillStyle = 'rgba(110, 231, 183, 0.4)';
      ctx.fillRect(wfX - 6, 20, wfWidth + 12, 260);

      for (let w = 0; w < 4; w++) {
        const streamX = wfX + w * 11 + Math.sin(time * 4 + w) * 3;
        const curGrad = ctx.createLinearGradient(streamX, 20, streamX, 280);
        curGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        curGrad.addColorStop(0.5, 'rgba(167, 243, 208, 0.9)');
        curGrad.addColorStop(1, 'rgba(255, 255, 255, 0.7)');
        ctx.fillStyle = curGrad;
        ctx.fillRect(streamX, 20, 6, 250);
      }

      // Bamboo Stalks
      const distantStalks = [70, 110, 180, 240, 310, 480, 540, 610];
      distantStalks.forEach((sx) => {
        const stalkW = 12;
        ctx.fillStyle = '#047857';
        ctx.fillRect(sx, 14, stalkW, 280);
      });

      // Midground Island Hill
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.ellipse(canvasWidth / 2, 295, canvasWidth * 0.48, 85, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.ellipse(canvasWidth / 2, 315, canvasWidth * 0.45, 65, 0, 0, Math.PI * 2);
      ctx.fill();

    } else if (currentBiome.id === 'dragonfly_lagoon') {
      const skyGrad = ctx.createLinearGradient(0, 14, 0, habitatHeight);
      skyGrad.addColorStop(0, '#031d38');
      skyGrad.addColorStop(0.5, '#0e7490');
      skyGrad.addColorStop(1, '#06b6d4');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(14, 14, canvasWidth - 28, habitatHeight);

      // Moon
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(canvasWidth * 0.82, 55, 18, 0, Math.PI * 2);
      ctx.fill();

      // Water body
      ctx.fillStyle = '#0e7490';
      ctx.fillRect(14, 240, canvasWidth - 28, habitatHeight - 240);

      // Island Bank
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      ctx.ellipse(canvasWidth / 2, 305, canvasWidth * 0.46, 70, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#14b8a6';
      ctx.beginPath();
      ctx.ellipse(canvasWidth / 2, 320, canvasWidth * 0.43, 50, 0, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // Berry Blossom Field (Sunset & Cherry Blossom Canopy)
      const skyGrad = ctx.createLinearGradient(0, 14, 0, habitatHeight);
      skyGrad.addColorStop(0, '#4a044e');
      skyGrad.addColorStop(0.4, '#831843');
      skyGrad.addColorStop(0.75, '#be185d');
      skyGrad.addColorStop(1, '#f472b6');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(14, 14, canvasWidth - 28, habitatHeight);

      // Sunset Sun
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(canvasWidth * 0.25, 60, 28, 0, Math.PI * 2);
      ctx.fill();

      // Midground Blossom Hills
      ctx.fillStyle = '#9d174d';
      ctx.beginPath();
      ctx.ellipse(canvasWidth / 2, 295, canvasWidth * 0.48, 85, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#db2777';
      ctx.beginPath();
      ctx.ellipse(canvasWidth / 2, 315, canvasWidth * 0.45, 65, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Drifting Clouds
    if (currentBiome.id === 'sunny_meadow' || currentBiome.id === 'berry_blossom_field') {
      const clouds = cloudsRef.current;
      clouds.forEach((c) => {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(c.scale, c.scale);
        ctx.fillStyle = currentBiome.id === 'berry_blossom_field'
          ? `rgba(253, 230, 240, ${c.alpha * 0.8})`
          : `rgba(255, 255, 255, ${c.alpha})`;

        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.arc(20, -8, 26, 0, Math.PI * 2);
        ctx.arc(44, 2, 20, 0, Math.PI * 2);
        ctx.arc(22, 10, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    ctx.restore(); // End habitat clipping

    // RENDER HABITAT UPGRADE STRUCTURES (Food Bowl, Treehouse, Celestial Canopy)
    const foodBowlLvl = habitatBuildingsRef.current.food_bowl || 1;
    const treehouseLvl = habitatBuildingsRef.current.treehouse_log || 1;
    const canopyLvl = habitatBuildingsRef.current.celestial_canopy || 1;

    // 1. Celestial Canopy Sky Overlay (Levels 1 - 5)
    ctx.save();
    if (canopyLvl >= 1) {
      // Gentle Fireflies & Stardust
      const numStars = canopyLvl * 6;
      for (let s = 0; s < numStars; s++) {
        const starX = 30 + ((s * 47 + Math.sin(time * 1.5 + s) * 20) % (canvasWidth - 60));
        const starY = 25 + ((s * 29 + Math.cos(time * 1.8 + s) * 15) % 120);
        const starAlpha = 0.35 + Math.sin(time * 3 + s) * 0.35;
        ctx.fillStyle = canopyLvl >= 4 ? `rgba(216, 180, 254, ${starAlpha})` : `rgba(254, 240, 138, ${starAlpha})`;
        ctx.beginPath();
        ctx.arc(starX, starY, Math.max(1, (s % 3) + (canopyLvl >= 3 ? 2 : 1)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (canopyLvl >= 2) {
      // Crystal Fairy Lantern Arch / Ribbons across top sky
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, 60);
      ctx.quadraticCurveTo(canvasWidth / 2, 20, canvasWidth - 30, 60);
      ctx.stroke();

      // Hanging Starlight Crystals / Lanterns
      const lanternXs = [120, 240, 360, 480, 600];
      lanternXs.forEach((lx, idx) => {
        const ly = 35 + Math.sin((lx / canvasWidth) * Math.PI) * 15;
        const swing = Math.sin(time * 2 + idx) * 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + swing, ly + 22);
        ctx.stroke();

        // Crystal lantern glow
        const glowPulse = 0.5 + Math.sin(time * 4 + idx) * 0.3;
        const crystalGrad = ctx.createRadialGradient(lx + swing, ly + 26, 2, lx + swing, ly + 26, 16);
        crystalGrad.addColorStop(0, canopyLvl >= 4 ? `rgba(168, 85, 247, ${glowPulse})` : `rgba(250, 204, 21, ${glowPulse})`);
        crystalGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = crystalGrad;
        ctx.beginPath();
        ctx.arc(lx + swing, ly + 26, 16, 0, Math.PI * 2);
        ctx.fill();

        // Faceted Gem
        ctx.fillStyle = canopyLvl >= 4 ? '#e9d5ff' : '#fef08a';
        ctx.beginPath();
        ctx.moveTo(lx + swing, ly + 20);
        ctx.lineTo(lx + swing + 5, ly + 26);
        ctx.lineTo(lx + swing, ly + 32);
        ctx.lineTo(lx + swing - 5, ly + 26);
        ctx.closePath();
        ctx.fill();
      });
    }

    if (canopyLvl >= 4) {
      // Shimmering Aurora Borealis Waves
      const auroraGrad = ctx.createLinearGradient(0, 15, canvasWidth, 120);
      auroraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.18)');
      auroraGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
      auroraGrad.addColorStop(1, 'rgba(52, 211, 153, 0.18)');
      ctx.fillStyle = auroraGrad;
      ctx.beginPath();
      ctx.moveTo(14, 40);
      for (let ax = 14; ax <= canvasWidth - 14; ax += 20) {
        const ay = 45 + Math.sin(ax * 0.015 + time * 2) * 18 + Math.cos(ax * 0.02 + time * 1.5) * 10;
        ctx.lineTo(ax, ay);
      }
      ctx.lineTo(canvasWidth - 14, 15);
      ctx.lineTo(14, 15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 2. The Golden Food Bowl (x: 180, y: 308)
    ctx.save();
    const bowlX = 180;
    const bowlY = 308;
    ctx.translate(bowlX, bowlY);

    // Food Bowl Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 30 + foodBowlLvl * 3, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (foodBowlLvl === 1) {
      // Level 1: Simple carved wooden dish
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(0, -2, 20, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Berry treats inside
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-6, -4, 4, 0, Math.PI * 2);
      ctx.arc(4, -5, 4.5, 0, Math.PI * 2);
      ctx.arc(0, -2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (foodBowlLvl === 2) {
      // Level 2: Polished terracotta/ceramic dish with berries
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffedd5';
      ctx.beginPath();
      ctx.ellipse(0, -3, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // Strawberries & blueberries
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-8, -4, 5, 0, Math.PI * 2);
      ctx.arc(6, -5, 5, 0, Math.PI * 2);
      ctx.arc(0, -3, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-2, -6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (foodBowlLvl === 3) {
      // Level 3: Polished Marble & Gold Filigree Feeder
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(0, 2, 29, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(0, -3, 25, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      // Golden rim
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Berries & Star Candies
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-8, -5, 5.5, 0, Math.PI * 2);
      ctx.arc(7, -5, 5.5, 0, Math.PI * 2);
      ctx.arc(0, -3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('★', -3, -4);
    } else if (foodBowlLvl === 4) {
      // Level 4: Royal Silver & Gold Fountain Feeder
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.roundRect(-8, 2, 16, 10, 4);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.ellipse(0, -4, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glowing nectar aura
      const nectarPulse = Math.sin(time * 5) * 2;
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.ellipse(0, -4, 20 + nectarPulse, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Treat mounds
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('🍰', -7, -4);
    } else {
      // Level 5: Grand Emperor's Royal Golden Feast Fountain Bowl
      const glowPulse = 0.5 + Math.sin(time * 4) * 0.25;
      const bowlGrad = ctx.createRadialGradient(0, -10, 5, 0, -10, 45);
      bowlGrad.addColorStop(0, `rgba(250, 204, 21, ${glowPulse})`);
      bowlGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
      ctx.fillStyle = bowlGrad;
      ctx.beginPath();
      ctx.arc(0, -10, 45, 0, Math.PI * 2);
      ctx.fill();

      // Golden pedestal
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.roundRect(-12, 0, 24, 14, 6);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(0, -2, 35, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(0, -6, 30, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ruby jewel in front
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // Treats galore
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('👑', -8, -6);
    }

    // Small structure tag badge above bowl
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-24, -26, 48, 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 7px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🥣 BOWL L${foodBowlLvl}`, 0, -20);
    ctx.restore();

    // 3. The Cozy Treehouse & Play Log (x: 540, y: 280)
    ctx.save();
    const thX = 540;
    const thY = 280;
    ctx.translate(thX, thY);

    // Treehouse Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 38 + treehouseLvl * 4, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (treehouseLvl === 1) {
      // Level 1: Hollow Mossy Play Log
      ctx.fillStyle = '#5c3a21';
      ctx.beginPath();
      ctx.ellipse(0, 8, 34, 14, -0.05, 0, Math.PI * 2);
      ctx.fill();
      // Hollow hole
      ctx.fillStyle = '#1e130c';
      ctx.beginPath();
      ctx.ellipse(-14, 8, 9, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      // Moss patch
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(8, 2, 12, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (treehouseLvl === 2) {
      // Level 2: Play Log + Climbing Ladder & Rope
      ctx.fillStyle = '#5c3a21';
      ctx.beginPath();
      ctx.ellipse(0, 8, 36, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e130c';
      ctx.beginPath();
      ctx.ellipse(-16, 8, 9, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Wooden ladder rungs
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(12, 18);
      ctx.lineTo(24, -10);
      ctx.moveTo(18, 18);
      ctx.lineTo(30, -10);
      ctx.stroke();
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        ctx.moveTo(14 + r * 4, 14 - r * 8);
        ctx.lineTo(20 + r * 4, 14 - r * 8);
        ctx.stroke();
      }
    } else if (treehouseLvl === 3) {
      // Level 3: Multi-tier Lookout Deck with Pennant Flag
      // Support Trunk
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-10, -20, 20, 36);
      // Main Deck
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.roundRect(-30, -24, 60, 10, 4);
      ctx.fill();
      // Railings
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.strokeRect(-28, -34, 56, 10);
      // Red Pennant Flag
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(22, -34);
      ctx.lineTo(22, -54);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(22, -54);
      ctx.lineTo(34, -48);
      ctx.lineTo(22, -42);
      ctx.closePath();
      ctx.fill();
    } else if (treehouseLvl === 4) {
      // Level 4: Cozy Thatched Treehouse with Warm Lantern & Slide
      // Trunk & Foliage
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-12, -26, 24, 42);
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(0, -42, 28, 0, Math.PI * 2);
      ctx.fill();
      // Thatched House Box
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.roundRect(-22, -44, 44, 24, 4);
      ctx.fill();
      // Thatched Roof
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(-28, -44);
      ctx.lineTo(0, -66);
      ctx.lineTo(28, -44);
      ctx.closePath();
      ctx.fill();
      // Cozy Yellow Window
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-6, -38, 12, 12);
      // Warm Lantern
      const lanternSwing = Math.sin(time * 3) * 3;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(20 + lanternSwing, -28, 4, 0, Math.PI * 2);
      ctx.fill();
      // Curved Playground Slide
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-20, -20);
      ctx.quadraticCurveTo(-35, -5, -42, 14);
      ctx.stroke();
    } else {
      // Level 5: Grand Enchanted Fairy Treehouse Palace
      // Rainbow & Fairy Glow Aura
      const fairyGlow = 0.4 + Math.sin(time * 4) * 0.2;
      const thGrad = ctx.createRadialGradient(0, -35, 10, 0, -35, 55);
      thGrad.addColorStop(0, `rgba(52, 211, 153, ${fairyGlow})`);
      thGrad.addColorStop(1, 'rgba(52, 211, 153, 0)');
      ctx.fillStyle = thGrad;
      ctx.beginPath();
      ctx.arc(0, -35, 55, 0, Math.PI * 2);
      ctx.fill();

      // Ancient Redwood Tree Trunk
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-16, -30, 32, 46);
      // Lush Emerald Canopy
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(0, -48, 36, 0, Math.PI * 2);
      ctx.arc(-24, -40, 20, 0, Math.PI * 2);
      ctx.arc(24, -40, 20, 0, Math.PI * 2);
      ctx.fill();
      // Fairytale Palace Castle
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.roundRect(-26, -52, 52, 28, 6);
      ctx.fill();
      // Crystal Spire Roof
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(-32, -52);
      ctx.lineTo(0, -82);
      ctx.lineTo(32, -52);
      ctx.closePath();
      ctx.fill();
      // Star Jewel on Peak
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -82, 5, 0, Math.PI * 2);
      ctx.fill();
      // Spiral Rainbow Slide
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-22, -26);
      ctx.quadraticCurveTo(-42, -10, -46, 14);
      ctx.stroke();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-20, -26);
      ctx.quadraticCurveTo(-38, -10, -44, 14);
      ctx.stroke();
    }

    // Treehouse level tag badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-30, -74, 60, 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 7px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🏡 TREEHOUSE L${treehouseLvl}`, 0, -68);
    ctx.restore();

    // Habitat frame border with Biome Accent
    ctx.save();
    ctx.strokeStyle = currentBiome.accentColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(14, 14, canvasWidth - 28, habitatHeight, 20);
    ctx.stroke();

    // Biome & Level Badge on top of habitat
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(26, 24, 340, 36, 14);
    ctx.fill();
    ctx.strokeStyle = currentBiome.accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    const sigMeta = TREAT_METAS[currentBiome.signatureTreat];
    ctx.fillStyle = currentBiome.accentColor;
    ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`★ Lvl ${gameState.level} • ${currentBiome.badge} (Cycle ${currentBiome.cycle})`, 36, 40);

    ctx.fillStyle = '#fef08a';
    ctx.font = '10px Fredoka, sans-serif';
    ctx.fillText(`Regional Treat: ${sigMeta ? `${sigMeta.emoji} ${sigMeta.name}` : currentBiome.signatureTreatName}`, 36, 52);
    ctx.restore();

    // 3. Draw Dropped Treats in Island Habitat
    const drops = dropsRef.current;
    drops.forEach((d) => {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);

      const size = d.isSuper ? 54 : 40;

      if (d.isSpicyBomb) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.75, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.isSuper) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      drawTreatIcon(ctx, d.type, size);
      ctx.restore();
    });

    // 4. Draw All Unlocked Roaming Pets (Sorted by Y for proper depth layering)
    const roamingPets = [...petEntitiesRef.current].sort((a, b) => a.y - b.y);
    roamingPets.forEach((pet) => {
      drawRoamingPet(ctx, pet, pet.id === selectedPetIdRef.current);
    });

    // 5. Draw Flying Food/Star Motes Arcing to Pet
    const motes = motesRef.current;
    motes.forEach((m) => {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rotation);

      const auraGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, m.size * 1.2);
      auraGrad.addColorStop(0, m.color);
      auraGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, m.size * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, m.size * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(0, 0, m.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 6. Draw Middle Happiness & Moves Divider Bar with Active Pet Perks
    const barY = 398;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(20, barY - 20, canvasWidth - 40, 40, 20);
    ctx.fill();

    const isNearGoal = gameState.score >= targetHappiness * 0.8;
    ctx.strokeStyle = isNearGoal ? '#f43f5e' : '#4f46e5';
    ctx.lineWidth = isNearGoal ? 3 : 2;
    if (isNearGoal) {
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 8 + Math.sin(time * 6) * 4;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const maxBarW = canvasWidth - 180;
    const progress = Math.min(1, gameState.score / targetHappiness);
    const filledW = Math.max(16, maxBarW * progress);

    // Liquid container track background
    ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
    ctx.beginPath();
    ctx.roundRect(75, barY - 10, maxBarW, 20, 10);
    ctx.fill();

    // Clip to filled liquid width
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(75, barY - 10, filledW, 20, 10);
    ctx.clip();

    // Liquid Gradient
    const liquidGrad = ctx.createLinearGradient(75, barY - 10, 75, barY + 10);
    liquidGrad.addColorStop(0, '#fb7185');
    liquidGrad.addColorStop(0.5, '#f43f5e');
    liquidGrad.addColorStop(1, '#e11d48');
    ctx.fillStyle = liquidGrad;
    ctx.fillRect(75, barY - 10, filledW, 20);

    // Liquid Sine Wave Surface
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.moveTo(75, barY - 10);
    for (let wx = 75; wx <= 75 + filledW; wx += 4) {
      const waveY = barY - 8 + Math.sin((wx * 0.05) + time * 5) * 2;
      ctx.lineTo(wx, waveY);
    }
    ctx.lineTo(75 + filledW, barY + 10);
    ctx.lineTo(75, barY + 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Heart Icon
    const heartImg = assets['ui_happiness_heart'];
    if (heartImg && heartImg.complete && heartImg.naturalWidth > 0) {
      ctx.drawImage(heartImg, 28, barY - 17, 34, 34);
    } else {
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('♥', 35, barY + 5);
    }

    // Score Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${gameState.score} / ${targetHappiness} Happiness`,
      75 + maxBarW / 2,
      barY + 4,
    );

    // Moves Counter Text
    ctx.textAlign = 'right';
    const isLowMoves = (gameState.moves ?? 0) <= 3;
    ctx.fillStyle = isLowMoves ? '#f87171' : '#fef08a';
    ctx.font = `bold ${isLowMoves ? '16' : '15'}px Fredoka, system-ui, sans-serif`;
    ctx.fillText(`${gameState.moves} Moves`, canvasWidth - 32, barY + 5);
    ctx.restore();

    // 7. Draw Match-3 Grid Backdrop & Cells
    const board = boardRef.current;
    const gridW = COLS * cellSize;
    const gridH = ROWS * cellSize;

    ctx.save();
    ctx.fillStyle = 'rgba(30, 27, 75, 0.88)';
    ctx.beginPath();
    ctx.roundRect(
      boardMarginX - 10,
      boardStartY - 10,
      gridW + 20,
      gridH + 20,
      20,
    );
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.stroke();

    const sel = selectedCellRef.current;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const {x, y} = getCellCenter(r, c);
        const isSelected = sel && sel.r === r && sel.c === c;

        ctx.fillStyle = isSelected
          ? 'rgba(250, 204, 21, 0.28)'
          : 'rgba(15, 23, 42, 0.65)';
        ctx.beginPath();
        ctx.roundRect(
          x - cellSize * 0.46,
          y - cellSize * 0.46,
          cellSize * 0.92,
          cellSize * 0.92,
          14,
        );
        ctx.fill();

        if (isSelected) {
          const pulse = Math.sin(time * 8) * 2;
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 4 + pulse;
          ctx.beginPath();
          ctx.roundRect(
            x - cellSize * 0.47,
            y - cellSize * 0.47,
            cellSize * 0.94,
            cellSize * 0.94,
            16,
          );
          ctx.stroke();
        }

        if (
          idleHintTimerRef.current > 4.0 &&
          hintPairRef.current &&
          hintPairRef.current.some((h) => h.r === r && h.c === c)
        ) {
          const pulse = Math.sin(time * 7) * 3;
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
          ctx.lineWidth = 3 + pulse;
          ctx.beginPath();
          ctx.roundRect(
            x - cellSize * 0.46,
            y - cellSize * 0.46,
            cellSize * 0.92,
            cellSize * 0.92,
            14,
          );
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // 8. Draw Match-3 Pieces with Squash & Stretch
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r]?.[c];
        if (p) {
          ctx.save();
          const isSelected = sel && sel.r === r && sel.c === c;

          let pieceShakeX = 0;
          if (p.shakeTimer && p.shakeTimer > 0) {
            pieceShakeX = Math.sin(p.shakeTimer * 60) * 6;
          }

          ctx.translate(p.drawX + pieceShakeX, p.drawY);

          const selectedScale = isSelected
            ? 1.1 + Math.sin(time * 8) * 0.06
            : 1;

          ctx.scale(
            p.scale * (p.scaleX || 1) * selectedScale,
            p.scale * (p.scaleY || 1) * selectedScale,
          );
          ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

          const pieceRenderSize = cellSize * 0.76;

          // Draw procedural / sprite Treat Icon
          drawTreatIcon(ctx, p.type, pieceRenderSize);

          if (p.special === 'pepper_bomb') {
            const firePulse = Math.sin(time * 10) * 3;
            ctx.strokeStyle = '#ea580c';
            ctx.lineWidth = 3 + firePulse;
            ctx.beginPath();
            ctx.arc(0, 0, pieceRenderSize * 0.48, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', 18, -18);
          }

          // Draw Dynamic Obstacle Overlay (Ice, Honey, Crate)
          const obs = p.obstacle || (p.iceLayer && p.iceLayer > 0 ? { type: 'ice' as const, layer: p.iceLayer } : undefined);
          if (obs) {
            drawObstacleOverlay(ctx, obs, pieceRenderSize, time);
          }

          ctx.restore();
        }
      }
    }

    // 9. Draw Particles
    const particles = particlesRef.current;
    particles.forEach((pt) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.alpha));
      ctx.fillStyle = pt.color;

      if (pt.shape === 'heart') {
        ctx.font = `${Math.max(10, pt.size * 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', pt.x, pt.y);
      } else if (pt.shape === 'balloon') {
        ctx.font = `${Math.max(12, pt.size * 2.2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎈', pt.x, pt.y);
      } else if (pt.shape === 'coin') {
        ctx.font = `${Math.max(12, pt.size * 2.2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪙', pt.x, pt.y);
      } else if (pt.shape === 'paw') {
        ctx.font = `${Math.max(12, pt.size * 2.2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐾', pt.x, pt.y);
      } else if (pt.shape === 'frost') {
        ctx.font = `${Math.max(10, pt.size * 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❄', pt.x, pt.y);
      } else if (pt.shape === 'fire') {
        ctx.font = `${Math.max(10, pt.size * 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', pt.x, pt.y);
      } else if (pt.shape === 'star' || pt.shape === 'sparkle') {
        ctx.font = `${Math.max(10, pt.size * 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', pt.x, pt.y);
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(0, pt.size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 10. Draw Floating Texts
    const texts = floatingTextsRef.current;
    texts.forEach((t) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, t.alpha));
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.font = 'bold 18px Fredoka, Quicksand, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    });

    ctx.restore(); // End screen shake translation
  };

  // --- RAF LOOP ---
  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      stepperRef.current?.(time, (dt) => updateRef.current(dt));

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawRef.current(ctx);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isMusicPlaying = gameState.status !== 'GAME_OVER' && !musicMuted;

  const continueBtnRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'START' && !!savedData && (savedData.highestLevel > 1 || savedData.totalHappiness > 0),
  );
  const startBtnRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'START' && (!savedData || (savedData.highestLevel <= 1 && savedData.totalHappiness <= 0)),
  );
  const resumeBtnRef = useAutoFocus<HTMLButtonElement>(isGameMenuOpen);
  const nextLevelBtnRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'VICTORY' && !isVictoryModalDismissed,
  );
  const retryBtnRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'GAME_OVER',
  );
  const saveStreakBtnRef = useAutoFocus<HTMLButtonElement>(
    isSaveStreakModalOpen && balloons >= 30,
  );

  const currentMovesLeft = gameState.moves ?? 0;
  const starsEarned = calculateStarsEarned(currentMovesLeft);

  const hasSavedProgress =
    !!savedData &&
    (savedData.highestLevel > 1 || savedData.currentLevel > 1 || savedData.totalHappiness > 0);

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-between bg-slate-950 text-white font-sans select-none">
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
          <div className="text-2xl font-bold animate-pulse text-pink-400">
            Loading Yum Pets: Match &amp; Feed...
          </div>
        </div>
      )}

      <BackgroundMusic
        url={BACKGROUND_MUSIC_URL}
        isPlaying={isMusicPlaying}
        isMuted={musicMuted}
        volume={0.35}
      />

      {/* Floating Audio Feedback Toast / Notice */}
      {audioNotice && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/95 border border-indigo-500/60 shadow-xl text-xs md:text-sm font-black text-yellow-300 backdrop-blur-md">
          <span>{audioNotice}</span>
        </div>
      )}

      {/* Top Header HUD with Coins, Stars, Balloons, Pet Selector & Controls */}
      <header className="w-full flex justify-between items-center px-2 md:px-4 py-2 bg-slate-900/95 border-b border-indigo-900/60 z-20 shrink-0 gap-1">
        <div className="flex items-center gap-1 md:gap-2">
          {/* Prominent Level Indicator with Biome Badge */}
          <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 text-slate-950 font-black rounded-xl text-xs md:text-sm shadow-md border border-yellow-300 shrink-0">
            <Trophy size={13} className="fill-slate-950" />
            <span>Lvl {gameState.level}</span>
          </div>

          {/* Persistent Coins Balance (🪙) */}
          <button
            onClick={() => {
              gameAudio.playConfirmSelect();
              setIsHabitatShopOpen(true);
            }}
            title="Open Island Upgrades Shop"
            className="flex items-center gap-1 px-2 md:px-2.5 py-1 bg-amber-950/80 border border-yellow-400/80 rounded-xl text-xs md:text-sm font-black text-yellow-300 shadow-inner shadow-amber-500/30 hover:scale-105 transition-transform shrink-0">
            <span className="text-sm leading-none">🪙</span>
            <span>{coins}</span>
          </button>

          {/* Persistent Stars Balance (⭐) */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-amber-950/60 border border-amber-400/50 rounded-xl text-xs md:text-sm font-black text-amber-300">
            <Star size={13} className="fill-amber-400 text-amber-300" />
            <span>{stars}</span>
          </div>

          {/* Persistent Balloon Currency Balance (🎈) */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-sky-950/70 border border-sky-400/60 rounded-xl text-xs md:text-sm font-black text-sky-300">
            <span className="text-sm leading-none">🎈</span>
            <span>{balloons}</span>
          </div>
        </div>

        {/* Middle Navigation Group: Upgrades & Pet Sanctuary */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Island Upgrades Shop Button */}
          <button
            onClick={() => {
              gameAudio.playConfirmSelect();
              setIsHabitatShopOpen(true);
            }}
            title="Open Island Sanctuary Upgrades"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition-all shadow-md ${
              Object.keys(INITIAL_HABITAT_BUILDINGS).some((k) => {
                const b = INITIAL_HABITAT_BUILDINGS[k];
                const lvl = habitatBuildings[k] || 1;
                return lvl < b.maxLevel && coins >= getUpgradeCost(b, lvl);
              })
                ? 'bg-gradient-to-r from-amber-500/30 via-yellow-500/30 to-emerald-500/30 border-yellow-400 text-yellow-300 ring-2 ring-yellow-400/50 animate-pulse'
                : 'bg-slate-800/90 border-slate-700 text-amber-300 hover:border-amber-400'
            }`}>
            <span className="text-sm leading-none">🏡</span>
            <span className="hidden sm:inline font-extrabold tracking-wide">UPGRADES</span>
            <span className="text-[10px] bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full font-black border border-amber-400/40 shadow-inner whitespace-nowrap">
              TOTAL UPGRADES: {totalUpgradesPurchased}
            </span>
          </button>

          {/* Active Pet Pill Button - Opens Pet Collection Drawer */}
          <button
            onClick={() => {
              gameAudio.playConfirmSelect();
              setIsPetCollectionOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 border border-pink-400/50 hover:border-pink-300 shadow-md hover:scale-105 transition-all text-xs font-bold text-pink-200">
            <span className="text-sm leading-none">{activePetDef.emoji}</span>
            <span className="hidden sm:inline text-yellow-300 font-extrabold">{activePetDef.name.split(' ')[0]}</span>
            <span className="text-[10px] bg-pink-500/40 text-pink-100 px-1 rounded-full font-black">
              PETS
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Moves Counter Pill */}
          <div className={`text-center px-2 py-0.5 rounded-xl border transition-all ${
            (gameState.moves ?? 0) <= 3
              ? 'bg-rose-950/90 border-rose-500 text-rose-300 ring-2 ring-rose-500/60 shadow-lg shadow-rose-500/40 animate-pulse'
              : 'bg-slate-800/80 border-slate-700 text-yellow-400'
          }`}>
            <div className="text-[8px] text-slate-400 font-medium leading-none">Moves</div>
            <div className={`text-xs md:text-sm font-black ${
              (gameState.moves ?? 0) <= 3 ? 'text-rose-300' : 'text-yellow-400'
            }`}>
              {gameState.moves}
            </div>
          </div>

          {/* Music Mute / Unmute Toggle Button */}
          <button
            onClick={toggleMusicMute}
            aria-label={musicMuted ? "Unmute Background Music" : "Mute Background Music"}
            title={musicMuted ? "Unmute Background Music" : "Mute Background Music"}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              musicMuted
                ? 'bg-slate-800/90 border border-rose-500/50 text-rose-400'
                : 'bg-indigo-600/30 border border-indigo-400/50 text-emerald-300'
            }`}>
            {musicMuted ? (
              <div className="relative flex items-center justify-center">
                <Music size={15} className="text-slate-400" />
                <div className="absolute w-[16px] h-[2px] bg-rose-500 rotate-45 rounded-full" />
              </div>
            ) : (
              <Music size={15} className="text-emerald-300 animate-pulse" />
            )}
          </button>

          {/* Game Menu Toggle Button */}
          <button
            onClick={() => {
              gameAudio.playCrispClick();
              setIsGameMenuOpen(true);
              setGameState((prev) => ({...prev, status: 'PAUSED'}));
            }}
            aria-label="Open Menu"
            className="w-8 h-8 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 flex items-center justify-center text-indigo-200 transition-colors">
            <MenuIcon size={16} />
          </button>
        </div>
      </header>

      {/* Dynamic Popping Cartoon Combo Announcement Banner */}
      {comboBanner && (
        <div
          key={comboBanner.key}
          className="absolute top-14 z-30 pointer-events-none flex flex-col items-center animate-bounce">
          <div className={`font-black text-lg md:text-2xl px-6 py-2 rounded-full shadow-2xl border-2 flex items-center gap-2 transform rotate-[-2deg] ${
            comboBanner.tier >= 4
              ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 text-white border-yellow-200 shadow-yellow-400/50 ring-4 ring-yellow-400/30'
              : 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white border-yellow-300 shadow-pink-500/40'
          }`}>
            <Sparkles size={22} className="text-yellow-300 animate-spin" />
            <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide">
              {comboBanner.text}
            </span>
          </div>
          <div className="text-yellow-300 text-xs md:text-sm font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] mt-0.5 bg-slate-950/80 px-3 py-0.5 rounded-full border border-yellow-400/40">
            {comboBanner.subtext}
          </div>
        </div>
      )}

      {/* Main Game Canvas Container */}
      {assetsReady && (
        <main className="flex-1 w-full min-h-0 flex items-center justify-center relative touch-none">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
              width: `min(100%, calc(100vh * ${canvasWidth} / ${canvasHeight}))`,
              touchAction: 'none',
            }}
            className="h-auto max-w-full max-h-full drop-shadow-2xl cursor-pointer"
          />

          {/* Dismissed Victory Floating Quick Action Bar */}
          {gameState.status === 'VICTORY' && isVictoryModalDismissed && (
            <div className="absolute bottom-5 z-30 flex items-center gap-3 bg-slate-900/95 border-2 border-emerald-500 p-2.5 rounded-2xl shadow-2xl animate-fade-in">
              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  startLevel(gameState.level + 1);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black rounded-xl text-sm shadow-md flex items-center gap-2">
                <Play size={16} className="fill-white" />
                Next Level {gameState.level + 1} →
              </button>
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsVictoryModalDismissed(false);
                }}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-yellow-300 font-bold rounded-xl text-xs flex items-center gap-1.5">
                <Trophy size={15} />
                View Victory Stats
              </button>
            </div>
          )}
        </main>
      )}

      {/* 1. START TITLE SCREEN MODAL */}
      {gameState.status === 'START' && (
        <MenuOverlay
          tone="neutral"
          zIndex={40}
          onClose={() => {
            if (hasSavedProgress) {
              gameAudio.playConfirmSelect();
              startLevel(savedData?.currentLevel || 1);
            }
          }}>
          <div className="w-full max-w-md flex flex-col items-center bg-slate-900 border-2 border-pink-500/40 rounded-3xl p-6 shadow-2xl relative">
            {hasSavedProgress && (
              <button
                aria-label="Close"
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  startLevel(savedData?.currentLevel || 1);
                }}
                className="absolute top-4 right-4 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-base transition-colors shadow-md pointer-events-auto">
                <X size={18} />
              </button>
            )}

            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-pink-500 via-amber-400 to-emerald-400 p-1 mb-3 shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center text-2xl gap-1">
                <span>🐰</span>
                <span>🐼</span>
                <span>🐶</span>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-black mb-1 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-indigo-300 text-center">
              Yum Pets: Match &amp; Feed
            </h1>
            <p className="text-xs md:text-sm text-pink-200 font-semibold mb-3 text-center">
              Match Tasty Treats to Feed &amp; Unlock 5 Adorable Animal Companions!
            </p>

            {/* Persistent Status Badge */}
            <div className="w-full bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-pink-900/60 border border-indigo-500/40 rounded-2xl p-3 mb-3 grid grid-cols-3 gap-1 text-center shadow-inner">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">Current Level</div>
                <div className="text-sm md:text-base font-black text-yellow-300 flex items-center justify-center gap-1">
                  <Trophy size={13} className="fill-yellow-300" />
                  Level {savedData?.currentLevel || 1}
                </div>
              </div>
              <div className="border-x border-slate-700/80">
                <div className="text-[10px] text-slate-400 font-semibold">Coins Balance</div>
                <div className="text-sm md:text-base font-black text-amber-300 flex items-center justify-center gap-1">
                  🪙 {coins}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">Active Pet</div>
                <div className="text-sm md:text-base font-black text-pink-300 flex items-center justify-center gap-1">
                  {activePetDef.emoji} {activePetDef.name.split(' ')[0]}
                </div>
              </div>
            </div>

            {/* Habitat Island Upgrades Summary Bar */}
            <div className="w-full bg-slate-800/80 border border-amber-500/40 rounded-2xl p-2.5 mb-3 flex items-center justify-around">
              <div className="flex items-center gap-1 text-xs">
                <span>🥣</span>
                <span className="text-[11px] font-bold text-amber-300">Bowl L{habitatBuildings.food_bowl || 1}</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-1 text-xs">
                <span>🏡</span>
                <span className="text-[11px] font-bold text-emerald-300">Treehouse L{habitatBuildings.treehouse_log || 1}</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-1 text-xs">
                <span>✨</span>
                <span className="text-[11px] font-bold text-purple-300">Canopy L{habitatBuildings.celestial_canopy || 1}</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="text-[10px] bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full font-black border border-amber-400/30">
                TOTAL UPGRADES: {totalUpgradesPurchased}
              </div>
            </div>

            {/* 5 Pets Showcase Banner */}
            <div className="w-full bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3 mb-3">
              <div className="text-xs font-bold text-amber-300 text-center mb-2 flex items-center justify-center gap-1">
                <span>🐾 Meet the 5 Companion Pets</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {PET_REGISTRY.map((p) => {
                  const isUnlocked = unlockedPetIds.includes(p.id);
                  const isSelected = selectedPetId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-col items-center p-1.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-pink-500/20 border-pink-400 ring-2 ring-pink-400/50 scale-105'
                          : isUnlocked
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-900/60 border-slate-800 opacity-60'
                      }`}>
                      <span className="text-xl">{p.emoji}</span>
                      <span className="text-[9px] font-black mt-0.5 text-slate-200 truncate w-full text-center">
                        {p.name.split(' ')[0]}
                      </span>
                      {isSelected ? (
                        <span className="text-[7px] text-pink-300 font-black">ACTIVE</span>
                      ) : isUnlocked ? (
                        <span className="text-[7px] text-emerald-400 font-bold">READY</span>
                      ) : (
                        <span className="text-[7px] text-slate-400 font-bold">LOCKED</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="w-full space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    gameAudio.playConfirmSelect();
                    setIsHabitatShopOpen(true);
                  }}
                  className="min-h-[44px] bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 rounded-2xl font-black text-xs md:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-md">
                  <span>🏡 ISLAND SHOP</span>
                </button>

                <button
                  onClick={() => {
                    gameAudio.playConfirmSelect();
                    setIsPetCollectionOpen(true);
                  }}
                  className="min-h-[44px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black text-xs md:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-md">
                  <span>🐾 PET SANCTUARY</span>
                </button>
              </div>

              {hasSavedProgress ? (
                <>
                  <button
                    ref={continueBtnRef}
                    onClick={() => {
                      gameAudio.playConfirmSelect();
                      startLevel(savedData?.currentLevel || savedData?.highestLevel || 1);
                    }}
                    className="w-full min-h-[50px] bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-white py-3 rounded-full font-black text-lg md:text-xl shadow-lg transition-all flex items-center justify-center gap-2">
                    <Play size={22} className="fill-white" />
                    CONTINUE (Level {savedData?.currentLevel || savedData?.highestLevel || 1})
                  </button>

                  <button
                    onClick={() => {
                      gameAudio.playCrispClick();
                      startLevel(1);
                    }}
                    className="w-full min-h-[40px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 py-1.5 rounded-full font-bold text-xs transition-colors flex items-center justify-center gap-2">
                    <RefreshCw size={15} />
                    NEW GAME (Start Level 1)
                  </button>
                </>
              ) : (
                <button
                  ref={startBtnRef}
                  onClick={() => {
                    gameAudio.playConfirmSelect();
                    startLevel(1);
                  }}
                  className="w-full min-h-[52px] bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white py-3.5 rounded-full font-black text-lg md:text-xl shadow-lg transition-all flex items-center justify-center gap-2">
                  <Play size={22} className="fill-white" />
                  PLAY LEVEL 1
                </button>
              )}
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 2. PET COLLECTION & UNLOCKING MODAL / DRAWER */}
      {isPetCollectionOpen && (
        <MenuOverlay
          tone="neutral"
          zIndex={50}
          onClose={() => {
            gameAudio.playCrispClick();
            setIsPetCollectionOpen(false);
          }}>
          <div className="w-full max-w-lg flex flex-col items-center bg-slate-900 border-2 border-pink-500/60 rounded-3xl p-5 shadow-2xl relative animate-fade-in max-h-[88vh] overflow-hidden">
            {/* Modal 'X' Close Button */}
            <button
              aria-label="Close"
              onClick={() => {
                gameAudio.playCrispClick();
                setIsPetCollectionOpen(false);
              }}
              className="absolute top-4 right-4 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-base transition-colors shadow-md pointer-events-auto">
              <X size={18} />
            </button>

            {/* Header with Coin Counter */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🐾</span>
              <h2 className="text-2xl md:text-3xl font-black text-yellow-300 tracking-wide">
                Pet Sanctuary &amp; Collection
              </h2>
            </div>
            
            <div className="flex items-center justify-between w-full px-2 mb-3">
              <span className="text-xs text-slate-400">
                Choose your companion to roam the island &amp; apply passive perks!
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/80 border border-yellow-400/80 rounded-xl text-xs font-black text-yellow-300 shadow-inner">
                <span>🪙</span>
                <span>{coins} Coins</span>
              </div>
            </div>

            {/* Scrollable Pet Cards List */}
            <div className="w-full space-y-3 overflow-y-auto pr-1 mb-4 flex-1">
              {PET_REGISTRY.map((pet) => {
                const isUnlocked = unlockedPetIds.includes(pet.id);
                const isSelected = selectedPetId === pet.id;
                const canAfford = pet.unlockCost ? coins >= pet.unlockCost : false;
                const isLevelLocked = pet.unlockLevel ? (savedData?.highestLevel || 1) < pet.unlockLevel : false;

                return (
                  <div
                    key={pet.id}
                    className={`relative rounded-2xl border-2 p-3.5 transition-all bg-gradient-to-r ${pet.bgGradient} ${
                      isSelected
                        ? 'border-yellow-400 ring-2 ring-yellow-400/40 bg-slate-800/95 shadow-xl shadow-yellow-500/10'
                        : isUnlocked
                        ? 'border-slate-700 hover:border-slate-500 bg-slate-800/80'
                        : 'border-slate-800 bg-slate-900/60 opacity-80'
                    }`}>
                    <div className="flex items-start gap-3">
                      {/* Pet Avatar Box */}
                      <div
                        className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-2xl flex items-center justify-center text-3xl border-2 shadow-md relative"
                        style={{
                          backgroundColor: `${pet.color}20`,
                          borderColor: pet.accentColor,
                        }}>
                        <span>{pet.emoji}</span>
                        {isSelected && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-400 text-slate-950 rounded-full flex items-center justify-center font-black text-[10px] shadow">
                            ✓
                          </div>
                        )}
                      </div>

                      {/* Pet Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-black text-sm md:text-base text-white truncate">
                            {pet.name}
                          </h4>
                          {isSelected ? (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-black shadow">
                              ACTIVE COMPANION
                            </span>
                          ) : isUnlocked ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                              UNLOCKED
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-bold flex items-center gap-1">
                              <Lock size={10} /> LOCKED
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
                          {pet.tagline}
                        </p>

                        {/* Passive Bonus Badge */}
                        <div className="mt-1.5 flex items-center gap-1 text-xs font-bold text-amber-300 bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-700/80">
                          <Zap size={13} className="text-yellow-400 shrink-0" />
                          <span className="truncate">{pet.passiveBonus}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Footer for Card */}
                    <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-400">
                        {isUnlocked ? (
                          <span className="text-emerald-400 font-semibold">Ready to accompany in sanctuary</span>
                        ) : pet.unlockCost ? (
                          <span className="text-yellow-400 font-bold">Cost: 🪙 {pet.unlockCost} Coins</span>
                        ) : (
                          <span className="text-sky-300 font-bold">Requirement: {pet.unlockRequirement}</span>
                        )}
                      </div>

                      {/* Button Action */}
                      {isSelected ? (
                        <button
                          disabled
                          className="px-4 py-1.5 rounded-xl bg-yellow-400/20 text-yellow-300 border border-yellow-400/50 font-black text-xs cursor-default">
                          Selected ✓
                        </button>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => handleSelectPet(pet.id)}
                          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs shadow-md transition-all">
                          Select Companion
                        </button>
                      ) : pet.unlockCost ? (
                        <button
                          onClick={() => handleUnlockPetWithCoins(pet)}
                          disabled={!canAfford}
                          className={`px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 shadow-md transition-all ${
                            canAfford
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 ring-2 ring-yellow-400/50'
                              : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                          }`}>
                          <span>🪙 Unlock ({pet.unlockCost})</span>
                        </button>
                      ) : (
                        <div className="text-xs font-bold text-slate-500 px-3 py-1 bg-slate-800 rounded-xl border border-slate-700">
                          {isLevelLocked ? `Reach Level ${pet.unlockLevel}` : 'Locked'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full flex gap-2">
              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  setIsPetCollectionOpen(false);
                  setIsHabitatShopOpen(true);
                }}
                className="flex-1 min-h-[44px] bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-black rounded-full text-xs md:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-md">
                <span>🏡 ISLAND UPGRADES</span>
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsPetCollectionOpen(false);
                }}
                className="flex-1 min-h-[44px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-black rounded-full text-xs md:text-sm transition-colors flex items-center justify-center gap-2">
                CLOSE
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 2.5. HABITAT UPGRADES & ISLAND SHOP MODAL */}
      {isHabitatShopOpen && (
        <MenuOverlay
          tone="neutral"
          zIndex={50}
          onClose={() => {
            gameAudio.playCrispClick();
            setIsHabitatShopOpen(false);
          }}>
          <div className="w-full max-w-lg flex flex-col items-center bg-slate-900 border-2 border-amber-400/70 rounded-3xl p-5 shadow-2xl relative animate-fade-in max-h-[88vh] overflow-hidden">
            {/* Modal 'X' Close Button */}
            <button
              aria-label="Close"
              onClick={() => {
                gameAudio.playCrispClick();
                setIsHabitatShopOpen(false);
              }}
              className="absolute top-4 right-4 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-base transition-colors shadow-md pointer-events-auto">
              <X size={18} />
            </button>

            {/* Header with Coin Counter */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏡</span>
              <h2 className="text-2xl md:text-3xl font-black text-amber-300 tracking-wide">
                Island Sanctuary Upgrades
              </h2>
            </div>
            
            <div className="flex items-center justify-between w-full px-2 mb-3 gap-2">
              <span className="text-xs text-slate-400 truncate">
                Permanent gameplay boosts for all levels &amp; roaming pets!
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-[11px] bg-amber-500/20 text-amber-200 px-2.5 py-1 rounded-xl font-black border border-amber-400/40 shadow-inner whitespace-nowrap">
                  TOTAL UPGRADES: {totalUpgradesPurchased} / 12
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/80 border border-yellow-400/80 rounded-xl text-xs font-black text-yellow-300 shadow-inner">
                  <span>🪙</span>
                  <span>{coins}</span>
                </div>
              </div>
            </div>

            {/* Scrollable Building Upgrade Cards List */}
            <div className="w-full space-y-3 overflow-y-auto pr-1 mb-4 flex-1">
              {Object.keys(INITIAL_HABITAT_BUILDINGS).map((bKey) => {
                const building = INITIAL_HABITAT_BUILDINGS[bKey];
                const currentLvl = habitatBuildings[bKey] || 1;
                const isMax = currentLvl >= building.maxLevel;
                const cost = getUpgradeCost(building, currentLvl);
                const canAfford = coins >= cost && !isMax;

                // Compute explicit perk stats
                let activeEffectDesc = '';
                let nextEffectDesc = '';
                let categoryColor = 'text-amber-400';
                let categoryBg = 'bg-amber-500/20 border-amber-400/50';

                if (building.id === 'food_bowl') {
                  categoryColor = 'text-pink-400';
                  categoryBg = 'bg-pink-500/20 border-pink-400/50';
                  const curGain = 100 + (currentLvl - 1) * 25;
                  const nextGain = 100 + currentLvl * 25;
                  const curSec = Math.max(7, 22 - currentLvl * 3);
                  const nextSec = Math.max(7, 22 - (currentLvl + 1) * 3);
                  activeEffectDesc = `+${(currentLvl - 1) * 25}% Petting Happiness (${curGain}% total) • Snack drop every ${curSec}s`;
                  nextEffectDesc = `+${currentLvl * 25}% Petting Happiness (${nextGain}% total) • Snack drop every ${nextSec}s`;
                } else if (building.id === 'treehouse_log') {
                  categoryColor = 'text-emerald-400';
                  categoryBg = 'bg-emerald-500/20 border-emerald-400/50';
                  activeEffectDesc = `+${(currentLvl - 1) * 20}% Bonus Coins on every Level Complete victory`;
                  nextEffectDesc = `+${currentLvl * 20}% Bonus Coins on every Level Complete victory`;
                } else if (building.id === 'celestial_canopy') {
                  categoryColor = 'text-purple-400';
                  categoryBg = 'bg-purple-500/20 border-purple-400/50';
                  const curMoves = currentLvl >= 5 ? 3 : currentLvl >= 4 ? 2 : currentLvl >= 2 ? 1 : 0;
                  const nextMoves = (currentLvl + 1) >= 5 ? 3 : (currentLvl + 1) >= 4 ? 2 : (currentLvl + 1) >= 2 ? 1 : 0;
                  activeEffectDesc = `+${curMoves} Extra Starting Moves • +${(currentLvl - 1) * 5}% Pepper Bomb Spawn Chance`;
                  nextEffectDesc = `+${nextMoves} Extra Starting Moves • +${currentLvl * 5}% Pepper Bomb Spawn Chance`;
                }

                return (
                  <div
                    key={building.id}
                    className={`relative rounded-2xl border-2 p-3.5 transition-all bg-gradient-to-r ${building.bgGradient} ${
                      isMax
                        ? 'border-yellow-400/80 bg-slate-800/90 shadow-lg'
                        : canAfford
                        ? 'border-amber-400/70 ring-2 ring-amber-400/30 bg-slate-800/90 shadow-lg'
                        : 'border-slate-700 bg-slate-800/70'
                    }`}>
                    {/* Perk Category Pill & Level Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border tracking-wider shadow-sm flex items-center gap-1 ${categoryBg} ${categoryColor}`}>
                        <span>{building.categoryBadge}</span>
                      </span>
                      {isMax ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-black shadow">
                          MAX LEVEL 5 ★
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/80 text-amber-300 border border-amber-400/40 font-bold">
                          Level {currentLvl} / {building.maxLevel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-3">
                      {/* Structure Icon Box with Level Badge */}
                      <div
                        className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-2xl flex flex-col items-center justify-center text-2xl border-2 shadow-md relative"
                        style={{
                          backgroundColor: `${building.accentColor}20`,
                          borderColor: building.accentColor,
                        }}>
                        <span>{building.icon}</span>
                        <div className="absolute -bottom-1.5 bg-slate-950 border border-amber-400 text-amber-300 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                          LVL {currentLvl}/{building.maxLevel}
                        </div>
                      </div>

                      {/* Structure Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm md:text-base text-white truncate">
                          {building.name}
                        </h4>

                        <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
                          {building.description}
                        </p>

                        {/* Current Active Bonus Tag */}
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-700/80">
                          <Check size={12} className="text-emerald-400 shrink-0" />
                          <span className="truncate">Active: {activeEffectDesc}</span>
                        </div>

                        {/* Next Level Preview Tag if not max */}
                        {!isMax && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-200/90 bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-500/30">
                            <ArrowUpCircle size={11} className="text-yellow-400 shrink-0" />
                            <span className="truncate">Next Lvl: {nextEffectDesc}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Pips */}
                    <div className="mt-2.5 flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((lvlPip) => (
                        <div
                          key={lvlPip}
                          className={`flex-1 h-2 rounded-full transition-all ${
                            lvlPip <= currentLvl
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-sm shadow-amber-400/50'
                              : 'bg-slate-700/80'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Action Footer for Card */}
                    <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-400">
                        {isMax ? (
                          <span className="text-yellow-300 font-bold">Max level reached! Fully enchanted!</span>
                        ) : (
                          <span className="text-yellow-400 font-bold">Upgrade Cost: 🪙 {cost} Coins</span>
                        )}
                      </div>

                      {/* Upgrade Action Button */}
                      {isMax ? (
                        <button
                          disabled
                          className="px-4 py-1.5 rounded-xl bg-yellow-400/20 text-yellow-300 border border-yellow-400/50 font-black text-xs cursor-default">
                          Fully Mastered ✓
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpgradeBuilding(bKey)}
                          disabled={!canAfford}
                          className={`px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md transition-all ${
                            canAfford
                              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 ring-2 ring-yellow-400/50 hover:scale-105'
                              : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                          }`}>
                          <Hammer size={12} className="shrink-0" />
                          <span>Upgrade ({cost} 🪙)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full flex gap-2">
              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  setIsHabitatShopOpen(false);
                  setIsPetCollectionOpen(true);
                }}
                className="flex-1 min-h-[44px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-full text-xs md:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-md">
                <span>🐾 PET SANCTUARY</span>
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsHabitatShopOpen(false);
                }}
                className="flex-1 min-h-[44px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-black rounded-full text-xs md:text-sm transition-colors flex items-center justify-center gap-2">
                CLOSE SHOP
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 3. SAVE YOUR STREAK FAIL-SAFE MODAL */}
      {isSaveStreakModalOpen && (
        <MenuOverlay
          tone="neutral"
          zIndex={50}
          onClose={handleForfeitLevel}>
          <div className="w-full max-w-md flex flex-col items-center bg-slate-900 border-2 border-amber-400/80 rounded-3xl p-6 shadow-2xl relative animate-fade-in">
            <button
              aria-label="Close"
              onClick={handleForfeitLevel}
              className="absolute top-4 right-4 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-base transition-colors shadow-md pointer-events-auto">
              <X size={18} />
            </button>

            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-sky-400 via-amber-300 to-pink-400 flex items-center justify-center text-4xl mb-3 shadow-xl animate-bounce">
              🎈
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-yellow-300 mb-1 text-center tracking-wide">
              SAVE YOUR STREAK!
            </h2>
            <p className="text-xs md:text-sm text-sky-200 text-center mb-4">
              You are out of moves, but you can continue Level {gameState.level} with extra moves!
            </p>

            <div className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-4 mb-4 text-center space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-300 pb-2 border-b border-slate-700">
                <span>Happiness Needed:</span>
                <span className="font-bold text-yellow-300">{gameState.score} / {targetHappiness}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Your Balloon Balance:</span>
                <span className="font-black text-sky-300 flex items-center gap-1">
                  🎈 {balloons} Balloons
                </span>
              </div>
            </div>

            <div className="w-full space-y-3">
              {balloons >= 30 ? (
                <button
                  ref={saveStreakBtnRef}
                  onClick={handleSpendBalloonsForMoves}
                  className="w-full min-h-[52px] bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white py-3 rounded-full font-black text-base md:text-lg shadow-lg hover:shadow-sky-500/40 transition-all flex items-center justify-center gap-2">
                  <Sparkles size={20} className="text-yellow-300" />
                  SPEND 30 🎈 FOR +3 MOVES
                </button>
              ) : (
                <div className="w-full space-y-1 text-center">
                  <button
                    disabled
                    className="w-full min-h-[50px] bg-slate-800 border border-slate-700 text-slate-500 py-3 rounded-full font-black text-sm md:text-base cursor-not-allowed flex items-center justify-center gap-2">
                    <span>Need 30 🎈 (Have {balloons} 🎈)</span>
                  </button>
                  <div className="text-[11px] text-amber-300/80">
                    Match 🎈 balloon tiles during gameplay to earn more balloons!
                  </div>
                </div>
              )}

              <button
                onClick={handleForfeitLevel}
                className="w-full min-h-[46px] bg-rose-950/60 hover:bg-rose-900/60 border border-rose-700/60 text-rose-300 rounded-full font-bold text-sm transition-colors flex items-center justify-center gap-2">
                <X size={16} />
                FORFEIT LEVEL (-1 ⭐ Star Penalty)
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 4. GAME MENU / SETTINGS MODAL */}
      {isGameMenuOpen && (
        <MenuOverlay
          tone="neutral"
          zIndex={45}
          onClose={() => {
            gameAudio.playCrispClick();
            setIsGameMenuOpen(false);
            setGameState((prev) => ({...prev, status: 'PLAYING'}));
          }}>
          <div className="w-full max-w-md flex flex-col items-center bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 shadow-2xl relative">
            <button
              aria-label="Close"
              onClick={() => {
                gameAudio.playCrispClick();
                setIsGameMenuOpen(false);
                setGameState((prev) => ({...prev, status: 'PLAYING'}));
              }}
              className="absolute top-4 right-4 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-base transition-colors shadow-md pointer-events-auto">
              <X size={18} />
            </button>

            <h2 className="text-2xl md:text-3xl font-black mb-5 text-yellow-300 text-center">
              Game Menu &amp; Settings
            </h2>

            <div className="w-full space-y-3 mb-6">
              {/* Island Upgrades Button */}
              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  setIsHabitatShopOpen(true);
                }}
                className="w-full min-h-[48px] bg-gradient-to-r from-amber-900/60 to-yellow-900/60 hover:from-amber-800/80 hover:to-yellow-800/80 border border-amber-500/60 rounded-xl px-4 py-2.5 font-bold flex items-center justify-between transition-colors">
                <span className="flex items-center gap-2">
                  <span className="text-lg">🏡</span>
                  <span>Island Sanctuary Upgrades</span>
                </span>
                <span className="text-amber-200 text-xs font-black bg-amber-500/30 border border-amber-400/40 px-2 py-0.5 rounded-full">
                  TOTAL UPGRADES: {totalUpgradesPurchased}
                </span>
              </button>

              {/* Pet Collection Button */}
              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  setIsPetCollectionOpen(true);
                }}
                className="w-full min-h-[48px] bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800/80 hover:to-indigo-800/80 border border-purple-500/60 rounded-xl px-4 py-2.5 font-bold flex items-center justify-between transition-colors">
                <span className="flex items-center gap-2">
                  <span className="text-lg">🐾</span>
                  <span>Pet Collection ({unlockedPetIds.length}/5 Unlocked)</span>
                </span>
                <span className="text-yellow-300 text-xs font-black">VIEW</span>
              </button>

              {/* Background Music Toggle */}
              <button
                onClick={toggleMusicMute}
                className={`w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 border rounded-xl px-4 py-2.5 font-bold flex items-center justify-between transition-colors ${
                  musicMuted ? 'border-slate-700 text-slate-300' : 'border-emerald-500/50 text-white'
                }`}>
                <span className="flex items-center gap-2.5">
                  <Music size={18} className={musicMuted ? 'text-slate-400' : 'text-emerald-400'} />
                  <span>Background Music</span>
                </span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-lg font-black border ${
                    musicMuted
                      ? 'bg-rose-950/80 border-rose-500/60 text-rose-400'
                      : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400'
                  }`}>
                  {musicMuted ? 'MUTED' : 'PLAYING'}
                </span>
              </button>

              {/* Sound Effects Toggle */}
              <button
                onClick={toggleSfxMute}
                className={`w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 border rounded-xl px-4 py-2.5 font-bold flex items-center justify-between transition-colors ${
                  sfxMuted ? 'border-slate-700 text-slate-300' : 'border-indigo-500/50 text-white'
                }`}>
                <span className="flex items-center gap-2.5">
                  <Volume2 size={18} className={sfxMuted ? 'text-slate-400' : 'text-indigo-400'} />
                  <span>Sound Effects</span>
                </span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-lg font-black border ${
                    sfxMuted
                      ? 'bg-rose-950/80 border-rose-500/60 text-rose-400'
                      : 'bg-indigo-950/80 border-indigo-500/60 text-indigo-300'
                  }`}>
                  {sfxMuted ? 'MUTED' : 'ON'}
                </span>
              </button>

              {/* How to Play Guide */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsHowToPlayOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-4 py-2.5 font-bold flex items-center justify-between transition-colors">
                <span className="flex items-center gap-2">
                  <HelpCircle size={18} />
                  How to Play &amp; Pet Perks Guide
                </span>
                <span className="text-indigo-400 text-xs font-semibold">VIEW</span>
              </button>
            </div>

            <div className="w-full space-y-2.5">
              <button
                ref={resumeBtnRef}
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'PLAYING'}));
                }}
                className="w-full min-h-[50px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-full font-black text-lg transition-colors flex items-center justify-center gap-2">
                <Play size={20} className="fill-white" />
                RESUME GAME
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  startLevel(gameState.level);
                }}
                className="w-full min-h-[46px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-full font-bold text-sm transition-colors flex items-center justify-center gap-2">
                <RotateCw size={16} />
                Restart Level {gameState.level}
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full min-h-[46px] bg-red-950/60 hover:bg-red-900/60 border border-red-800 text-red-300 rounded-full font-bold text-sm transition-colors flex items-center justify-center gap-2">
                <X size={16} />
                Quit to Title Screen
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 5. HOW TO PLAY OVERLAY */}
      {isHowToPlayOpen && (
        <MenuOverlay
          tone="neutral"
          zIndex={50}
          onClose={() => {
            gameAudio.playCrispClick();
            setIsHowToPlayOpen(false);
          }}>
          <div className="w-full max-w-md flex flex-col items-center bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-6 shadow-2xl relative">
            <button
              aria-label="Close"
              onClick={() => {
                gameAudio.playCrispClick();
                setIsHowToPlayOpen(false);
              }}
              className="absolute top-4 right-4 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-base transition-colors shadow-md pointer-events-auto">
              <X size={18} />
            </button>

            <h3 className="text-2xl font-black mb-4 text-amber-300 text-center">
              How To Play &amp; Pet Perks
            </h3>

            <div className="w-full space-y-3 text-xs md:text-sm text-slate-200 mb-6 max-h-[60vh] overflow-y-auto pr-1">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <h4 className="font-bold text-pink-400 mb-1 flex items-center gap-1.5">
                  <Zap size={15} /> 1. Biomes &amp; Signature Treats
                </h4>
                <p>
                  Every 5 levels journeys to a new Biome (<strong>Meadow Haven, Bamboo Grove, Berry Lagoon, Sunny Orchard, Starlight Peaks</strong>) with regional treats! Match 3+ treats to feed your companion.
                </p>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <h4 className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <Heart size={15} /> 2. Companion Favorite Treats (+50% Bonus!)
                </h4>
                <p>
                  Adopting pets injects their favorite treat into all level pools! Matching your companion's favorite treat grants <strong>+50% Bonus Happiness</strong>: 🐰 Pip (Carrots), 🐼 Bao (Bamboo), 🐿️ Gizmo (Acorns), 🐶 Coco (Biscuits), 🦊 Mimi (Starfruit)!
                </p>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <h4 className="font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                  <Shield size={15} /> 3. Dynamic Obstacles (Ice, Honey, Crates)
                </h4>
                <p>
                  As levels rise, break through single-layer and multi-layer <strong>Frost Ice ❄️</strong>, <strong>Golden Honey 🍯</strong>, and <strong>Wooden Crates 📦</strong> by matching adjacent tiles or igniting Pepper Bombs!
                </p>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <h4 className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                  <Home size={15} /> 4. Island Sanctuary Upgrades
                </h4>
                <p>
                  Upgrade <strong>The Golden Food Bowl</strong> (petting happiness &amp; auto-treats), <strong>The Treehouse &amp; Play Log</strong> (coin completion bonus + acrobatics), and <strong>The Celestial Canopy</strong> (+moves &amp; pepper bombs)!
                </p>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <h4 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <Star size={15} /> 5. Move-Based Stars &amp; Streak Saves
                </h4>
                <p>
                  Earn <strong>⭐⭐⭐ 3 Stars</strong> with 5+ moves left. If you run out of moves, spend 30 Balloons to save your streak (+3 moves)!
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                gameAudio.playCrispClick();
                setIsHowToPlayOpen(false);
              }}
              className="w-full min-h-[48px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-full text-base transition-colors flex items-center justify-center gap-2">
              GOT IT!
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* 6. VICTORY & LEVEL COMPLETE MODAL (WITH COIN BOUNTIES & PET UNLOCKS) */}
      {gameState.status === 'VICTORY' && !isVictoryModalDismissed && (
        <MenuOverlay
          tone="victory"
          zIndex={45}
          onClose={() => {
            gameAudio.playCrispClick();
            setIsVictoryModalDismissed(true);
          }}>
          <div className="w-full max-w-md flex flex-col items-center bg-slate-900 border-2 border-emerald-500/70 rounded-3xl p-6 shadow-2xl relative animate-fade-in">
            <button
              aria-label="Close"
              onClick={() => {
                gameAudio.playCrispClick();
                setIsVictoryModalDismissed(true);
              }}
              className="absolute top-4 right-4 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-base transition-colors shadow-md pointer-events-auto">
              <X size={18} />
            </button>

            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 border-2 border-yellow-300 flex items-center justify-center text-4xl mb-3 shadow-lg animate-bounce">
              🏆
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-yellow-300 mb-1 text-center tracking-wide">
              YUMMY! LEVEL COMPLETE!
            </h2>
            <p className="text-xs md:text-sm text-emerald-200 text-center mb-3 font-medium">
              ★ {currentBiome.badge} • {currentLevelConfig.name} Mastered!
            </p>

            {/* Stars Earned */}
            <div className="flex items-center gap-3 mb-2">
              {[1, 2, 3].map((starIdx) => {
                const isEarned = starIdx <= starsEarned;
                return (
                  <div
                    key={starIdx}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all transform duration-300 ${
                      isEarned
                        ? 'bg-gradient-to-tr from-amber-400 to-yellow-300 border-yellow-100 text-slate-950 scale-110 shadow-lg shadow-amber-400/30 animate-pulse'
                        : 'bg-slate-800/90 border-slate-700 text-slate-600 scale-95 opacity-60'
                    }`}>
                    <Star
                      size={26}
                      className={isEarned ? 'fill-slate-950 text-slate-950' : 'fill-none text-slate-600'}
                    />
                  </div>
                );
              })}
            </div>

            {/* Coin Bounty Rewards Card */}
            {victoryRewards && (
              <div className="w-full bg-amber-950/40 border border-yellow-400/60 rounded-2xl p-3 mb-3 text-center space-y-1.5 shadow-inner">
                <div className="text-xs font-extrabold text-yellow-300 flex items-center justify-center gap-1.5">
                  <span className="text-base">🪙</span>
                  <span>+{victoryRewards.totalCoinsWon} COINS EARNED!</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-amber-200/80 border-t border-yellow-500/20 pt-1 text-left px-2">
                  <div>Base: +{victoryRewards.baseCoins}</div>
                  <div>Moves Bonus: +{victoryRewards.movesBonus}</div>
                  <div>Stars: +{victoryRewards.starBonus}</div>
                  {victoryRewards.treehouseBonus > 0 && (
                    <div className="text-emerald-300 font-bold">🏡 Treehouse: +{victoryRewards.treehouseBonus}</div>
                  )}
                  {victoryRewards.corgiBonus > 0 && (
                    <div className="text-yellow-300 font-bold">🐶 Coco: +{victoryRewards.corgiBonus}</div>
                  )}
                </div>
              </div>
            )}

            {/* Happiness & Stats Breakdown */}
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3 w-full mb-3 text-center flex items-center justify-around">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">Happiness</div>
                <div className="text-lg font-black text-yellow-300">{gameState.score}</div>
              </div>
              <div className="border-r border-slate-700 h-7" />
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">Moves Left</div>
                <div className="text-lg font-black text-emerald-300">{currentMovesLeft}</div>
              </div>
              <div className="border-r border-slate-700 h-7" />
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">Total 🪙</div>
                <div className="text-lg font-black text-amber-300">{coins}</div>
              </div>
            </div>

            <div className="w-full space-y-2">
              <button
                ref={nextLevelBtnRef}
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  startLevel(gameState.level + 1);
                }}
                className="w-full min-h-[50px] bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-white py-2.5 rounded-full font-black text-base md:text-lg transition-colors flex items-center justify-center gap-2 shadow-lg">
                <Play size={18} className="fill-white" />
                NEXT LEVEL (LEVEL {gameState.level + 1}) →
              </button>

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => {
                    gameAudio.playConfirmSelect();
                    setIsHabitatShopOpen(true);
                  }}
                  className="flex-1 min-h-[38px] bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 rounded-full font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md">
                  <span>🏡 Island Upgrades</span>
                </button>

                <button
                  onClick={() => {
                    gameAudio.playConfirmSelect();
                    setIsPetCollectionOpen(true);
                  }}
                  className="flex-1 min-h-[38px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-yellow-300 rounded-full font-bold text-xs transition-colors flex items-center justify-center gap-1.5">
                  <span>🐾 Pet Sanctuary</span>
                </button>
              </div>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 7. GAME OVER & FORFEIT SCREEN */}
      {gameState.status === 'GAME_OVER' && (
        <MenuOverlay
          tone="danger"
          zIndex={45}
          onClose={() => {
            gameAudio.playCrispClick();
            setGameState((prev) => ({...prev, status: 'START'}));
          }}>
          <div className="w-full max-w-md flex flex-col items-center bg-slate-900 border-2 border-rose-600/60 rounded-3xl p-6 shadow-2xl relative animate-fade-in">
            <button
              aria-label="Close"
              onClick={() => {
                gameAudio.playCrispClick();
                setGameState((prev) => ({...prev, status: 'START'}));
              }}
              className="absolute top-4 right-4 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-base transition-colors shadow-md pointer-events-auto">
              <X size={18} />
            </button>

            <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center text-4xl mb-3">
              💔
            </div>
            <h2 className="text-3xl font-black text-rose-400 mb-1 text-center">
              LEVEL FORFEITED
            </h2>
            <p className="text-xs md:text-sm text-rose-200 text-center mb-4">
              Your pets are hungry, and you forfeited the attempt.
            </p>

            <div className="w-full bg-rose-950/70 border border-rose-500/40 rounded-2xl p-3.5 mb-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-amber-300">
                <span>⭐ -1 Star Lost!</span>
                <span className="text-slate-400">•</span>
                <span>Current Stars: ⭐ {stars}</span>
              </div>

              {lastForfeitPenalty?.demoted && (
                <div className="bg-red-900/60 border border-red-500/40 rounded-xl p-2 text-xs text-yellow-200">
                  ⚠️ <strong>Level Demotion:</strong> You dropped from Level {lastForfeitPenalty.prevLevel} to <strong>Level {lastForfeitPenalty.newLevel}</strong>. (+2 ⭐ buffer restored!)
                </div>
              )}
            </div>

            <div className="w-full space-y-2.5">
              <button
                ref={retryBtnRef}
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  startLevel(gameState.level);
                }}
                className="w-full min-h-[52px] bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white py-3 rounded-full font-black text-lg transition-colors flex items-center justify-center gap-2 shadow-lg">
                <RotateCw size={20} />
                RETRY LEVEL {gameState.level}
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-full font-bold text-xs md:text-sm transition-colors flex items-center justify-center gap-2">
                <X size={15} />
                Back to Title Menu
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}
