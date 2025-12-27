
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GameState, ActiveUnit, Side, UnitType, Screen, AltForm } from './types';
import { 
  PLAYER_UNITS, 
  ENEMY_UNITS, 
  INITIAL_MONEY, 
  FIELD_WIDTH, 
  BASE_HP, 
  MONEY_TICK_INTERVAL, 
  GAME_TICK_INTERVAL, 
  WALLET_UPGRADE_COSTS, 
  MONEY_MULTIPLIER, 
  XP_PER_WIN,
  XP_TO_LEVEL,
  UNIT_UPGRADE_BASE_COST,
  UNIT_UPGRADE_COST_MULTIPLIER,
  STAT_GAIN_PER_LEVEL,
  CANNON_COOLDOWN,
  CANNON_BASE_DAMAGE,
  CANNON_DAMAGE_PER_LEVEL,
  CANNON_MAX_LEVEL,
  CANNON_UPGRADE_BASE_COST,
  BANK_UPGRADE_BASE_COST,
  BANK_UPGRADE_COST_MULTIPLIER,
  BASE_BANK_INCOME_PER_TICK,
  BANK_INCOME_GAIN_PER_LEVEL,
  REWARD_PER_STAGE,
  FIRST_CLEAR_MULTIPLIER,
  GAME_VERSION,
  STARTING_BUDGET_GAIN_PER_LEVEL,
  STARTING_BUDGET_UPGRADE_BASE_COST,
  STARTING_BUDGET_UPGRADE_COST_MULTIPLIER
} from './constants';
import { generateBattleCommentary } from './services/geminiService';
import { sounds } from './services/soundService';
import { GameAssistant } from './components/GameAssistant';

// --- Storage Helpers (Cookies) ---

const setCookie = (name: string, value: string, days: number = 365) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "; expires=" + date.toUTCString();
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
};

const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const deleteCookie = (name: string) => {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;';
};

const clearAllGameData = () => {
  const keys = [
    'bh_level', 'bh_xp', 'bh_coins', 'bh_unit_levels', 
    'bh_preferred_forms', 'bh_loadout', 'bh_stages', 
    'bh_cannon_level', 'bh_bank_level', 'bh_starting_budget_level', 'bh_version'
  ];
  keys.forEach(deleteCookie);
};

// --- Sub-components ---

const UnitCard: React.FC<{ 
  unit: UnitType, 
  money: number, 
  unitLevel: number,
  isAltPreferred: boolean,
  lastSpawnTime: number,
  onDeploy: (unitId: string) => void 
}> = ({ unit, money, unitLevel, isAltPreferred, lastSpawnTime, onDeploy }) => {
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  const timeSinceLastSpawn = now - lastSpawnTime;
  const isOffCooldown = timeSinceLastSpawn >= unit.spawnCooldown;
  const cooldownPercent = Math.min(100, (timeSinceLastSpawn / unit.spawnCooldown) * 100);
  
  const isAltActive = unitLevel >= 10 && !!unit.altForm && isAltPreferred;
  const stats = isAltActive ? unit.altForm! : unit;
  const canAfford = money >= stats.cost;
  const isDisabled = !canAfford || !isOffCooldown;

  return (
    <button 
      onClick={() => onDeploy(unit.id)}
      disabled={isDisabled}
      className={`relative w-20 h-28 flex flex-col items-center justify-between p-1.5 rounded-lg border-2 transition-all duration-150 overflow-hidden shrink-0 ${
        !isDisabled 
          ? 'bg-gray-800 border-yellow-500 hover:scale-105 active:scale-95 shadow-[0_0_10px_rgba(234,179,8,0.2)]' 
          : 'bg-gray-900 border-gray-700 opacity-60 grayscale cursor-not-allowed'
      }`}
    >
      {!isOffCooldown && (
        <div 
          className="absolute inset-0 bg-black/60 z-10 transition-all duration-100 ease-linear flex items-center justify-center font-black text-white text-[10px]"
          style={{ height: `${100 - cooldownPercent}%` }}
        >
        </div>
      )}
      
      <div className="text-2xl text-indigo-400 z-0">
        <BattlerVisual typeId={unit.id} isAltForm={isAltActive} />
      </div>
      <div className="text-[9px] font-bold uppercase tracking-tighter text-gray-300 w-full text-center truncate z-0">
        {isAltActive ? unit.altForm!.name : unit.name}
      </div>
      <div className="text-xs font-mono text-yellow-400 font-bold z-0">${stats.cost}</div>
      <div className={`absolute top-0 right-0 text-[8px] px-1 rounded-bl shadow-md border-b border-l z-20 ${unitLevel >= 10 ? 'bg-amber-500 border-amber-300 font-black' : 'bg-blue-600 border-blue-400'}`}>L{unitLevel}</div>
    </button>
  );
};

const BattlerVisual: React.FC<{ 
  typeId?: string,
  isHeavy?: boolean, 
  isAttacking?: boolean, 
  hasHat?: boolean,
  size?: 'sm' | 'md' | 'lg',
  lastAbilityTime?: number,
  isAltForm?: boolean,
  isAlmanac?: boolean
}> = ({ typeId, isHeavy, isAttacking, hasHat, size = 'md', lastAbilityTime, isAltForm, isAlmanac }) => {
  const scale = size === 'sm' ? 'scale-75' : size === 'lg' ? 'scale-125' : 'scale-100';
  const isAlly = typeId && !typeId.startsWith('e_');
  const now = Date.now();
  
  const isConstructing = typeId === 'e_builder' && lastAbilityTime && (now - lastAbilityTime < 1500);
  
  if (typeId === 'e_wall') {
    return (
      <div className={`w-14 h-16 bg-[#7c2d12] border-2 border-[#451a03] rounded shadow-2xl relative flex flex-col justify-evenly p-0.5 overflow-hidden ${scale}`}>
        <div className="flex gap-0.5 h-[20%]">
          <div className="flex-1 bg-[#9a3412] border-r border-[#451a03]"></div>
          <div className="flex-1 bg-[#9a3412]"></div>
        </div>
        <div className="flex gap-0.5 h-[20%]">
          <div className="w-1/3 bg-[#9a3412] border-r border-[#451a03]"></div>
          <div className="flex-1 bg-[#9a3412] border-r border-[#451a03]"></div>
          <div className="w-1/4 bg-[#9a3412]"></div>
        </div>
        <div className="flex gap-0.5 h-[20%]">
          <div className="flex-1 bg-[#9a3412] border-r border-[#451a03]"></div>
          <div className="flex-1 bg-[#9a3412]"></div>
        </div>
        <div className="flex gap-0.5 h-[20%]">
          <div className="w-1/4 bg-[#9a3412] border-r border-[#451a03]"></div>
          <div className="flex-1 bg-[#9a3412] border-r border-[#451a03] drop-shadow-sm"></div>
          <div className="w-1/3 bg-[#9a3412]"></div>
        </div>
        <div className="absolute inset-0 bg-black/5 pointer-events-none"></div>
      </div>
    );
  }

  const idleAnimationClass = useMemo(() => {
    if (!isAlmanac) return '';
    switch(typeId) {
      case 'e_battler': return 'animate-idle-sway';
      case 'e_rage_battler': return 'animate-idle-aggressive';
      case 'e_double_puncher': return 'animate-idle-aggressive';
      case 'e_builder': return 'animate-idle-fidget';
      case 'e_pistoler': return 'animate-idle-breathing';
      default: return 'animate-idle-gentle';
    }
  }, [typeId, isAlmanac]);

  const accessories = useMemo(() => {
    switch(typeId) {
      case 'baby': return (
        <>
          <div className="absolute -top-1 left-0 w-2 h-2 bg-pink-400 rounded-full shadow-sm"></div>
          {isAltForm && (
            <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 w-4 h-4 text-orange-200 z-10 flex flex-col items-center">
              <div className="w-1 h-2 bg-orange-300/50 rounded-full mb-[-2px]"></div>
              <div className="w-5 h-2.5 bg-orange-200/80 rounded-full border border-orange-300"></div>
            </div>
          )}
        </>
      );
      case 'tank': return (
        <>
          <div className={`absolute -left-3 top-2 w-4 h-8 ${isAltForm ? 'bg-slate-700' : 'bg-blue-900'} border border-blue-400 rounded-sm shadow-md`}></div>
          {isAltForm && (
            <div className="absolute -left-4 top-1 w-6 h-10 bg-slate-800/60 rounded border-2 border-slate-500 -z-10 shadow-lg"></div>
          )}
        </>
      );
      case 'sworder': return (
        <div className={`absolute -right-3 top-1 w-2 h-11 ${isAltForm ? 'bg-zinc-900' : 'bg-gray-200'} border ${isAltForm ? 'border-zinc-700 shadow-[0_0_5px_black]' : 'border-gray-400'} rounded-t-full transition-transform origin-bottom ${isAttacking ? 'rotate-90' : 'rotate-12'}`}></div>
      );
      case 'pistoler':
      case 'e_pistoler': return (
        <>
          <div className={`absolute -left-3 top-3 w-4 h-2 bg-zinc-800 rounded-sm shadow-sm transition-transform ${isAttacking ? 'translate-x-2' : ''}`}></div>
          <div className={`absolute -right-3 top-3 w-4 h-2 bg-zinc-800 rounded-sm shadow-sm transition-transform ${isAttacking ? '-translate-x-2' : ''}`}></div>
          {isAttacking && (
            <>
              <div className="absolute -left-8 top-3.5 w-3 h-1 bg-yellow-400/80 rounded-full animate-ping z-20"></div>
              <div className="absolute -right-8 top-3.5 w-3 h-1 bg-yellow-400/80 rounded-full animate-ping z-20"></div>
              <div className="absolute -left-6 top-3 w-4 h-4 bg-orange-500/20 blur-sm rounded-full animate-pulse"></div>
              <div className="absolute -right-6 top-3 w-4 h-4 bg-orange-500/20 blur-sm rounded-full animate-pulse"></div>
            </>
          )}
        </>
      );
      case 'guard': return (
        <>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-2.5 bg-blue-950 rounded-t-full border border-blue-400 z-10"></div>
          <div className="absolute -left-3.5 top-0 w-3.5 h-10 bg-slate-400 rounded-sm border border-slate-200 shadow-md"></div>
        </>
      );
      case 'engineer': return (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 rounded-full border border-cyan-800 animate-pulse shadow-[0_0_10px_cyan]"></div>
      );
      case 'ceo': return (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1.5 h-4 bg-black"></div>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-4 bg-slate-950 rounded-t-full shadow-lg"></div>
          <div className="absolute top-1 -right-2 w-2 h-2 bg-yellow-400 rounded-full animate-spin"></div>
        </>
      );
      case 'e_builder': return (
        <>
          <div className="absolute top-[4px] left-1/2 -translate-x-1/2 w-5 h-2.5 bg-orange-500 rounded-t-full z-10 border border-orange-700 shadow-sm"></div>
          {isConstructing && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-hammer-hit z-20">
              <i className="fas fa-hammer text-orange-400 text-2xl drop-shadow-lg"></i>
            </div>
          )}
        </>
      );
      case 'e_rage_battler': return (
        <div className="relative">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-600 rounded-full animate-ping opacity-75"></div>
          <div className="w-4 h-4 bg-red-800 rounded-sm mx-auto mb-[-1px] shadow-sm relative z-0"></div>
          <div className="flex items-center relative z-0">
            <div className={`w-2 h-6 bg-red-950 rounded-l-sm transition-transform ${isAttacking ? 'translate-x-1' : ''}`}></div>
            <div className="w-6 h-7 bg-red-600 shadow-inner border-x border-black/20"></div>
            <div className={`w-2 h-6 bg-red-950 rounded-r-sm transition-transform ${isAttacking ? '-translate-x-2 scale-x-150' : ''}`}></div>
          </div>
          <div className="flex justify-center gap-1 mt-[-1px] relative z-0">
            <div className="w-2.5 h-4 bg-black"></div>
            <div className="w-2.5 h-4 bg-black"></div>
          </div>
        </div>
      );
      default: return null;
    }
  }, [typeId, isAttacking, isConstructing, isAltForm]);

  return (
    <div className={`relative transition-transform duration-150 ${scale} ${isHeavy ? 'scale-125' : ''} ${isAttacking ? (isHeavy ? 'animate-double-punch' : 'animate-battler-lunge') : idleAnimationClass}`}>
      {accessories}
      {typeId !== 'e_rage_battler' && (
        <>
          <div className="w-4 h-4 bg-yellow-400 rounded-sm mx-auto mb-[-1px] shadow-sm relative z-0"></div>
          <div className="flex items-center relative z-0">
            <div className={`w-2 h-6 bg-blue-600 rounded-l-sm transition-transform ${isAttacking ? 'translate-x-1' : ''}`}></div>
            <div className={`w-6 h-7 ${isAltForm && typeId === 'sworder' ? 'bg-zinc-800' : isAlly ? 'bg-[#b91c1c]' : 'bg-[#dc2626]'} shadow-inner border-x border-black/10`}></div>
            <div className={`w-2 h-6 bg-blue-600 rounded-r-sm transition-transform ${isAttacking ? '-translate-x-2 scale-x-150' : ''}`}></div>
          </div>
          <div className="flex justify-center gap-1 mt-[-1px] relative z-0">
            <div className="w-2.5 h-4 bg-slate-800"></div>
            <div className="w-2.5 h-4 bg-slate-800"></div>
          </div>
        </>
      )}
    </div>
  );
};

