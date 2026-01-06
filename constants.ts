
import { UnitType } from './types';

export const GAME_VERSION = '1.7.3'; // Boss Reward Patch

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
export const UNIT_UPGRADE_COST_MULTIPLIER = 1.25;
export const STAT_GAIN_PER_LEVEL = 0.20;

// New Upgrade: Startup Capital
export const STARTING_BUDGET_GAIN_PER_LEVEL = 55;
export const STARTING_BUDGET_UPGRADE_BASE_COST = 150;
export const STARTING_BUDGET_UPGRADE_COST_MULTIPLIER = 1.35; 

export const BANK_UPGRADE_BASE_COST = 100;
export const BANK_UPGRADE_COST_MULTIPLIER = 1.30; 
export const BASE_BANK_INCOME_PER_TICK = 0.75; 
export const BANK_INCOME_GAIN_PER_LEVEL = 0.50; 

export const CANNON_COOLDOWN = 30000;
export const CANNON_BASE_DAMAGE = 50;
export const CANNON_DAMAGE_PER_LEVEL = 50;
export const CANNON_MAX_LEVEL = 10;
export const CANNON_UPGRADE_BASE_COST = 500;

export const REWARD_PER_STAGE = 225; 
export const FIRST_CLEAR_MULTIPLIER = 3.25;
export const BOSS_CLEAR_MULTIPLIER = 5.5; // New multiplier for boss stages

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
  { id: 10, name: "No Mercy!", subtitle: "The Shotgunner", icon: "fas fa-skull-crossbones", color: "from-slate-800 to-black", isBoss: true },
  { id: 11, name: "Fourth Puncher", subtitle: "Productivity Hack", icon: "fas fa-hands", color: "from-emerald-800 to-black" },
  { id: 12, name: "Puncher Bros", subtitle: "Synergy Strike Team", icon: "fas fa-handshake", color: "from-cyan-800 to-blue-950" },
  { id: 13, name: "Cake Thrower", subtitle: "Sweet Surprise", icon: "fas fa-birthday-cake", color: "from-pink-600 to-purple-900" },
  { id: 14, name: "Stunlocking", subtitle: "Infinite Crowd Control", icon: "fas fa-dizzy", color: "from-yellow-600 to-amber-950" },
  { id: 15, name: "All Hands Meeting", subtitle: "Total Synergy", icon: "fas fa-users-slash", color: "from-zinc-800 to-zinc-950", isBoss: true },
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
    hp: 966,
    damage: 6,
    speed: 1.5,
    range: 35,
    attackCooldown: 1500,
    spawnCooldown: 5750, 
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
      description: 'The ultimate wall. Moves at a glacial pace but refuses to budge.'
    }
  },
  {
    id: 'sworder',
    name: 'Legal Council',
    icon: 'fas fa-gavel',
    cost: 150,
    hp: 300,
    damage: 45,
    speed: 3.5,
    range: 45,
    attackCooldown: 800,
    spawnCooldown: 4000,
    unlockLevel: 3,
    description: 'High-damage melee unit. Slashes through red tape and competitors.',
    altForm: {
      name: 'Senior Partner',
      hp: 450,
      damage: 65,
      speed: 3,
      range: 50,
      attackCooldown: 900,
      cost: 250,
      description: 'Years of litigation have hardened them. High damage and decent health.'
    }
  },
  {
    id: 'pistoler',
    name: 'Sales Rep',
    icon: 'fas fa-bullhorn',
    cost: 175,
    hp: 200,
    damage: 25,
    speed: 2.5,
    range: 220,
    attackCooldown: 1200,
    spawnCooldown: 5000,
    unlockLevel: 4,
    description: 'Ranged attacker. Pepper enemies with high-volume calls.',
    altForm: {
      name: 'Account Exec',
      hp: 250,
      damage: 40,
      speed: 2.5,
      range: 250,
      attackCooldown: 1400,
      cost: 275,
      description: 'Armed with a customized presentation and a sharp tongue.'
    }
  },
  {
    id: 'guard',
    name: 'Compliance Officer',
    icon: 'fas fa-user-check',
    cost: 350,
    hp: 1200,
    damage: 15,
    speed: 1.2,
    range: 40,
    attackCooldown: 2000,
    spawnCooldown: 10000,
    unlockLevel: 6,
    description: 'Heavy armor unit. Slow but nearly indestructible.',
  },
  {
    id: 'engineer',
    name: 'Dev Ops',
    icon: 'fas fa-code',
    cost: 400,
    hp: 400,
    damage: 80,
    speed: 2,
    range: 180,
    attackCooldown: 3000,
    spawnCooldown: 15000,
    unlockLevel: 8,
    description: 'Burst damage specialist. Launches critical updates.',
  },
  {
    id: 'ceo',
    name: 'The Founder',
    icon: 'fas fa-crown',
    cost: 800,
    hp: 2500,
    damage: 150,
    speed: 1,
    range: 60,
    attackCooldown: 3500,
    spawnCooldown: 45000,
    unlockLevel: 10,
    description: 'The ultimate leadership asset. High impact, high cost.',
  }
];

