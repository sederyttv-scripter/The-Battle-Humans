
export type Side = 'player' | 'enemy';
export type Screen = 'menu' | 'battle' | 'shop' | 'loadout' | 'stages' | 'almanac' | 'sandbox' | 'gacha';

export interface AltForm {
  name: string;
  hp: number;
  damage: number;
  speed: number;
  range: number;
  attackCooldown: number;
  cost: number;
  description: string;
}

export interface UnitType {
  id: string;
  name: string;
  icon: string;
  cost: number;
  hp: number;
  damage: number;
  speed: number;
  range: number;
  attackCooldown: number;
  spawnCooldown: number;
  description: string;
  unlockLevel: number;
  altForm?: AltForm;
}

export interface ActiveUnit {
  instanceId: number;
  typeId: string;
  side: Side;
  x: number;
  currentHp: number;
  lastAttackTime: number;
  lastAbilityTime?: number;
  isAltForm?: boolean;
  hasThrownShotgun?: boolean; // Specific for Shotgunner Boss
  hasSlammed?: boolean; // Specific for Shotgunner Boss Phase 3
  hasThrownCake?: boolean; // Specific for Cake Thrower
  stunnedUntil?: number; // Timestamp until which unit is stunned
  colaStacks?: number; // Specific for Cola Spray (Alt form) damage stacking
}

export interface GameState {
  screen: Screen;
  money: number; // Battle money
  coins: number; // Permanent coins
  diamonds: number; // Premium currency
  walletLevel: number;
  playerBaseHp: number;
  enemyBaseHp: number;
  units: ActiveUnit[];
  isGameOver: boolean;
  winner: Side | null;
  battleLog: string[];
  playerLevel: number;
  playerXP: number;
  unitLevels: Record<string, number>;
  preferredForms: Record<string, boolean>; // true if Alt form is selected
  loadout: string[];
  unlockedStages: number[];
  claimedBossStages: number[]; // Track which bosses have given diamonds
  currentStage: number;
  cannonLevel: number;
  bankLevel: number;
  startingBudgetLevel: number;
  baseHealthLevel: number; // New upgrade level for Player Base Health
  sandboxMode: boolean;
  sandboxPaused: boolean;
  pityCounter: number; // Tracks pulls since last Uber Rare
}