const Battlefield: React.FC<{ 
  units: ActiveUnit[], 
  playerBaseHp: number, 
  enemyBaseHp: number, 
  maxBaseHp: number, 
  unitLevels: Record<string, number>, 
  cannonEffect: boolean, 
  currentStage: number, 
  isEnemyImmune: boolean 
}> = ({ units, playerBaseHp, enemyBaseHp, maxBaseHp, unitLevels, cannonEffect, currentStage, isEnemyImmune }) => {
  const playerBasePercent = Math.max(0, Math.min(100, (playerBaseHp / maxBaseHp) * 100));
  const enemyBasePercent = Math.max(0, Math.min(100, (enemyBaseHp / maxBaseHp) * 100));
  const now = Date.now();

  return (
    <div className={`relative w-full h-full min-h-[400px] bg-gradient-to-b from-[#0f172a] to-[#1e1b4b] border-b-[16px] border-gray-800 overflow-hidden shadow-2xl rounded-3xl border-x-4 border-t-4 border-gray-800/50 transition-colors duration-300 ${cannonEffect ? 'bg-red-900/40' : ''}`}>
      {cannonEffect && (
        <div className="absolute inset-0 bg-white/30 z-40 cannon-blast flex items-center justify-center pointer-events-none">
          <i className="fas fa-burst text-9xl text-orange-500 shadow-2xl"></i>
        </div>
      )}

      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.05)_0%,_transparent_70%)]"></div>

      <div className="absolute left-8 bottom-0 w-32 h-64 flex flex-col items-center justify-end z-10 pb-4">
        <div className="mb-4 flex flex-col items-center gap-1">
          <div className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] text-green-400 font-mono border border-green-500/30 font-bold">
            {Math.max(0, Math.ceil(playerBaseHp))} / {maxBaseHp}
          </div>
          <div className="w-24 h-2.5 bg-gray-900 rounded-full border border-white/10 overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-green-600 to-green-400" style={{ width: `${playerBasePercent}%` }} />
          </div>
        </div>
        <div className="text-8xl text-blue-500/40 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"><i className="fas fa-building"></i></div>
      </div>

      <div className="absolute right-8 bottom-0 w-32 h-64 flex flex-col items-center justify-end z-10 pb-4">
        <div className="mb-4 flex flex-col items-center gap-1">
          {isEnemyImmune && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 text-yellow-400 font-black text-[10px] animate-pulse bg-black/50 px-2 py-1 rounded whitespace-nowrap border border-yellow-500/30">
              SHIELD ACTIVE
            </div>
          )}
          <div className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] text-red-400 font-mono border border-red-500/30 font-bold">
            {Math.max(0, Math.ceil(enemyBaseHp))} / {maxBaseHp}
          </div>
          <div className="w-24 h-2.5 bg-gray-900 rounded-full border border-white/10 overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-l from-red-600 to-red-400" style={{ width: `${enemyBasePercent}%` }} />
          </div>
        </div>
        <div className={`text-8xl scale-x-[-1] drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] transition-all ${isEnemyImmune ? 'text-yellow-500/40' : 'text-red-500/40'}`}>
           <i className={isEnemyImmune ? "fas fa-shield-alt" : "fas fa-industry"}></i>
        </div>
      </div>

      {units.map((u) => {
        const type = (u.side === 'player' ? PLAYER_UNITS : ENEMY_UNITS).find(t => t.id === u.typeId);
        
        // --- FIX: Prevent crash if unit type is not found (e.g. invalid ID or old save data) ---
        if (!type) return null;

        const level = u.side === 'player' ? (unitLevels[u.typeId] || 1) : 1;
        
        let enemyScaling = 1.0;
        if (u.side === 'enemy' && u.typeId === 'e_battler' && currentStage === 1) {
          enemyScaling = 0.75;
        }
        
        const isAlt = u.side === 'player' && level >= 10 && !!type.altForm && u.isAltForm;
        const currentHpBase = (isAlt ? type.altForm!.hp : type.hp);
        const maxHp = currentHpBase * (u.side === 'player' ? (1 + (level - 1) * STAT_GAIN_PER_LEVEL) : enemyScaling);
        const hpPercent = Math.max(0, Math.min(100, (u.currentHp / maxHp) * 100));
        
        const isAttacking = now - u.lastAttackTime < 250;
        const sideScale = 1.0;
        const pos = (u.x / FIELD_WIDTH) * 100;

        return (
          <div key={u.instanceId} className={`absolute bottom-4 flex flex-col items-center transition-all duration-100 ease-linear z-20 ${isAttacking ? 'recoil' : ''}`} style={{ left: `${pos}%`, transform: `translateX(-50%) ${u.side === 'enemy' ? 'scaleX(-1)' : ''} scale(${sideScale})` }}>
            {isAttacking && u.typeId !== 'e_wall' && (
              <div className="absolute -top-12 text-white text-4xl slash-effect z-30 pointer-events-none">
                <i className={type.id === 'sworder' || type.id === 'e_pistoler' || type.id === 'pistoler' || type.id === 'e_rage_battler' ? 'fas fa-shield-slash text-white' : 'fas fa-bolt text-yellow-400'}></i>
              </div>
            )}
            
            <div className="w-12 h-2 bg-gray-900 rounded-full mb-2 overflow-hidden border border-white/10 shadow-sm">
               <div className={`h-full ${u.side === 'player' ? 'bg-green-400' : 'bg-red-400'}`} style={{ width: `${hpPercent}%` }} />
            </div>
            <div className={`filter drop-shadow-lg ${u.typeId !== 'e_wall' ? 'animate-bounce' : ''}`} style={{ animationDuration: `${0.8 / (type.speed || 1)}s` }}>
              <BattlerVisual 
                typeId={u.typeId} 
                isHeavy={type.icon?.includes('heavy')} 
                isAttacking={isAttacking} 
                hasHat={type.id === 'e_builder'} 
                lastAbilityTime={u.lastAbilityTime}
                isAltForm={u.isAltForm}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function App() {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [almanacType, setAlmanacType] = useState<'enemy' | 'ally'>('enemy');
  const [cannonReadyTime, setCannonReadyTime] = useState<number>(0);
  const [cannonEffectActive, setCannonEffectActive] = useState<boolean>(false);
  const [lastWinReward, setLastWinReward] = useState<{coins: number, isFirst: boolean} | null>(null);
  const [unitLastSpawnTimes, setUnitLastSpawnTimes] = useState<Record<string, number>>({});
  const [showSandboxPanel, setShowSandboxPanel] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>(() => {
    // Check version - if mismatch, wipe data immediately
    const savedVersion = getCookie('bh_version');
    if (savedVersion !== GAME_VERSION) {
      clearAllGameData();
    }

    const savedLevel = getCookie('bh_level');
    const savedXP = getCookie('bh_xp');
    const savedCoins = getCookie('bh_coins');
    const savedUnitLevels = getCookie('bh_unit_levels');
    const savedPreferredForms = getCookie('bh_preferred_forms');
    const savedLoadout = getCookie('bh_loadout');
    const savedStages = getCookie('bh_stages');
    const savedCannonLevel = getCookie('bh_cannon_level');
    const savedBankLevel = getCookie('bh_bank_level');
    const savedStartingBudgetLevel = getCookie('bh_starting_budget_level');
    
    return {
      screen: 'menu',
      money: INITIAL_MONEY,
      coins: savedCoins ? parseInt(savedCoins) : 0, 
      walletLevel: 0,
      playerBaseHp: 500,
      enemyBaseHp: 500,
      units: [],
      isGameOver: false,
      winner: null,
      battleLog: ["Welcome back, Administrator. Quota awaits."],
      playerLevel: savedLevel ? parseInt(savedLevel) : 1,
      playerXP: savedXP ? parseInt(savedXP) : 0,
      unitLevels: savedUnitLevels ? JSON.parse(savedUnitLevels) : { 'baby': 1 },
      preferredForms: savedPreferredForms ? JSON.parse(savedPreferredForms) : {},
      loadout: savedLoadout ? JSON.parse(savedLoadout) : ['baby'],
      unlockedStages: savedStages ? JSON.parse(savedStages) : [1],
      currentStage: 1,
      cannonLevel: savedCannonLevel ? parseInt(savedCannonLevel) : 1,
      bankLevel: savedBankLevel ? parseInt(savedBankLevel) : 1,
      startingBudgetLevel: savedStartingBudgetLevel ? parseInt(savedStartingBudgetLevel) : 1,
      sandboxMode: false,
      sandboxPaused: false
    };
  });

  useEffect(() => {
    setCookie('bh_version', GAME_VERSION);
    setCookie('bh_level', gameState.playerLevel.toString());
    setCookie('bh_xp', gameState.playerXP.toString());
    setCookie('bh_coins', gameState.coins.toString());
    setCookie('bh_unit_levels', JSON.stringify(gameState.unitLevels));
    setCookie('bh_preferred_forms', JSON.stringify(gameState.preferredForms));
    setCookie('bh_loadout', JSON.stringify(gameState.loadout));
    setCookie('bh_stages', JSON.stringify(gameState.unlockedStages));
    setCookie('bh_cannon_level', gameState.cannonLevel.toString());
    setCookie('bh_bank_level', gameState.bankLevel.toString());
    setCookie('bh_starting_budget_level', gameState.startingBudgetLevel.toString());
  }, [gameState.playerLevel, gameState.playerXP, gameState.coins, gameState.unitLevels, gameState.preferredForms, gameState.loadout, gameState.unlockedStages, gameState.cannonLevel, gameState.bankLevel, gameState.startingBudgetLevel]);

  // --- Theme Music Controller ---
  useEffect(() => {
    if (gameState.screen === 'battle' && !gameState.isGameOver) {
      sounds.startBattleTheme();
    } else {
      sounds.stopBattleTheme();
    }
    
    return () => {
      // Cleanup on unmount (though this app stays mounted mostly)
      if (gameState.screen !== 'battle') sounds.stopBattleTheme();
    };
  }, [gameState.screen, gameState.isGameOver]);

  const isUnitUnlocked = (unit: UnitType) => gameState.unlockedStages.includes(unit.unlockLevel);

  const getUpgradeCost = useCallback((unit: UnitType, level: number) => {
    let baseUpgradeCost = UNIT_UPGRADE_BASE_COST;
    
    // Baby Intern specific balancing - extremely cheap upgrades
    if (unit.id === 'baby') {
        baseUpgradeCost = 50; 
    } else if (unit.cost <= 100) {
        baseUpgradeCost = 100;
    } else if (unit.cost <= 250) {
        baseUpgradeCost = 150;
    }
    return Math.floor(baseUpgradeCost * Math.pow(UNIT_UPGRADE_COST_MULTIPLIER, level - 1));
  }, []);

  const getBankUpgradeCost = (level: number) => Math.floor(BANK_UPGRADE_BASE_COST * Math.pow(BANK_UPGRADE_COST_MULTIPLIER, level - 1));

  const nextInstanceId = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  const enemyMoneyRef = useRef(INITIAL_MONEY);
  const enemyCooldownsRef = useRef<Record<string, number>>({ 'e_battler': 0, 'e_double_puncher': 0, 'e_builder': 0, 'e_pistoler': 0, 'e_rage_battler': 0 });
  const battleStartTimeRef = useRef(0);

  const deployUnit = useCallback((side: Side, typeId: string, spawnX?: number) => {
    const type = (side === 'player' ? PLAYER_UNITS : ENEMY_UNITS).find(t => t.id === typeId);
    if (!type) return;

    if (side === 'player') {
      const lastSpawn = unitLastSpawnTimes[typeId] || 0;
      const now = Date.now();
      if (now - lastSpawn < type.spawnCooldown) return;

      setGameState(prev => {
        const level = prev.unitLevels[typeId] || 1;
        const isAltPreference = prev.preferredForms[typeId] ?? true;
        const isAltAvailable = level >= 10 && !!type.altForm;
        const isAlt = isAltAvailable && isAltPreference;
        const stats = isAlt ? type.altForm! : type;
        
        if (prev.money < stats.cost) return prev;
        sounds.playDeploy();
        setUnitLastSpawnTimes(prevTimes => ({ ...prevTimes, [typeId]: now }));
        const actualHp = stats.hp * (1 + (level - 1) * STAT_GAIN_PER_LEVEL);
        return { 
          ...prev, 
          money: prev.money - stats.cost, 
          units: [...prev.units, {
            instanceId: nextInstanceId.current++,
            typeId, side, x: spawnX ?? 0, currentHp: actualHp, lastAttackTime: 0, lastAbilityTime: 0,
            isAltForm: isAlt
          }] 
        };
      });
    } else {
      setGameState(prev => {
        let hpScaling = 1.0;
        if (typeId === 'e_battler' && prev.currentStage === 1) {
          hpScaling = 0.75;
        }
        
        return {
          ...prev,
          units: [...prev.units, {
            instanceId: nextInstanceId.current++,
            typeId, side, x: spawnX ?? FIELD_WIDTH, currentHp: type.hp * hpScaling, lastAttackTime: 0, lastAbilityTime: 0
          }]
        };
      });
    }
  }, [unitLastSpawnTimes]);

  const deploySandboxUnit = useCallback((typeId: string, side: Side) => {
    const type = (side === 'player' ? PLAYER_UNITS : ENEMY_UNITS).find(t => t.id === typeId);
    if (!type) return;
    
    setGameState(prev => {
       const level = side === 'player' ? (prev.unitLevels[typeId] || 1) : 1;
       const isAlt = side === 'player' && level >= 10 && !!type.altForm && (prev.preferredForms[typeId] ?? true);
       const stats = isAlt && type.altForm ? type.altForm : type;
       const actualHp = side === 'player' ? stats.hp * (1 + (level - 1) * STAT_GAIN_PER_LEVEL) : stats.hp;

       return {
         ...prev,
         units: [...prev.units, {
           instanceId: nextInstanceId.current++,
           typeId,
           side,
           x: side === 'player' ? 0 : FIELD_WIDTH,
           currentHp: actualHp,
           lastAttackTime: 0,
           lastAbilityTime: 0,
           isAltForm: isAlt
         }]
       };
    });
    sounds.playDeploy();
  }, []);

  const toggleForm = (unitId: string) => {
    setGameState(prev => ({
      ...prev,
      preferredForms: {
        ...prev.preferredForms,
        [unitId]: !(prev.preferredForms[unitId] ?? true)
      }
    }));
    sounds.playUpgrade();
  };

  const upgradeUnit = (id: string) => {
    const unit = PLAYER_UNITS.find(u => u.id === id);
    if (!unit) return;
    const level = gameState.unitLevels[id] || 1;
    if (level >= 10) return; 
    const cost = getUpgradeCost(unit, level);
    if (gameState.coins >= cost) {
      sounds.playUpgrade();
      setGameState(prev => ({ ...prev, coins: prev.coins - cost, unitLevels: { ...prev.unitLevels, [id]: level + 1 } }));
    }
  };

  const startBattle = useCallback((stage: number, isSandbox: boolean = false) => {
    const maxHp = 500 + (stage - 1) * 1000;
    sounds.playClick();
    setGameState(prev => {
      const initialMoney = INITIAL_MONEY + (prev.startingBudgetLevel - 1) * STARTING_BUDGET_GAIN_PER_LEVEL;
      return {
        ...prev,
        screen: 'battle',
        currentStage: stage,
        money: initialMoney,
        walletLevel: 0, // Reset wallet level on new battle
        playerBaseHp: maxHp,
        enemyBaseHp: maxHp,
        units: [],
        isGameOver: false,
        winner: null,
        battleLog: [`Stage ${stage} initiated. Deployment authorized.`],
        sandboxMode: isSandbox,
        sandboxPaused: false
      };
    });
    setCannonReadyTime(0);
    setUnitLastSpawnTimes({});
    battleStartTimeRef.current = Date.now();
    enemyMoneyRef.current = INITIAL_MONEY;
    enemyCooldownsRef.current = { 'e_battler': 0, 'e_double_puncher': 0, 'e_builder': 0, 'e_pistoler': 0, 'e_rage_battler': 0 };
    setShowSandboxPanel(isSandbox); // Auto open panel in sandbox
  }, []);

  const exitToMenu = useCallback(() => {
    sounds.playClick();
    setGameState(prev => ({ ...prev, screen: 'menu', units: [], isGameOver: false, winner: null, sandboxMode: false, sandboxPaused: false }));
  }, []);

  const upgradeWallet = useCallback(() => {
    const cost = WALLET_UPGRADE_COSTS[gameState.walletLevel];
    if (gameState.walletLevel >= WALLET_UPGRADE_COSTS.length - 1 || gameState.money < cost) return;

    sounds.playUpgrade();
    setGameState(prev => ({
      ...prev,
      money: prev.money - cost,
      walletLevel: prev.walletLevel + 1
    }));
  }, [gameState.walletLevel, gameState.money]);

  const fireCannon = useCallback(async () => {
    const now = Date.now();
    if (now < cannonReadyTime) return;

    sounds.playBaseHit();
    setCannonEffectActive(true);
    
    const damage = CANNON_BASE_DAMAGE + (gameState.cannonLevel - 1) * CANNON_DAMAGE_PER_LEVEL;
    
    setGameState(prev => {
      const newUnits = prev.units.map(u => {
        if (u.side === 'enemy') {
          return { ...u, currentHp: u.currentHp - damage };
        }
        return u;
      }).filter(u => u.currentHp > 0);

      return {
        ...prev,
        units: newUnits,
        enemyBaseHp: Math.max(0, prev.enemyBaseHp - (damage * 0.5)),
        battleLog: ["Orbital budget reconciliation complete.", ...prev.battleLog].slice(0, 10)
      };
    });

    setCannonReadyTime(now + CANNON_COOLDOWN);
    setTimeout(() => setCannonEffectActive(false), 500);

    try {
      const commentary = await generateBattleCommentary("The player fired the corporate cannon.");
      setGameState(prev => ({
        ...prev,
        battleLog: [commentary, ...prev.battleLog].slice(0, 10)
      }));
    } catch (e) {
      console.error(e);
    }
  }, [cannonReadyTime, gameState.cannonLevel]);

  useEffect(() => {
    if (gameState.screen !== 'battle' || gameState.isGameOver) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastUpdateRef.current;
      lastUpdateRef.current = now;
      const timeElapsed = now - battleStartTimeRef.current;
      
      setGameState(prev => {
        if (prev.isGameOver) return prev;
        
        // Income Logic: (Base Bank + Gains) * Wallet Multiplier
        const baseIncomePerTick = BASE_BANK_INCOME_PER_TICK + (prev.bankLevel - 1) * BANK_INCOME_GAIN_PER_LEVEL;
        const totalIncomeRatePerTick = baseIncomePerTick * MONEY_MULTIPLIER[prev.walletLevel];
        
        let newMoney = Math.min(prev.money + (totalIncomeRatePerTick * (delta / MONEY_TICK_INTERVAL)), 999999);
        
        // Enemy income scaling with stage
        const enemyIncomeBase = 1.0 + (prev.currentStage * 1.0);
        enemyMoneyRef.current += (enemyIncomeBase * (delta / MONEY_TICK_INTERVAL));
        
        Object.keys(enemyCooldownsRef.current).forEach(k => enemyCooldownsRef.current[k] = Math.max(0, enemyCooldownsRef.current[k] - delta));
        
        let unitToSpawn = null;
        
        // --- SPAWN LOGIC START (Blocked for first 5 seconds) ---
        // Only run spawn logic if NOT PAUSED
        if (timeElapsed > 5000 && !prev.sandboxPaused) {
          // STAGE 6 LOGIC: MeatShielding
          if (prev.currentStage === 6) {
            const maxHp = 500 + (prev.currentStage - 1) * 1000;
            const isBaseLow = prev.enemyBaseHp < maxHp * 0.8;
            
            if (enemyCooldownsRef.current['e_battler'] === 0 && enemyMoneyRef.current >= 80) {
              unitToSpawn = 'e_battler'; 
              enemyCooldownsRef.current['e_battler'] = 1500;
            } else if (enemyCooldownsRef.current['e_double_puncher'] === 0 && enemyMoneyRef.current >= 150) {
              unitToSpawn = 'e_double_puncher';
              enemyCooldownsRef.current['e_double_puncher'] = 4500;
            } else if ((timeElapsed > 30000 || isBaseLow) && enemyCooldownsRef.current['e_pistoler'] === 0 && enemyMoneyRef.current >= 200) {
              unitToSpawn = 'e_pistoler';
              enemyCooldownsRef.current['e_pistoler'] = 8000;
            }
          } else if (prev.currentStage === 5) {
            const chance = Math.random();
            // NERFED: Chance 0.3 -> 0.12, Cooldown 1500 -> 3500
            if (chance < 0.12 && enemyCooldownsRef.current['e_rage_battler'] === 0 && enemyMoneyRef.current >= 100) {
              unitToSpawn = 'e_rage_battler'; enemyCooldownsRef.current['e_rage_battler'] = 3500;
            }
          } else {
            if (prev.currentStage >= 3 && prev.currentStage <= 5) {
              const chance = Math.random();
              if (chance < 0.15 && enemyCooldownsRef.current['e_builder'] === 0 && enemyMoneyRef.current >= 120) {
                  unitToSpawn = 'e_builder'; enemyCooldownsRef.current['e_builder'] = 18000;
              }
            }
            if (!unitToSpawn && prev.currentStage >= 4 && prev.currentStage <= 5) {
              const chance = Math.random();
              if (chance < 0.1 && enemyCooldownsRef.current['e_pistoler'] === 0 && enemyMoneyRef.current >= 200) {
                  unitToSpawn = 'e_pistoler'; enemyCooldownsRef.current['e_pistoler'] = 12000;
              }
            }
            if (!unitToSpawn) {
              if (prev.currentStage === 2) {
                // Nerfed Stage 2: Slower spawn rates for Double Puncher intro
                const chance = Math.random();
                if (chance < 0.15 && enemyCooldownsRef.current['e_double_puncher'] === 0 && enemyMoneyRef.current >= 150) {
                  unitToSpawn = 'e_double_puncher'; enemyCooldownsRef.current['e_double_puncher'] = 10000; // Increased from 6s to 10s for Stage 2
                } else if (chance < 0.35 && enemyCooldownsRef.current['e_battler'] === 0 && enemyMoneyRef.current >= 80) {
                  unitToSpawn = 'e_battler'; enemyCooldownsRef.current['e_battler'] = 5000; // Increased from 3s to 5s for Stage 2
                }
              } else if (prev.currentStage >= 3) {
                const chance = Math.random();
                if (chance < 0.15 && enemyCooldownsRef.current['e_double_puncher'] === 0 && enemyMoneyRef.current >= 150) {
                  unitToSpawn = 'e_double_puncher'; enemyCooldownsRef.current['e_double_puncher'] = 6000;
                } else if (chance < 0.4 && enemyCooldownsRef.current['e_battler'] === 0 && enemyMoneyRef.current >= 80) {
                  unitToSpawn = 'e_battler'; enemyCooldownsRef.current['e_battler'] = 3000;
                }
              } else if (prev.currentStage === 1) {
                const chance = Math.random();
                // Reduced spawn chance and significantly increased cooldown for the first tutorial stage.
                if (chance < 0.25 && enemyCooldownsRef.current['e_battler'] === 0 && enemyMoneyRef.current >= 80) {
                  unitToSpawn = 'e_battler';
                  enemyCooldownsRef.current['e_battler'] = 8000; // Increased from 3000ms
                }
              }
            }
          }

          if (unitToSpawn) {
            enemyMoneyRef.current -= ENEMY_UNITS.find(e => e.id === unitToSpawn)!.cost;
            setTimeout(() => deployUnit('enemy', unitToSpawn), 0);
          }
        }
        // --- SPAWN LOGIC END ---

        const newUnits = [...prev.units.map(u => ({ ...u }))];
        let pDmg = 0; let eDmg = 0;
        const pendingUnits: ActiveUnit[] = [];
        for (let u of newUnits) {
          const type = (u.side === 'player' ? PLAYER_UNITS : ENEMY_UNITS).find(t => t.id === u.typeId)!;
          const level = u.side === 'player' ? (prev.unitLevels[u.typeId] || 1) : 1;
          const isAlt = u.side === 'player' && level >= 10 && !!type.altForm && u.isAltForm;
          const stats = isAlt ? type.altForm! : type;
          
          let effectiveAttackCooldown = stats.attackCooldown;
          if (u.typeId === 'e_rage_battler') {
            if (u.currentHp < type.hp * 0.25) {
              effectiveAttackCooldown = 300;
            }
          }

          let enemyDamageScaling = 1.0;
          if (u.side === 'enemy' && u.typeId === 'e_battler' && prev.currentStage === 1) {
            enemyDamageScaling = 0.75;
          }
          
          const actualDmg = stats.damage * (u.side === 'player' ? (1 + (level - 1) * STAT_GAIN_PER_LEVEL) : enemyDamageScaling);
          if (u.typeId === 'e_wall') continue;
          
          const distToBase = u.side === 'player' ? FIELD_WIDTH - u.x : u.x;
          
          // FIX: Find all targets in range first
          const possibleTargets = newUnits.filter(other => other.side !== u.side && Math.abs(u.x - other.x) <= stats.range);
          
          let target: ActiveUnit | undefined;
          
          if (possibleTargets.length > 0) {
            // FIX: Priority Logic - Enemies prioritize Human Tank ('tank')
            if (u.side === 'enemy') {
                const tank = possibleTargets.find(t => t.typeId === 'tank');
                target = tank || possibleTargets[0];
            } else {
                target = possibleTargets[0];
            }
          }
          
          // FIX: Check target existence BEFORE checking base distance
          // This ensures units "block" the base even if the base is technically in range
          if (target) {
            if (now - u.lastAttackTime > effectiveAttackCooldown) {
              u.lastAttackTime = now; sounds.playAttack();
              target.currentHp -= actualDmg;
              if (u.typeId === 'e_builder' && (now - (u.lastAbilityTime || 0) >= 30000)) {
                u.lastAbilityTime = now;
                const wallType = ENEMY_UNITS.find(e => e.id === 'e_wall')!;
                pendingUnits.push({ instanceId: nextInstanceId.current++, typeId: 'e_wall', side: 'enemy', x: Math.max(0, u.x - 35), currentHp: wallType.hp, lastAttackTime: 0, lastAbilityTime: 0 });
              }
            }
          } else if (distToBase <= stats.range) {
            if (now - u.lastAttackTime > effectiveAttackCooldown) {
              u.lastAttackTime = now; 
              if (u.side === 'player') {
                // Check Enemy Immunity (5s)
                if (timeElapsed > 5000) {
                   eDmg += actualDmg;
                   sounds.playBaseHit();
                } else {
                   // Hit immune base
                }
              } else {
                pDmg += actualDmg;
                sounds.playBaseHit();
              }
            }
          } else {
            u.x += (u.side === 'player' ? 1 : -1) * stats.speed;
            u.x = Math.max(0, Math.min(FIELD_WIDTH, u.x));
          }
        }
        const filtered = [...newUnits, ...pendingUnits].filter(u => u.currentHp > 0);
        const fPHp = Math.max(0, prev.playerBaseHp - pDmg);
        const fEHp = Math.max(0, prev.enemyBaseHp - eDmg);
        let over = false; let win: Side | null = null;
        let xp = prev.playerXP; let plvl = prev.playerLevel;
        let stages = [...prev.unlockedStages]; let newCoins = prev.coins;
        if (fPHp <= 0) { over = true; win = 'enemy'; sounds.playLoss(); }
        else if (fEHp <= 0) {
          over = true; win = 'player'; sounds.playWin();
          // NO REWARDS IN SANDBOX MODE
          if (!prev.sandboxMode) {
             xp += XP_PER_WIN; if (xp >= XP_TO_LEVEL(plvl)) { xp -= XP_TO_LEVEL(plvl); plvl++; }
             const isFirst = !prev.unlockedStages.includes(prev.currentStage + 1);
             const reward = Math.floor(prev.currentStage * REWARD_PER_STAGE * (isFirst ? FIRST_CLEAR_MULTIPLIER : 1));
             newCoins += reward; setLastWinReward({ coins: reward, isFirst });
             if (!stages.includes(prev.currentStage + 1) && prev.currentStage + 1 <= 6) stages.push(prev.currentStage + 1);
          } else {
             setLastWinReward({ coins: 0, isFirst: false });
          }
        }
        return { ...prev, money: newMoney, coins: newCoins, units: filtered, playerBaseHp: fPHp, enemyBaseHp: fEHp, isGameOver: over, winner: win, playerXP: xp, playerLevel: plvl, unlockedStages: stages };
      });
    }, GAME_TICK_INTERVAL);
    return () => clearInterval(interval);
  }, [gameState.screen, gameState.isGameOver, deployUnit]);

  const renderUnitDetail = (unitId: string | null) => {
    if (unitId === 'starting_budget_upgrade') {
      const level = gameState.startingBudgetLevel;
      const cost = Math.floor(STARTING_BUDGET_UPGRADE_BASE_COST * Math.pow(STARTING_BUDGET_UPGRADE_COST_MULTIPLIER, level - 1));
      const currentBudget = INITIAL_MONEY + (level - 1) * STARTING_BUDGET_GAIN_PER_LEVEL;
      return (
        <div className="flex-1 flex flex-col bg-slate-900/80 backdrop-blur-xl p-6 border-l border-white/10 shadow-2xl h-full">
          <div className="flex items-center gap-6 mb-8">
            <div className="text-5xl text-yellow-400 bg-yellow-950/30 p-5 rounded-2xl border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.2)]"><i className="fas fa-briefcase-medical"></i></div>
            <div>
              <h3 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-600">STARTUP CAPITAL</h3>
              <div className="bg-yellow-900/40 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 border border-yellow-700/50 text-yellow-200">
                <span>Infrastructure</span>
                <span className="w-1 h-1 bg-yellow-500 rounded-full"></span>
                <span>Level {level}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 mb-8 relative overflow-hidden group">
            <div className="absolute inset-0 bg-yellow-500/5 group-hover:bg-yellow-500/10 transition-colors"></div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-2">Current Starting Budget</span>
            <span className="text-4xl font-mono text-white font-black tracking-tight">${currentBudget}</span>
          </div>

          <div className="mt-auto">
             <button onClick={() => { sounds.playUpgrade(); setGameState(p => ({ ...p, coins: p.coins - cost, startingBudgetLevel: p.startingBudgetLevel + 1 })); }} disabled={gameState.coins < cost} className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale transition-all shadow-lg hover:shadow-yellow-500/20">
               <i className="fas fa-arrow-up text-lg"></i> 
               <span>UPGRADE FOR ${cost}</span>
             </button>
          </div>
        </div>
      );
    }
    
    if (unitId === 'cannon_upgrade') {
      const cost = CANNON_UPGRADE_BASE_COST * gameState.cannonLevel;
      const curDmg = CANNON_BASE_DAMAGE + (gameState.cannonLevel - 1) * CANNON_DAMAGE_PER_LEVEL;
      return (
        <div className="flex-1 flex flex-col bg-slate-900/80 backdrop-blur-xl p-6 border-l border-white/10 shadow-2xl h-full">
          <div className="flex items-center gap-6 mb-8">
            <div className="text-5xl text-orange-400 bg-orange-950/30 p-5 rounded-2xl border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.2)]"><i className="fas fa-burst"></i></div>
            <div>
              <h3 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-orange-200 to-orange-600">CORP CANNON</h3>
              <div className="bg-orange-900/40 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 border border-orange-700/50 text-orange-200">
                <span>Defense System</span>
                <span className="w-1 h-1 bg-orange-500 rounded-full"></span>
                <span>Level {gameState.cannonLevel}</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 mb-8 relative overflow-hidden">
             <div className="absolute inset-0 bg-orange-500/5"></div>
             <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-2">Burst Damage Output</span>
             <span className="text-4xl font-mono text-white font-black tracking-tight">{curDmg}</span>
          </div>
          {gameState.cannonLevel < CANNON_MAX_LEVEL && (
             <div className="mt-auto">
                <button onClick={() => { sounds.playUpgrade(); setGameState(p => ({ ...p, coins: p.coins - cost, cannonLevel: p.cannonLevel + 1 })); }} disabled={gameState.coins < cost} className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale transition-all shadow-lg hover:shadow-orange-500/20">
                  <i className="fas fa-arrow-up text-lg"></i>
                  <span>UPGRADE FOR ${cost}</span>
                </button>
             </div>
          )}
        </div>
      );
    }
    if (unitId === 'bank_upgrade') {
      const cost = getBankUpgradeCost(gameState.bankLevel);
      const curIncome = (BASE_BANK_INCOME_PER_TICK + (gameState.bankLevel - 1) * BANK_INCOME_GAIN_PER_LEVEL) * 10;
      return (
        <div className="flex-1 flex flex-col bg-slate-900/80 backdrop-blur-xl p-6 border-l border-white/10 shadow-2xl h-full">
          <div className="flex items-center gap-6 mb-8">
            <div className="text-5xl text-green-400 bg-green-950/30 p-5 rounded-2xl border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]"><i className="fas fa-university"></i></div>
            <div>
              <h3 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-green-200 to-green-600">CORPORATE BANK</h3>
              <div className="bg-green-900/40 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 border border-green-700/50 text-green-200">
                <span>Economy</span>
                <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                <span>Level {gameState.bankLevel}</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-green-500/5"></div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-2">Base Income Rate</span>
            <span className="text-4xl font-mono text-white font-black tracking-tight">${curIncome.toFixed(1)} <span className="text-lg text-slate-500 font-bold">/ SEC</span></span>
          </div>
          <div className="mt-auto">
            <button onClick={() => { sounds.playUpgrade(); setGameState(p => ({ ...p, coins: p.coins - cost, bankLevel: p.bankLevel + 1 })); }} disabled={gameState.coins < cost} className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale transition-all shadow-lg hover:shadow-green-500/20">
              <i className="fas fa-arrow-up text-lg"></i>
              <span>UPGRADE FOR ${cost}</span>
            </button>
          </div>
        </div>
      );
    }
    
    // --- Default "No Selection" State ---
    if (!unitId) return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl border-l border-white/5 text-slate-600 h-full p-12">
        <div className="w-24 h-24 rounded-full border-4 border-dashed border-slate-700 flex items-center justify-center text-4xl mb-6 animate-pulse">
          <i className="fas fa-mouse-pointer"></i>
        </div>
        <h3 className="text-2xl font-black uppercase tracking-widest text-slate-500">Select an Asset</h3>
        <p className="text-sm font-medium text-slate-600 mt-2 text-center max-w-xs">Review specifications and authorize upgrades from the inventory list.</p>
      </div>
    );

    const unit = PLAYER_UNITS.find(u => u.id === unitId);
    if (!unit) return <div className="flex-1 flex items-center justify-center">Unit Not Found</div>;

    const level = gameState.unitLevels[unitId] || 1;
    const isUnlocked = isUnitUnlocked(unit);
    const nextLvlCost = getUpgradeCost(unit, level);
    const isAltPreferred = gameState.preferredForms[unitId] ?? true;
    const isAltAvailable = level >= 10 && !!unit.altForm;
    const isAlt = isAltAvailable && isAltPreferred;
    const stats = isAlt ? unit.altForm! : unit;
    
    const curHp = Math.floor(stats.hp * (1 + (level - 1) * STAT_GAIN_PER_LEVEL));
    const curDmg = Math.floor(stats.damage * (1 + (level - 1) * STAT_GAIN_PER_LEVEL));
    const isAtMaxLevel = level >= 10;

    return (
      <div className="flex-1 flex flex-col bg-slate-900/80 backdrop-blur-xl p-6 border-l border-white/10 shadow-2xl animate-in fade-in slide-in-from-right duration-300 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative group">
             <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg group-hover:bg-indigo-500/30 transition-all"></div>
             <div className="relative flex items-center justify-center w-28 h-28 bg-slate-800 rounded-2xl shadow-inner border border-white/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                <BattlerVisual typeId={unit.id} size="lg" isAltForm={isAlt} />
             </div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-400 leading-tight">
                  {isAlt ? unit.altForm!.name : unit.name}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                   <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${isAtMaxLevel ? 'bg-amber-900/40 border-amber-500/50 text-amber-200' : 'bg-indigo-900/40 border-indigo-500/50 text-indigo-200'}`}>
                      {isAtMaxLevel ? 'MAX LEVEL' : `LEVEL ${level}`}
                   </div>
                   {isUnlocked && <div className="px-2 py-1 rounded text-[10px] font-bold text-slate-400 bg-slate-800 border border-slate-700">CLASS: {unit.description.split('.')[0]}</div>}
                </div>
              </div>
              
              {isAltAvailable && (
                <button onClick={() => toggleForm(unitId)} className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:rotate-180 duration-500 border border-indigo-500/30 group" title="Toggle Alt Form">
                  <i className="fas fa-sync-alt text-lg group-hover:animate-spin-slow"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5 hover:bg-slate-800/60 transition-colors">
            <div className="flex justify-between items-start mb-1">
               <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Health Points</span>
               <i className="fas fa-heart text-green-500/50 text-xs"></i>
            </div>
            <span className="text-2xl font-mono text-green-400 font-bold">{curHp}</span>
          </div>
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5 hover:bg-slate-800/60 transition-colors">
            <div className="flex justify-between items-start mb-1">
               <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Attack Power</span>
               <i className="fas fa-fist-raised text-red-500/50 text-xs"></i>
            </div>
            <span className="text-2xl font-mono text-red-400 font-bold">{curDmg}</span>
          </div>
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5 hover:bg-slate-800/60 transition-colors">
            <div className="flex justify-between items-start mb-1">
               <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Attack Range</span>
               <i className="fas fa-ruler-horizontal text-blue-500/50 text-xs"></i>
            </div>
            <span className="text-2xl font-mono text-blue-400 font-bold">{stats.range}<span className="text-sm text-slate-500 ml-1">px</span></span>
          </div>
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5 hover:bg-slate-800/60 transition-colors">
            <div className="flex justify-between items-start mb-1">
               <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Reload Time</span>
               <i className="fas fa-stopwatch text-yellow-500/50 text-xs"></i>
            </div>
            <span className="text-2xl font-mono text-yellow-400 font-bold">{(stats.attackCooldown / 1000).toFixed(1)}<span className="text-sm text-slate-500 ml-1">s</span></span>
          </div>
        </div>

        {/* Description */}
        <div className="relative mb-8">
           <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/50 rounded-full"></div>
           <p className="text-slate-300 text-sm leading-relaxed italic pl-4 py-1">
             "{stats.description}"
           </p>
        </div>

        {/* Action Button */}
        <div className="mt-auto">
          {isUnlocked ? (
            gameState.screen === 'shop' && (
              <button 
                onClick={() => upgradeUnit(unitId)} 
                disabled={gameState.coins < nextLvlCost || isAtMaxLevel} 
                className={`w-full py-5 rounded-2xl font-black text-xl shadow-lg transition-all flex items-center justify-center gap-3 relative overflow-hidden group ${isAtMaxLevel ? 'bg-slate-800 opacity-50 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-[0.98]'}`}
              >
                {/* Shine Effect */}
                {!isAtMaxLevel && <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />}
                
                {isAtMaxLevel ? (
                  <><i className="fas fa-crown text-amber-400"></i> <span className="text-slate-400">MAXIMUM LEVEL</span></>
                ) : (
                  <><i className="fas fa-arrow-circle-up"></i> <span>UPGRADE: ${nextLvlCost}</span></>
                )}
              </button>
            )
          ) : (
            <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl flex items-center justify-center gap-3 text-red-400 font-bold uppercase tracking-widest text-xs">
              <i className="fas fa-lock"></i> Asset Locked
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEnemyDetail = (id: string | null) => {
    // Default State
    if (!id) return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl border-l border-white/5 text-slate-600 h-full p-12">
        <div className="w-24 h-24 rounded-full border-4 border-dashed border-slate-700 flex items-center justify-center text-4xl mb-6 animate-pulse">
          <i className="fas fa-search"></i>
        </div>
        <h3 className="text-2xl font-black uppercase tracking-widest text-slate-500">Select Entry</h3>
        <p className="text-sm font-medium text-slate-600 mt-2 text-center max-w-xs">Access classified data from the corporate database.</p>
      </div>
    );

    const isAlt = id.endsWith('_alt');
    const baseId = isAlt ? id.replace('_alt', '') : id;
    const unit = [...PLAYER_UNITS, ...ENEMY_UNITS].find(u => u.id === baseId);
    
    if (!unit) return <div className="flex-1 flex items-center justify-center">Data Not Found</div>;

    const stats = isAlt && unit.altForm ? unit.altForm : unit;
    const isEnemy = unit.id.startsWith('e_');
    const themeColor = isEnemy ? 'red' : 'indigo'; 

    return (
      <div className={`flex-1 flex flex-col bg-slate-900/80 backdrop-blur-xl p-6 border-l border-white/10 shadow-2xl animate-in fade-in slide-in-from-right duration-300 h-full overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center gap-6 mb-8">
           <div className="relative group">
             <div className={`absolute inset-0 bg-${themeColor}-500/20 rounded-2xl blur-lg transition-all`}></div>
             <div className={`relative flex items-center justify-center w-28 h-28 bg-slate-800 rounded-2xl shadow-inner border border-${themeColor}-500/30 overflow-hidden`}>
                <BattlerVisual typeId={baseId} size="lg" isAltForm={isAlt} isHeavy={unit.icon.includes('heavy')} hasHat={unit.id === 'e_builder'} isAlmanac={true} />
             </div>
          </div>
          
          <div className="flex-1">
            <h3 className={`text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r ${isEnemy ? 'from-red-400 to-orange-500' : 'from-blue-200 to-indigo-400'} leading-tight`}>
              {stats.name}
            </h3>
            <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 border ${isEnemy ? 'bg-red-900/40 border-red-500/50 text-red-200' : 'bg-indigo-900/40 border-indigo-500/50 text-indigo-200'}`}>
               {isAlt ? 'ALTERNATIVE FORM' : isEnemy ? 'HOSTILE ENTITY' : 'ALLIED UNIT'}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
           <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
             <div className="flex justify-between items-start mb-1">
               <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Health Points</span>
               <i className="fas fa-heart text-green-500/50 text-xs"></i>
            </div>
            <span className="text-2xl font-mono text-green-400 font-bold">{stats.hp}</span>
          </div>
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
             <div className="flex justify-between items-start mb-1">
               <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Attack Power</span>
               <i className="fas fa-fist-raised text-red-500/50 text-xs"></i>
            </div>
            <span className="text-2xl font-mono text-red-400 font-bold">{stats.damage}</span>
          </div>
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
             <div className="flex justify-between items-start mb-1">
               <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Speed</span>
               <i className="fas fa-running text-white/50 text-xs"></i>
            </div>
            <span className="text-2xl font-mono text-white font-bold">{stats.speed}</span>
          </div>
           <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
             <div className="flex justify-between items-start mb-1">
               <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Attack Range</span>
               <i className="fas fa-ruler-horizontal text-blue-500/50 text-xs"></i>
            </div>
            <span className="text-2xl font-mono text-blue-400 font-bold">{stats.range}<span className="text-sm text-slate-500 ml-1">px</span></span>
          </div>
        </div>
        
        {/* Description */}
         <div className="relative mb-8">
           <div className={`absolute left-0 top-0 bottom-0 w-1 bg-${themeColor}-500/50 rounded-full`}></div>
           <p className="text-slate-300 text-sm leading-relaxed italic pl-4 py-1">
             "{stats.description}"
           </p>
        </div>
      </div>
    );
  };

  const renderScreen = () => {
    // ... (rest of the renderScreen function is unchanged)
    switch (gameState.screen) {
      case 'menu':
        // ... (existing menu code)
        return (
          <div className="flex flex-col items-center justify-center h-full bg-[#020617] relative overflow-hidden font-sans selection:bg-indigo-500/30">
            
            {/* Animated Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-grid-pattern opacity-30 animate-pulse-slow"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/50 to-[#020617]"></div>
                <div className="absolute top-0 left-0 right-0 h-96 bg-indigo-900/20 blur-[100px] rounded-full mix-blend-screen opacity-50"></div>
            </div>

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-5xl px-6 flex flex-col items-center gap-12">
                
                {/* Title Section */}
                <div className="text-center flex flex-col items-center animate-in slide-in-from-top fade-in duration-1000">
                    <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-900/20 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-300 font-bold">System Online • v{GAME_VERSION}</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_30px_rgba(79,70,229,0.5)]">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">CORPORATE</span>
                        <br />
                        <span className="relative">
                            UPRISING
                            <svg className="absolute -bottom-2 w-full h-3 text-indigo-500" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
                        </span>
                    </h1>
                    <p className="mt-6 text-slate-400 text-sm md:text-base font-medium max-w-lg leading-relaxed">
                        Defend the office against the AI Singularity. Manage your budget, deploy assets, and secure the quarterly profits.
                    </p>
                </div>

                {/* Main Menu Grid */}
                <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-4 animate-in slide-in-from-bottom fade-in duration-1000 delay-200">
                    
                    {/* Primary Action: Battle */}
                    <button 
                        onClick={() => { sounds.playClick(); setGameState(p => ({ ...p, screen: 'stages' })); }}
                        className="group md:col-span-12 lg:col-span-6 h-40 md:h-56 relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 border-t border-indigo-400 shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-between p-8"
                    >
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
                        <div className="absolute right-[-20px] bottom-[-20px] text-9xl text-black/10 rotate-12 group-hover:rotate-0 transition-transform duration-500"><i className="fas fa-crosshairs"></i></div>
                        <div className="relative z-10 flex flex-col items-start text-left">
                            <span className="text-indigo-200 font-bold tracking-widest text-xs uppercase mb-2">Primary Objective</span>
                            <span className="text-4xl md:text-5xl font-black italic text-white mb-2">DEPLOY</span>
                            <span className="text-indigo-100 text-sm font-medium">Select Stage & Begin Operations</span>
                        </div>
                        <div className="relative z-10 w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center group-hover:bg-white/20 transition-colors">
                            <i className="fas fa-arrow-right text-2xl text-white group-hover:translate-x-1 transition-transform"></i>
                        </div>
                    </button>

                    {/* Secondary: Loadout */}
                    <button 
                        onClick={() => { sounds.playClick(); setGameState(p => ({ ...p, screen: 'loadout' })); }}
                        className="group md:col-span-6 lg:col-span-3 h-40 relative overflow-hidden rounded-3xl bg-slate-800 border border-slate-700 hover:border-slate-500 hover:bg-slate-750 transition-all hover:-translate-y-1 active:translate-y-0 shadow-xl flex flex-col justify-between p-6"
                    >
                        <div className="absolute top-4 right-4 text-4xl text-slate-700 group-hover:text-slate-600 transition-colors"><i className="fas fa-briefcase"></i></div>
                        <div>
                            <span className="text-slate-500 font-bold tracking-widest text-[10px] uppercase block mb-1">Management</span>
                            <span className="text-2xl font-black text-white">LOADOUT</span>
                        </div>
                        <div className="text-xs text-slate-400 group-hover:text-white transition-colors">Manage Team Composition &rarr;</div>
                    </button>

                    {/* Secondary: Shop */}
                    <button 
                        onClick={() => { sounds.playClick(); setGameState(p => ({ ...p, screen: 'shop' })); }}
                        className="group md:col-span-6 lg:col-span-3 h-40 relative overflow-hidden rounded-3xl bg-slate-800 border border-slate-700 hover:border-slate-500 hover:bg-slate-750 transition-all hover:-translate-y-1 active:translate-y-0 shadow-xl flex flex-col justify-between p-6"
                    >
                        <div className="absolute top-4 right-4 text-4xl text-slate-700 group-hover:text-slate-600 transition-colors"><i className="fas fa-shopping-cart"></i></div>
                        <div>
                            <span className="text-slate-500 font-bold tracking-widest text-[10px] uppercase block mb-1">Acquisitions</span>
                            <span className="text-2xl font-black text-white">UPGRADES</span>
                        </div>
                        <div className="text-xs text-slate-400 group-hover:text-white transition-colors">Spend Capital &rarr;</div>
                    </button>

                    {/* Tertiary Row */}
                    <div className="md:col-span-12 grid grid-cols-2 gap-4">
                        {/* Almanac */}
                        <button 
                            onClick={() => { sounds.playClick(); setGameState(p => ({ ...p, screen: 'almanac' })); }}
                            className="group h-24 rounded-2xl bg-slate-900/50 border border-slate-800 hover:bg-slate-800 hover:border-slate-600 transition-all flex items-center px-6 gap-4"
                        >
                            <div className="w-10 h-10 rounded-lg bg-blue-900/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform"><i className="fas fa-book"></i></div>
                            <div className="flex flex-col text-left">
                                <span className="font-bold text-white uppercase text-sm">Almanac</span>
                                <span className="text-[10px] text-slate-500 font-mono">Database Access</span>
                            </div>
                        </button>

                        {/* Sandbox */}
                        <button 
                            onClick={() => { sounds.playClick(); setGameState(p => ({ ...p, screen: 'sandbox' })); }}
                            className="group h-24 rounded-2xl bg-yellow-950/10 border border-yellow-900/30 hover:bg-yellow-900/20 hover:border-yellow-700 transition-all flex items-center px-6 gap-4"
                        >
                            <div className="w-10 h-10 rounded-lg bg-yellow-900/20 flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform"><i className="fas fa-flask"></i></div>
                            <div className="flex flex-col text-left">
                                <span className="font-bold text-yellow-500 uppercase text-sm">Sandbox</span>
                                <span className="text-[10px] text-yellow-700 font-mono">Simulation Mode</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Floating Stats */}
            <div className="absolute top-6 right-8 flex items-center gap-3 bg-slate-900/80 backdrop-blur border border-slate-700 py-2 px-4 rounded-xl shadow-lg animate-in slide-in-from-right fade-in duration-1000">
                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Available Funds</span>
                    <span className="text-xl font-mono text-yellow-400 font-black tracking-tight">${gameState.coins.toLocaleString()}</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 text-yellow-500">
                    <i className="fas fa-coins"></i>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-4 text-center w-full text-[10px] text-slate-600 font-mono uppercase tracking-widest">
                Protected by Gemini AI • Secure Connection Established
            </div>
          </div>
        );
      case 'stages':
      case 'sandbox':
        const isSandbox = gameState.screen === 'sandbox';
        return (
          <div className="flex flex-col h-full bg-[#0f172a] p-6 md:p-12 overflow-y-auto">
             <div className="flex justify-between items-center mb-8"><button onClick={() => exitToMenu()} className="bg-slate-800 px-6 py-3 rounded-xl hover:bg-slate-700 font-bold transition-colors">Menu</button><h2 className={`text-3xl font-black italic tracking-widest ${isSandbox ? 'text-yellow-500' : 'text-indigo-400'}`}>{isSandbox ? 'SANDBOX MODE' : 'WORLD MAP'}</h2><div className="flex flex-col items-end"><span className="text-[10px] text-slate-500 font-black uppercase">Savings</span><span className="text-2xl font-mono text-yellow-400 font-black">${gameState.coins}</span></div></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto w-full">
               {[1, 2, 3, 4, 5, 6].map(s => {
                 const isUnlocked = isSandbox || gameState.unlockedStages.includes(s); // Unlock all in sandbox
                 const isBeaten = gameState.unlockedStages.includes(s + 1);
                 return (
                    <button key={s} disabled={!isUnlocked} onClick={() => startBattle(s, isSandbox)} className={`relative h-48 rounded-3xl border-2 flex flex-col items-center justify-center transition-all ${isUnlocked ? (isSandbox ? 'bg-yellow-950/30 border-yellow-600 hover:scale-105 shadow-xl' : 'bg-slate-800 border-indigo-500 hover:scale-105 shadow-xl') : 'bg-black/40 border-slate-900 opacity-40 cursor-not-allowed'}`}><div className="text-[10px] uppercase font-black text-slate-500 mb-1">Stage 0{s}</div><div className="text-xl font-black italic mb-2 text-center px-4 leading-tight">{s === 1 ? 'THE FRONT DESK' : s === 2 ? 'OPEN OFFICE' : s === 3 ? 'CONSTRUCTION ZONE' : s === 4 ? 'HR LOCKDOWN' : s === 5 ? 'U mad Bro?' : 'MeatShielding'}</div><div className="text-3xl">{isUnlocked ? <i className="fas fa-map-marked-alt text-indigo-400"></i> : <i className="fas fa-lock text-slate-700"></i>}</div>{isBeaten && !isSandbox && <div className="absolute top-4 right-4 text-green-500"><i className="fas fa-check-circle"></i></div>}</button>
                 );
               })}
            </div>
          </div>
        );
      case 'almanac':
        return (
          <div className="flex flex-col h-full bg-[#020617] relative overflow-hidden">
             
             {/* Animated Background */}
             <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#020617] to-slate-950"></div>
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-900/10 blur-[150px] rounded-full"></div>
             </div>

             {/* Header */}
             <div className="relative z-10 flex justify-between items-center p-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                   <button onClick={() => exitToMenu()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800/50 border border-white/10 hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
                      <i className="fas fa-chevron-left"></i>
                   </button>
                   <div>
                      <h2 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 uppercase leading-none">
                        ALMANAC
                      </h2>
                      <p className="text-[10px] font-bold tracking-[0.3em] text-blue-400 uppercase mt-1">
                        Corporate Database
                      </p>
                   </div>
                </div>
                
                <div className="flex gap-2">
                    <button 
                      onClick={() => { sounds.playClick(); setAlmanacType('enemy'); setSelectedEnemyId(null); }} 
                      className={`px-6 py-2 rounded-xl font-black text-xs transition-all border ${almanacType === 'enemy' ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      <i className="fas fa-skull mr-2"></i> HOSTILES
                    </button>
                    <button 
                      onClick={() => { sounds.playClick(); setAlmanacType('ally'); setSelectedEnemyId(null); }} 
                      className={`px-6 py-2 rounded-xl font-black text-xs transition-all border ${almanacType === 'ally' ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      <i className="fas fa-shield-alt mr-2"></i> ASSETS
                    </button>
                </div>
             </div>

            <div className="relative z-10 flex flex-1 flex-col lg:flex-row gap-6 overflow-hidden p-6">
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {(almanacType === 'enemy' ? ENEMY_UNITS : PLAYER_UNITS).filter(e => e.cost > 0 || e.id === 'e_wall').map(e => {
                      const baseSelected = selectedEnemyId === e.id;
                      const altSelected = selectedEnemyId === e.id + '_alt';
                      const themeColor = almanacType === 'enemy' ? 'red' : 'blue';
                      
                      return (
                        <React.Fragment key={e.id}>
                          <button 
                            onClick={() => { sounds.playClick(); setSelectedEnemyId(e.id); }} 
                            className={`h-32 rounded-2xl border transition-all flex flex-col items-center justify-center relative overflow-hidden group ${baseSelected ? `bg-${themeColor}-900/20 border-${themeColor}-500 shadow-[0_0_15px_rgba(0,0,0,0.5)]` : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750'}`}
                          >
                            <div className="scale-90 group-hover:scale-100 transition-transform duration-300">
                               <BattlerVisual typeId={e.id} isHeavy={e.icon.includes('heavy')} hasHat={e.id === 'e_builder'} isAlmanac={true} />
                            </div>
                            <div className="absolute bottom-3 left-0 right-0 text-center z-10 px-2">
                               <div className="font-black text-[9px] uppercase leading-tight text-slate-300 truncate">{e.name}</div>
                            </div>
                          </button>
                          {almanacType === 'ally' && e.altForm && (
                            <button 
                              onClick={() => { sounds.playClick(); setSelectedEnemyId(e.id + '_alt'); }} 
                              className={`h-32 rounded-2xl border transition-all flex flex-col items-center justify-center relative overflow-hidden group ${altSelected ? 'bg-amber-900/20 border-amber-500 shadow-[0_0_15px_rgba(0,0,0,0.5)]' : 'bg-slate-800 border-amber-900/30 hover:border-amber-700 hover:bg-slate-750'}`}
                            >
                              <div className="absolute top-2 right-2 text-[8px] font-black uppercase bg-amber-500 text-black px-1.5 rounded">ALT</div>
                              <div className="scale-90 group-hover:scale-100 transition-transform duration-300">
                                 <BattlerVisual typeId={e.id} isAltForm={true} isAlmanac={true} />
                              </div>
                              <div className="absolute bottom-3 left-0 right-0 text-center z-10 px-2">
                                 <div className="font-black text-[9px] uppercase leading-tight text-slate-300 truncate">{e.altForm.name}</div>
                              </div>
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
              </div>
              <div className="w-full lg:w-[400px] h-[400px] lg:h-full shrink-0 relative">
                 {renderEnemyDetail(selectedEnemyId)}
              </div>
            </div>
          </div>
        );
      case 'shop':
      case 'loadout':
        const isShop = gameState.screen === 'shop';
        return (
          <div className="flex flex-col h-full bg-[#020617] relative overflow-hidden">
             
             {/* Animated Background */}
             <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#020617] to-slate-950"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full"></div>
             </div>

             {/* Header */}
             <div className="relative z-10 flex justify-between items-center p-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                   <button onClick={() => exitToMenu()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800/50 border border-white/10 hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
                      <i className="fas fa-chevron-left"></i>
                   </button>
                   <div>
                      <h2 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 uppercase leading-none">
                        {isShop ? 'ACQUISITIONS' : 'LOADOUT'}
                      </h2>
                      <p className="text-[10px] font-bold tracking-[0.3em] text-indigo-400 uppercase mt-1">
                        {isShop ? 'Upgrade Your Assets' : 'Manage Squad Composition'}
                      </p>
                   </div>
                </div>
                
                <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-md border border-white/10 py-2 px-4 rounded-xl shadow-lg">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Available Funds</span>
                        <span className="text-xl font-mono text-yellow-400 font-black tracking-tight">${gameState.coins.toLocaleString()}</span>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 text-yellow-500">
                        <i className="fas fa-coins"></i>
                    </div>
                </div>
             </div>

            <div className="relative z-10 flex flex-1 flex-col lg:flex-row gap-6 overflow-hidden p-4 md:p-6">
              
              {/* Left Column: Inventory / Roster */}
              <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
                
                {/* Active Roster Section (Loadout Only) */}
                {!isShop && (
                   <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                      <div className="flex justify-between items-center mb-4">
                         <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300 flex items-center gap-2">
                           <i className="fas fa-users"></i> Active Roster
                         </h3>
                         <span className={`text-[10px] font-bold px-2 py-1 rounded border ${gameState.loadout.length >= 10 ? 'bg-red-900/30 border-red-500/30 text-red-400' : 'bg-green-900/30 border-green-500/30 text-green-400'}`}>
                           {gameState.loadout.length} / 10 UNITS
                         </span>
                      </div>
                      
                      <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                          {gameState.loadout.map(id => {
                            const u = PLAYER_UNITS.find(x => x.id === id)!;
                            const level = gameState.unitLevels[id] || 1;
                            const isAlt = level >= 10 && !!u.altForm && (gameState.preferredForms[id] ?? true);
                            return (
                              <div key={id} className="group relative aspect-square">
                                <button 
                                  onClick={() => { sounds.playClick(); setSelectedUnitId(id); }} 
                                  className={`w-full h-full rounded-xl flex flex-col items-center justify-center border transition-all relative overflow-hidden ${selectedUnitId === id ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'bg-slate-800 border-slate-700 hover:border-indigo-500/50'}`}
                                >
                                  <div className="scale-75 group-hover:scale-90 transition-transform duration-300">
                                    <BattlerVisual typeId={u.id} size="sm" isAltForm={isAlt} />
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-[2px] py-0.5">
                                    <div className="text-[6px] font-bold uppercase text-center text-white truncate px-1">
                                      {isAlt ? u.altForm!.name : u.name}
                                    </div>
                                  </div>
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setGameState(p => ({ ...p, loadout: p.loadout.filter(uid => uid !== id) })); if (selectedUnitId === id) setSelectedUnitId(null); }} 
                                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[8px] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 z-20"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            );
                          })}
                          {Array.from({ length: 10 - gameState.loadout.length }).map((_, i) => (
                            <div key={i} className="aspect-square bg-white/5 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-white/10 font-black text-xl">
                              +
                            </div>
                          ))}
                      </div>
                   </div>
                )}

                {/* Resources Grid */}
                <div className="flex-1">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2 px-2">
                    <i className="fas fa-layer-group"></i> {isShop ? 'Available Upgrades' : 'Personnel Database'}
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {isShop && (
                        <>
                          <button onClick={() => { sounds.playClick(); setSelectedUnitId('starting_budget_upgrade'); }} className={`relative group h-32 rounded-2xl border transition-all overflow-hidden ${selectedUnitId === 'starting_budget_upgrade' ? 'bg-yellow-900/20 border-yellow-500' : 'bg-slate-800 border-slate-700 hover:border-yellow-500/50 hover:bg-slate-750'}`}>
                             <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             <div className="h-full flex flex-col items-center justify-center p-2">
                                <div className="text-3xl mb-2 text-yellow-400 group-hover:scale-110 transition-transform drop-shadow-lg"><i className="fas fa-briefcase-medical"></i></div>
                                <div className="font-black text-[9px] uppercase text-center leading-tight text-slate-200">Startup Capital</div>
                                <div className="mt-2 text-[8px] font-bold bg-yellow-900/40 text-yellow-300 px-2 py-0.5 rounded border border-yellow-700/30">LVL {gameState.startingBudgetLevel}</div>
                             </div>
                          </button>
                          
                          <button onClick={() => { sounds.playClick(); setSelectedUnitId('bank_upgrade'); }} className={`relative group h-32 rounded-2xl border transition-all overflow-hidden ${selectedUnitId === 'bank_upgrade' ? 'bg-green-900/20 border-green-500' : 'bg-slate-800 border-slate-700 hover:border-green-500/50 hover:bg-slate-750'}`}>
                             <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             <div className="h-full flex flex-col items-center justify-center p-2">
                                <div className="text-3xl mb-2 text-green-400 group-hover:scale-110 transition-transform drop-shadow-lg"><i className="fas fa-university"></i></div>
                                <div className="font-black text-[9px] uppercase text-center leading-tight text-slate-200">Corporate Bank</div>
                                <div className="mt-2 text-[8px] font-bold bg-green-900/40 text-green-300 px-2 py-0.5 rounded border border-green-700/30">LVL {gameState.bankLevel}</div>
                             </div>
                          </button>

                          <button onClick={() => { sounds.playClick(); setSelectedUnitId('cannon_upgrade'); }} className={`relative group h-32 rounded-2xl border transition-all overflow-hidden ${selectedUnitId === 'cannon_upgrade' ? 'bg-orange-900/20 border-orange-500' : 'bg-slate-800 border-slate-700 hover:border-orange-500/50 hover:bg-slate-750'}`}>
                             <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             <div className="h-full flex flex-col items-center justify-center p-2">
                                <div className="text-3xl mb-2 text-orange-400 group-hover:scale-110 transition-transform drop-shadow-lg"><i className="fas fa-burst"></i></div>
                                <div className="font-black text-[9px] uppercase text-center leading-tight text-slate-200">Corp Cannon</div>
                                <div className="mt-2 text-[8px] font-bold bg-orange-900/40 text-orange-300 px-2 py-0.5 rounded border border-orange-700/30">LVL {gameState.cannonLevel}</div>
                             </div>
                          </button>
                        </>
                      )}
                      
                      {PLAYER_UNITS.map(u => {
                        const isUnlocked = isUnitUnlocked(u);
                        const level = gameState.unitLevels[u.id] || 1;
                        const isAlt = level >= 10 && !!u.altForm && (gameState.preferredForms[u.id] ?? true);
                        const isEquipped = gameState.loadout.includes(u.id);
                        
                        return (
                          <button 
                            key={u.id} 
                            onClick={() => { 
                              if (isUnlocked) { 
                                if (!isShop) { 
                                  setGameState(prev => prev.loadout.includes(u.id) ? { ...prev, loadout: prev.loadout.filter(uid => uid !== u.id) } : prev.loadout.length < 10 ? { ...prev, loadout: [...prev.loadout, u.id] } : prev); 
                                } 
                                setSelectedUnitId(u.id); 
                              } else setSelectedUnitId(u.id); 
                              sounds.playClick(); 
                            }} 
                            className={`relative h-32 rounded-2xl border transition-all overflow-hidden group flex flex-col items-center justify-center ${
                              !isUnlocked 
                                ? 'bg-black/40 border-slate-800 opacity-50 grayscale' 
                                : selectedUnitId === u.id 
                                  ? 'bg-indigo-900/20 border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]' 
                                  : isEquipped && !isShop
                                    ? 'bg-indigo-900/10 border-indigo-500/50'
                                    : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750'
                            }`}
                          >
                            {!isUnlocked && (
                              <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50">
                                <i className="fas fa-lock text-slate-500 text-xl"></i>
                              </div>
                            )}
                            
                            <div className="relative z-10 scale-90 group-hover:scale-100 transition-transform duration-300">
                               <BattlerVisual typeId={u.id} isAltForm={isAlt} />
                            </div>
                            
                            <div className="absolute bottom-3 left-0 right-0 text-center z-10 px-2">
                               <div className="font-black text-[9px] uppercase leading-tight text-slate-300 truncate">{isAlt ? u.altForm!.name : u.name}</div>
                            </div>

                            {isEquipped && !isShop && (
                              <div className="absolute top-2 right-2 text-indigo-400 z-20 drop-shadow-md">
                                <i className="fas fa-check-circle"></i>
                              </div>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
              
              {/* Right Column: Details Panel */}
              <div className="w-full lg:w-[420px] shrink-0 h-[400px] lg:h-full relative">
                 {renderUnitDetail(selectedUnitId)}
              </div>
            </div>
          </div>
        );
      case 'battle':
        const activeUnits = PLAYER_UNITS.filter(u => gameState.loadout.includes(u.id));
        const walletUpgradeCost = WALLET_UPGRADE_COSTS[gameState.walletLevel] || 999999;
        const now = Date.now();
        const cp = Math.max(0, Math.min(100, (1 - Math.max(0, cannonReadyTime - now) / CANNON_COOLDOWN) * 100));
        
        // Calculate current display income
        const currentRate = (BASE_BANK_INCOME_PER_TICK + (gameState.bankLevel - 1) * BANK_INCOME_GAIN_PER_LEVEL) * MONEY_MULTIPLIER[gameState.walletLevel] * 10;
        
        const battleTime = Date.now() - battleStartTimeRef.current;
        const isEnemyImmune = battleTime < 5000;

        return (
          <div className="flex flex-col h-full bg-[#020617] relative overflow-hidden">
            <button onClick={() => exitToMenu()} className="absolute top-4 right-4 z-50 bg-red-600 hover:bg-red-500 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-2xl transition-all active:scale-90 border-2 border-red-400/30">✕</button>
            
            {/* SANDBOX PANEL */}
            {gameState.sandboxMode && (
              <div className={`absolute left-4 top-24 bottom-24 z-40 bg-slate-900/95 border-2 border-yellow-600/50 rounded-3xl shadow-2xl w-80 flex flex-col overflow-hidden transition-transform duration-300 ${showSandboxPanel ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'}`}>
                <div className="p-4 bg-yellow-900/20 border-b border-yellow-600/30 flex justify-between items-center">
                   <h3 className="font-black italic text-yellow-500 text-lg uppercase">Sandbox Tools</h3>
                   <button onClick={() => { sounds.playClick(); setShowSandboxPanel(false); }} className="text-yellow-500 hover:text-white"><i className="fas fa-times"></i></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Game State</div>
                    <button onClick={() => { sounds.playClick(); setGameState(p => ({...p, sandboxPaused: !p.sandboxPaused})); }} className={`w-full py-3 rounded-xl font-bold border-2 transition-all ${gameState.sandboxPaused ? 'bg-red-900/50 border-red-500 text-red-200' : 'bg-green-900/50 border-green-500 text-green-200'}`}>
                      {gameState.sandboxPaused ? <><i className="fas fa-pause mr-2"></i> ENEMY SPAWNING PAUSED</> : <><i className="fas fa-play mr-2"></i> ENEMY SPAWNING ACTIVE</>}
                    </button>
                  </div>

                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">Spawn Ally</div>
                    <div className="grid grid-cols-3 gap-2">
                       {PLAYER_UNITS.map(u => (
                         <button key={u.id} onClick={() => deploySandboxUnit(u.id, 'player')} className="bg-slate-800 p-2 rounded-lg border border-slate-700 hover:bg-slate-700 hover:border-blue-500 transition-all flex flex-col items-center">
                            <BattlerVisual typeId={u.id} size="sm" isAltForm={false} />
                            <span className="text-[7px] font-bold uppercase mt-1 text-center truncate w-full">{u.name}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-red-400 mb-2">Spawn Enemy</div>
                    <div className="grid grid-cols-3 gap-2">
                       {ENEMY_UNITS.map(u => (
                         <button key={u.id} onClick={() => deploySandboxUnit(u.id, 'enemy')} className="bg-slate-800 p-2 rounded-lg border border-slate-700 hover:bg-slate-700 hover:border-red-500 transition-all flex flex-col items-center">
                            <BattlerVisual typeId={u.id} size="sm" isAltForm={false} isHeavy={u.icon.includes('heavy')} hasHat={u.id === 'e_builder'} isAlmanac={true} />
                            <span className="text-[7px] font-bold uppercase mt-1 text-center truncate w-full">{u.name}</span>
                         </button>
                       ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* SANDBOX TOGGLE BUTTON (When hidden) */}
            {gameState.sandboxMode && !showSandboxPanel && (
               <button onClick={() => { sounds.playClick(); setShowSandboxPanel(true); }} className="absolute left-0 top-1/2 -translate-y-1/2 bg-yellow-600 text-black font-black py-6 px-1 rounded-r-xl shadow-xl z-40 writing-vertical-rl text-xs uppercase tracking-widest hover:pl-3 transition-all">
                 OPEN SANDBOX
               </button>
            )}

            <div className="bg-slate-900/90 p-3 md:p-4 flex items-center justify-between border-b border-slate-800 shadow-xl z-30">
              <div className="flex items-center gap-6 md:gap-12">
                <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">{gameState.sandboxMode ? 'SANDBOX' : `STAGE 0${gameState.currentStage}`}</span><span className="text-xl md:text-2xl font-black text-blue-400 italic leading-none">LVL {gameState.playerLevel}</span></div>
                <div className="flex flex-col"><span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">BUDGET (${currentRate.toFixed(1)}/S)</span><span className="text-xl md:text-2xl font-mono text-yellow-400 font-black leading-none">${Math.floor(gameState.money)}</span></div>
              </div>
              <div className="flex items-center gap-3">
                 <button onClick={fireCannon} disabled={now < cannonReadyTime} className="relative h-12 w-12 md:h-14 md:w-14 bg-orange-600 rounded-xl overflow-hidden border border-orange-400 flex items-center justify-center shadow-lg transition-all active:scale-90 disabled:opacity-40"><div className="absolute bottom-0 left-0 w-full bg-black/60 transition-all" style={{ height: `${100 - cp}%` }}></div><i className={`fas fa-burst text-xl z-10 ${now >= cannonReadyTime ? 'animate-pulse text-white' : 'text-orange-950'}`}></i>{now < cannonReadyTime && <span className="absolute inset-0 flex items-center justify-center z-20 font-mono text-[9px] font-bold">{Math.ceil((cannonReadyTime - now) / 1000)}s</span>}</button>
                <button onClick={upgradeWallet} disabled={gameState.walletLevel >= WALLET_UPGRADE_COSTS.length - 1 || gameState.money < walletUpgradeCost} className="bg-indigo-600 h-12 md:h-14 px-4 md:px-6 rounded-xl font-black text-[10px] md:text-xs shadow-lg active:translate-y-0.5 disabled:opacity-40 transition-all uppercase tracking-tighter">{gameState.walletLevel >= WALLET_UPGRADE_COSTS.length - 1 ? 'MAX BUDGET' : `EXPAND: $${walletUpgradeCost}`}</button>
              </div>
            </div>
            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
              <div className="flex-1 relative overflow-hidden"><Battlefield units={gameState.units} playerBaseHp={gameState.playerBaseHp} enemyBaseHp={gameState.enemyBaseHp} maxBaseHp={500 + (gameState.currentStage - 1) * 1000} unitLevels={gameState.unitLevels} cannonEffect={cannonEffectActive} currentStage={gameState.currentStage} isEnemyImmune={isEnemyImmune} /></div>
              <div className="mt-4 flex gap-4 h-24 shrink-0">
                 <div className="flex-1 bg-slate-900/40 rounded-2xl p-3 h-full overflow-y-auto border border-slate-800 text-[11px] leading-tight font-medium font-mono text-slate-400 shadow-inner">{gameState.battleLog.map((log, idx) => <div key={idx} className={`mb-1 border-l-2 pl-2 ${idx === 0 ? 'text-blue-300 border-blue-500 font-bold' : 'border-slate-800 opacity-60'}`}>{log}</div>)}</div>
              </div>
            </div>
            <div className="bg-slate-900/95 p-4 md:p-6 flex justify-center gap-3 md:gap-4 border-t border-slate-800 shadow-2xl overflow-x-auto h-36 shrink-0 no-scrollbar">
              {activeUnits.map(unit => <UnitCard key={unit.id} unit={unit} money={gameState.money} unitLevel={gameState.unitLevels[unit.id] || 1} isAltPreferred={gameState.preferredForms[unit.id] ?? true} lastSpawnTime={unitLastSpawnTimes[unit.id] || 0} onDeploy={() => deployUnit('player', unit.id)} />)}
            </div>
            {gameState.isGameOver && (
              <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 backdrop-blur-xl animate-in fade-in duration-300">
                <div className="bg-slate-900 p-8 md:p-12 rounded-[2.5rem] border-4 border-slate-800 text-center shadow-2xl max-w-lg w-full">
                  <h2 className={`text-5xl md:text-6xl font-black mb-6 italic tracking-tighter ${gameState.winner === 'player' ? 'text-green-400' : 'text-red-500'}`}>{gameState.winner === 'player' ? 'VICTORY!' : 'LAYOFFS'}</h2>
                  {gameState.winner === 'player' && lastWinReward && <div className="mb-8 animate-bounce"><div className="text-yellow-400 font-black text-2xl uppercase tracking-widest">Revenue: +${lastWinReward.coins}</div>{lastWinReward.isFirst && <div className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] mt-2">Early Adoption Bonus applied!</div>}</div>}
                  {gameState.winner === 'player' && !lastWinReward && <div className="mb-8"><div className="text-slate-500 font-black text-xl uppercase tracking-widest">Sandbox Mode - No Revenue</div></div>}
                  <button onClick={() => exitToMenu()} className="bg-white text-black px-10 py-4 rounded-2xl text-xl font-black hover:scale-105 active:scale-95 transition-all w-full">BACK TO HUB</button>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return <div className="flex flex-col h-screen select-none font-sans bg-[#020617] text-slate-100 overflow-hidden">
      <style>{`
        .bg-grid-pattern {
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shine {
          0% { left: -100%; opacity: 0.1; }
          20% { left: 100%; opacity: 0.2; }
          100% { left: 100%; opacity: 0; }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-shine { animation: shine 3s ease-in-out infinite; }
        .animate-spin-slow { animation: spin 4s linear infinite; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        @keyframes hammer-hit {
          0% { transform: translate(-50%, 0) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          50% { transform: translate(-50%, 10px) rotate(-45deg); }
          100% { transform: translate(-50%, 0) rotate(0deg); opacity: 0; }
        }
        @keyframes idle-sway {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(2px) rotate(2deg); }
        }
        @keyframes idle-aggressive {
          0%, 100% { transform: scale(1) translateY(0); }
          25% { transform: scale(1.05) translateY(-2px); }
          75% { transform: scale(0.98) translateY(1px); }
        }
        @keyframes idle-fidget {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(-3deg); }
          20% { transform: rotate(3deg); }
          30% { transform: rotate(0deg); }
        }
        @keyframes idle-breathing {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.04) translateY(-1px); }
        }
        @keyframes idle-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .animate-hammer-hit { animation: hammer-hit 0.5s ease-in-out infinite; }
        .animate-idle-sway { animation: idle-sway 2.5s ease-in-out infinite; }
        .animate-idle-aggressive { animation: idle-aggressive 1.5s ease-in-out infinite; }
        .animate-idle-fidget { animation: idle-fidget 4s ease-in-out infinite; }
        .animate-idle-breathing { animation: idle-breathing 2s ease-in-out infinite; }
        .animate-idle-gentle { animation: idle-gentle 3s ease-in-out infinite; }
        
        @keyframes slash-animation {
          0% { transform: scale(0) rotate(-45deg); opacity: 0; }
          20% { transform: scale(1.5) rotate(45deg); opacity: 1; }
          100% { transform: scale(1.2) rotate(60deg); opacity: 0; }
        }
        @keyframes unit-recoil {
          0% { transform: translateX(0); }
          50% { transform: translateX(-5px); }
          100% { transform: translateX(0); }
        }
        @keyframes cannon-flash {
          0% { opacity: 0; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.2); }
        }
        @keyframes battler-lunge {
          0% { transform: translateX(0); }
          50% { transform: translateX(15px); }
          100% { transform: translateX(0); }
        }
        @keyframes double-punch {
          0% { transform: translateX(0); }
          25% { transform: translateX(12px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(16px); }
          100% { transform: translateX(0); }
        }
        .slash-effect { animation: slash-animation 0.3s ease-out forwards; }
        .recoil { animation: unit-recoil 0.1s ease-in-out; }
        .cannon-blast { animation: cannon-flash 0.5s ease-out forwards; }
        .animate-battler-lunge { animation: battler-lunge 0.2s ease-out; }
        .animate-double-punch { animation: double-punch 0.3s ease-in-out; }
        .writing-vertical-rl { writing-mode: vertical-rl; }
      `}</style>
      {renderScreen()}
      <GameAssistant gameState={gameState} />
  </div>;
}
