
import { UnitType } from './types';

export const GAME_VERSION = '1.1.9'; // Stage 2 Difficulty Rebalance

export const FIELD_WIDTH = 1000;
export const BASE_HP = 5000;
export const INITIAL_MONEY = 50; // Reduced starting budget
export const MONEY_TICK_INTERVAL = 100;
export const GAME_TICK_INTERVAL = 33;

export const WALLET_UPGRADE_COSTS = [150, 450, 1200, 3000, 7500, 18000];
// Money per tick acts as a multiplier now
export const MONEY_MULTIPLIER = [1.0, 1.8, 3.2, 5.5, 9.0, 15.0];

export const XP_PER_WIN = 100;
export const XP_TO_LEVEL = (level: number) => level * 150;

export const UNIT_UPGRADE_BASE_COST = 200;
export const UNIT_UPGRADE_COST_MULTIPLIER = 1.45;
export const STAT_GAIN_PER_LEVEL = 0.20;

// New Upgrade: Startup Capital
export const STARTING_BUDGET_GAIN_PER_LEVEL = 55;
export const STARTING_BUDGET_UPGRADE_BASE_COST = 150;
export const STARTING_BUDGET_UPGRADE_COST_MULTIPLIER = 1.8;

export const BANK_UPGRADE_BASE_COST = 100;
export const BANK_UPGRADE_COST_MULTIPLIER = 1.6;
export const BASE_BANK_INCOME_PER_TICK = 0.75; // 7.5 Dollars per second at 100ms interval
export const BANK_INCOME_GAIN_PER_LEVEL = 0.175; // +1.75 Dollar per second per level

export const CANNON_COOLDOWN = 30000;
export const CANNON_BASE_DAMAGE = 50;
export const CANNON_DAMAGE_PER_LEVEL = 50;
export const CANNON_MAX_LEVEL = 10;
export const CANNON_UPGRADE_BASE_COST = 500;

export const REWARD_PER_STAGE = 225;
export const FIRST_CLEAR_MULTIPLIER = 3.25;

export const PLAYER_UNITS: UnitType[] = [
  {
    id: 'baby',
    name: 'Baby Intern',
    icon: 'fas fa-baby',
    cost: 50,
    hp: 150,
    damage: 15,
    speed: 4,
    range: 40,
    attackCooldown: 1000,
    spawnCooldown: 2000,
    unlockLevel: 1,
    description: 'Entry-level asset. Fragile but cost-effective for early game pressure.',
    altForm: {
      name: 'Hairy Graduate',
      hp: 150,
      damage: 15,
      speed: 4,
      range: 40,
      attackCooldown: 1000,
      cost: 50,
      description: 'With a full head of hair, this intern finally feels confident enough to demand a living wage.'
    }
  },
  {
    id: 'tank',
    name: 'Human Tank',
    icon: 'fas fa-user-shield',
    cost: 200,
    hp: 1200,
    damage: 8,
    speed: 1.5,
    range: 35,
    attackCooldown: 1500,
    spawnCooldown: 5000,
    unlockLevel: 2,
    description: 'A dedicated damage sponge. Extremely low offensive capability but high survivability.',
    altForm: {
      name: 'Human Fortress',
      hp: 1700,
      damage: 8,
      speed: 0.8,
      range: 35,
      attackCooldown: 1500,
      cost: 300,
      description: 'The ultimate wall. Moves at a glacial pace but can withstand a whole department of layoffs.'
    }
  },
  {
    id: 'sworder',
    name: 'Sworder',
    icon: 'fas fa-khanda',
    cost: 200,
    hp: 450,
    damage: 30,
    speed: 5,
    range: 55,
    attackCooldown: 1000,
    spawnCooldown: 6000,
    unlockLevel: 3,
    description: 'Melee specialist wielding a corporate letter opener. High attack speed and solid damage.',
    altForm: {
      name: 'Blacksteel',
      hp: 450,
      damage: 90,
      speed: 5,
      range: 85,
      attackCooldown: 3000,
      cost: 200,
      description: 'Wielding a reinforced industrial shredder blade. Slow strikes, but they cut deep through red tape.'
    }
  },
  {
    id: 'pistoler',
    name: 'Pistoler',
    icon: 'fas fa-gun',
    cost: 200,
    hp: 230,
    damage: 38,
    speed: 5.5,
    range: 350,
    attackCooldown: 1250,
    spawnCooldown: 4000,
    unlockLevel: 4,
    description: 'Mid-range firearm specialist. Delivers consistent high-velocity damage from a distance.'
  },
  {
    id: 'guard',
    name: 'Security',
    icon: 'fas fa-shield-halved',
    cost: 550,
    hp: 2500,
    damage: 50,
    speed: 2,
    range: 45,
    attackCooldown: 1200,
    spawnCooldown: 15000,
    unlockLevel: 4,
    description: 'Elite defensive personnel. Solid stats across the board.'
  },
  {
    id: 'engineer',
    name: 'Lead Dev',
    icon: 'fas fa-laptop-code',
    cost: 950,
    hp: 600,
    damage: 250,
    speed: 3,
    range: 400,
    attackCooldown: 2500,
    spawnCooldown: 25000,
    unlockLevel: 5,
    description: 'Long-range specialist. Delivers massive critical updates from afar.'
  },
  {
    id: 'ceo',
    name: 'The CEO',
    icon: 'fas fa-user-tie',
    cost: 3000,
    hp: 6500,
    damage: 750,
    speed: 1.2,
    range: 150,
    attackCooldown: 3500,
    spawnCooldown: 60000,
    unlockLevel: 5,
    description: 'Corporate God. Immense health and world-ending damage.'
  }
];