export const ENEMY_UNITS: UnitType[] = [
  {
    id: 'e_battler',
    name: 'Office Drone',
    icon: 'fas fa-user-tie',
    cost: 40,
    hp: 120,
    damage: 12,
    speed: 3,
    range: 40,
    attackCooldown: 1200,
    spawnCooldown: 3000,
    description: 'A standard employee driven by coffee and despair.',
    unlockLevel: 1
  },
  {
    id: 'e_double_puncher',
    name: 'Middle Manager',
    icon: 'fas fa-user-friends',
    cost: 120,
    hp: 350,
    damage: 25,
    speed: 2,
    range: 45,
    attackCooldown: 1800,
    spawnCooldown: 6000,
    description: 'Double the hands, double the micromanagement.',
    unlockLevel: 2
  },
  {
    id: 'e_builder',
    name: 'Facility Manager',
    icon: 'fas fa-tools',
    cost: 150,
    hp: 400,
    damage: 5,
    speed: 1.2,
    range: 35,
    attackCooldown: 2000,
    spawnCooldown: 15000,
    description: 'Constructs physical barriers to progress.',
    unlockLevel: 3
  },
  {
    id: 'e_pistoler',
    name: 'Corporate Security',
    icon: 'fas fa-gun',
    cost: 180,
    hp: 200,
    damage: 30,
    speed: 2.5,
    range: 250,
    attackCooldown: 1500,
    spawnCooldown: 8000,
    description: 'Enforces policy from a safe distance.',
    unlockLevel: 4
  },
  {
    id: 'e_rage_battler',
    name: 'Burnout Victim',
    icon: 'fas fa-fire',
    cost: 250,
    hp: 500,
    damage: 40,
    speed: 4.5,
    range: 40,
    attackCooldown: 800,
    spawnCooldown: 10000,
    description: 'Has nothing left to lose. Aggression scales with damage.',
    unlockLevel: 5
  },
  {
    id: 'e_baller',
    name: 'Executive VP',
    icon: 'fas fa-basketball-ball',
    cost: 300,
    hp: 600,
    damage: 20,
    speed: 1.8,
    range: 60,
    attackCooldown: 2500,
    spawnCooldown: 12000,
    description: 'Knocks back anyone who questions the vision.',
    unlockLevel: 7
  },
  {
    id: 'e_fourth_puncher',
    name: 'Efficiency Consultant',
    icon: 'fas fa-hands',
    cost: 400,
    hp: 800,
    damage: 50,
    speed: 1.5,
    range: 50,
    attackCooldown: 2000,
    spawnCooldown: 15000,
    description: 'Four arms of pure synergy.',
    unlockLevel: 11
  },
  {
    id: 'e_cake_thrower',
    name: 'HR Celebrant',
    icon: 'fas fa-birthday-cake',
    cost: 350,
    hp: 450,
    damage: 30,
    speed: 2,
    range: 150,
    attackCooldown: 4000,
    spawnCooldown: 14000,
    description: 'Stuns units with forced birthday celebrations.',
    unlockLevel: 13
  },
  {
    id: 'e_boss_shotgunner',
    name: 'The Shareholder',
    icon: 'fas fa-skull-crossbones',
    cost: 1000,
    hp: 6563,
    damage: 100,
    speed: 0.8,
    range: 180,
    attackCooldown: 2500,
    spawnCooldown: 0,
    description: 'Demands quarterly growth at any cost. Multiphase threat.',
    unlockLevel: 10
  },
  {
    id: 'e_wall',
    name: 'Bureaucratic Wall',
    icon: 'fas fa-border-all',
    cost: 0,
    hp: 1500,
    damage: 0,
    speed: 0,
    range: 0,
    attackCooldown: 0,
    spawnCooldown: 0,
    description: 'A literal wall of paperwork.',
    unlockLevel: 3
  }
];
