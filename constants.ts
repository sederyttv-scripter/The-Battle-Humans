
import { UnitType } from './types';

export const GAME_VERSION = '1.7.1'; // Cooldown Adjustment Update

export const FIELD_WIDTH = 1000;
export const BASE_HP = 5000;
export const INITIAL_MONEY = 50; 
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

export const REWARD_PER_STAGE = 225; // Increased by 125
export const FIRST_CLEAR_MULTIPLIER = 3.25;

export const STAGE_CONFIG = [
  { id: 1, name: "Intern Orientation", subtitle: "The First Day", icon: "fas fa-id-card", color: "from-blue-600 to-blue-900" },
  { id: 2, name: "Coffee Run", subtitle: "Caffeine Emergency", icon: "fas fa-mug-hot", color: "from-amber-600 to-amber-900" },
  { id: 3, name: "Quarterly Review", subtitle: "Performance Metrics", icon: "fas fa-chart-line", color: "from-emerald-600 to-emerald-900" },
  { id: 4, name: "Severance Package", subtitle: "Aggressive Negotiations", icon: "fas fa-briefcase", color: "from-red-600 to-red-900" },
  { id: 5, name: "The Rage", subtitle: "Burnout Critical", icon: "fas fa-fire", color: "from-orange-600 to-orange-900" },
  { id: 6, name: "Meat Shield", subtitle: "Defensive Perimeter", icon: "fas fa-shield-virus", color: "from-slate-600 to-slate-900" },
  { id: 7, name: "Baller's Rise", subtitle: "Executive Takeover", icon: "fas fa-basketball-ball", color: "from-purple-600 to-purple-900" },
  { id: 8, name: "Bullet Hell", subtitle: "Infinite Barrage", icon: "fas fa-meteor", color: "from-red-900 to-slate-950" },
  { id: 9, name: "Nine of a Kinds", subtitle: "Total Chaos", icon: "fas fa-dice-d20", color: "from-fuchsia-600 to-fuchsia-900" },
  { id: 10, name: "No Mercy!", subtitle: "The Shotgunner", icon: "fas fa-skull-crossbones", color: "from-slate-800 to-black" },
  { id: 11, name: "Fourth Puncher", subtitle: "Productivity Hack", icon: "fas fa-hands", color: "from-emerald-800 to-black" },
  { id: 12, name: "Puncher Bros", subtitle: "Synergy Strike Team", icon: "fas fa-handshake", color: "from-cyan-800 to-blue-950" },
  { id: 13, name: "Cake Thrower", subtitle: "Sweet Surprise", icon: "fas fa-birthday-cake", color: "from-pink-600 to-purple-900" },
];

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
    spawnCooldown: 2000, // Unchanged
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
    hp: 966,
    damage: 6,
    speed: 1.5,
    range: 35,
    attackCooldown: 1500,
    spawnCooldown: 5750, // Increased by 15% (Base 5000 * 1.15)
    unlockLevel: 2,
    description: 'A dedicated damage sponge. Extremely low offensive capability but high survivability.',
    altForm: {
      name: 'Human Fortress',
      hp: 1369,
      damage: 6,
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
    hp: 362,
    damage: 24,
    speed: 5, 
    range: 55,
    attackCooldown: 1000,
    spawnCooldown: 6900, // Increased by 15% (Base 6000 * 1.15)
    unlockLevel: 3,
    description: 'Melee specialist wielding a corporate letter opener. High attack speed and solid damage.',
    altForm: {
      name: 'Blacksteel',
      hp: 362,
      damage: 72,
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
    hp: 185,
    damage: 31,
    speed: 1.9, 
    range: 350,
    attackCooldown: 1250,
    spawnCooldown: 4600, // Increased by 15% (Base 4000 * 1.15)
    unlockLevel: 4,
    description: 'Mid-range firearm specialist. Delivers consistent high-velocity damage from a distance.',
    altForm: {
      name: 'SMG Gunner',
      hp: 185,
      damage: 31,
      speed: 1.9, 
      range: 350,
      attackCooldown: 500,
      cost: 400,
      description: 'Trades budget for fire rate. Wields a submachine gun for rapid suppression.'
    }
  },
  {
    id: 'guard',
    name: 'Security',
    icon: 'fas fa-shield-halved',
    cost: 550,
    hp: 2013,
    damage: 40,
    speed: 2, 
    range: 45,
    attackCooldown: 1200,
    spawnCooldown: 17250, // Increased by 15% (Base 15000 * 1.15)
    unlockLevel: 4,
    description: 'Elite defensive personnel. Solid stats across the board.'
  },
  {
    id: 'engineer',
    name: 'Lead Dev',
    icon: 'fas fa-laptop-code',
    cost: 950,
    hp: 483,
    damage: 201,
    speed: 3, 
    range: 400,
    attackCooldown: 2500,
    spawnCooldown: 28750, // Increased by 15% (Base 25000 * 1.15)
    unlockLevel: 5,
    description: 'Long-range specialist. Delivers massive critical updates from afar.'
  },
  {
    id: 'ceo',
    name: 'The CEO',
    icon: 'fas fa-user-tie',
    cost: 3000,
    hp: 5233,
    damage: 604,
    speed: 1.2,
    range: 150,
    attackCooldown: 3500,
    spawnCooldown: 69000, // Increased by 15% (Base 60000 * 1.15)
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
    spawnCooldown: 3000, // Unchanged
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
    spawnCooldown: 6000, // Unchanged
    unlockLevel: 0,
    description: 'A heavy hitter with a 1-2 punch combo.'
  },
  {
    id: 'e_fourth_puncher',
    name: 'Fourth Puncher Battler',
    icon: 'custom-battler-heavy',
    cost: 350,
    hp: 550,
    damage: 72,
    speed: 2.5, 
    range: 40,
    attackCooldown: 1500,
    spawnCooldown: 9000, // Unchanged
    unlockLevel: 0,
    description: 'A multi-tasking monstrosity with two extra arms growing from its back.'
  },
  {
    id: 'e_pistoler',
    name: 'Enemy Pistoler',
    icon: 'fas fa-gun',
    cost: 200,
    hp: 230,
    damage: 38,
    speed: 1.8, 
    range: 350,
    attackCooldown: 1250,
    spawnCooldown: 4000, // Unchanged
    unlockLevel: 0,
    description: 'Provides ranged support for the enemy lines.'
  },
  {
    id: 'e_builder',
    name: 'Builder',
    icon: 'fas fa-hammer',
    cost: 300,
    hp: 400,
    damage: 10,
    speed: 2,
    range: 50,
    attackCooldown: 2000,
    spawnCooldown: 15000, // Unchanged
    unlockLevel: 0,
    description: 'A construction worker who builds defensive walls.'
  },
  {
    id: 'e_wall',
    name: 'Wall',
    icon: 'fas fa-square',
    cost: 10,
    hp: 335,
    damage: 0,
    speed: 0,
    range: 0,
    attackCooldown: 1000,
    spawnCooldown: 1000,
    unlockLevel: 0,
    description: 'A stationary wall built by Builders.'
  },
  {
    id: 'e_rage_battler',
    name: 'Rage Battler',
    icon: 'fas fa-angry',
    cost: 150,
    hp: 350,
    damage: 55,
    speed: 7, 
    range: 40,
    attackCooldown: 500,
    spawnCooldown: 5000, // Unchanged
    unlockLevel: 0,
    description: 'A furious combatant who attacks rapidly when provoked.'
  },
  {
    id: 'e_baller',
    name: 'Baller Battler',
    icon: 'fas fa-basketball-ball',
    cost: 250,
    hp: 230,
    damage: 40,
    speed: 1.8, 
    range: 400,
    attackCooldown: 3500,
    spawnCooldown: 8000, // Unchanged
    unlockLevel: 0,
    description: 'A stylish unit with extra range that knocks enemies back.'
  },
  {
    id: 'e_cake_thrower',
    name: 'Cake Thrower',
    icon: 'fas fa-birthday-cake',
    cost: 200,
    hp: 250,
    damage: 20,
    speed: 3, 
    range: 250,
    attackCooldown: 1000,
    spawnCooldown: 8000,
    unlockLevel: 0,
    description: 'Carries a massive cake. Throws it once to stun enemies for 3s, then fights with bare hands.'
  },
  {
    id: 'e_boss_shotgunner',
    name: 'Shotgunner (BOSS)',
    icon: 'fas fa-skull',
    cost: 9999,
    hp: 6563, 
    damage: 210, 
    speed: 0.8, 
    range: 200,
    attackCooldown: 2500,
    spawnCooldown: 60000, // Unchanged
    unlockLevel: 0,
    description: 'The Corporate Enforcer. Wields a shotgun and an attitude problem.'
  }
];