export const ENEMY_UNITS: UnitType[] = [
  {
    id: 'e_battler',
    name: 'Battler',
    icon: 'custom-battler',
    cost: 80,
    hp: 170,
    damage: 18,
    speed: 3.5,
    range: 40,
    attackCooldown: 1010,
    spawnCooldown: 3000,
    unlockLevel: 0,
    description: 'A standard human combatant with a distinct red, blue, and yellow uniform.'
  },
  {
    id: 'e_double_puncher',
    name: 'Double Puncher Battler',
    icon: 'custom-battler-heavy',
    cost: 150,
    hp: 225,
    damage: 36,
    speed: 2.5,
    range: 40,
    attackCooldown: 1500,
    spawnCooldown: 6000,
    unlockLevel: 0,
    description: 'Elite combatant capable of devastating double strikes.'
  },
  {
    id: 'e_builder',
    name: 'Builder Enemy',
    icon: 'custom-builder',
    cost: 120,
    hp: 120,
    damage: 3,
    speed: 2,
    range: 60,
    attackCooldown: 3000,
    spawnCooldown: 18000,
    unlockLevel: 0,
    description: 'A unit that constructs stationary walls every 30s to halt your progress.'
  },
  {
    id: 'e_pistoler',
    name: 'Enemy Pistoler',
    icon: 'fas fa-gun',
    cost: 200,
    hp: 230,
    damage: 38,
    speed: 5.5,
    range: 350,
    attackCooldown: 1250,
    spawnCooldown: 4000,
    unlockLevel: 0,
    description: 'Corporate shooter with a quick trigger finger. Fires high-velocity rounds from long distance.'
  },
  {
    id: 'e_rage_battler',
    name: 'Rage Battler',
    icon: 'custom-battler-rage',
    cost: 100,
    hp: 275,
    damage: 23,
    speed: 6,
    range: 45,
    attackCooldown: 500,
    spawnCooldown: 1500,
    unlockLevel: 0,
    description: 'An extremely stressed employee. Below 25% health, his rage fuels even faster strikes.'
  },
  {
    id: 'e_wall',
    name: 'The Wall',
    icon: 'fas fa-square-full',
    cost: 0,
    hp: 300,
    damage: 0,
    speed: 0,
    range: 0,
    attackCooldown: 999999,
    spawnCooldown: 0,
    unlockLevel: 0,
    description: 'A stationary defensive barrier.'
  }
];
