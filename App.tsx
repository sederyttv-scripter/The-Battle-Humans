
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
  STARTING_BUDGET_UPGRADE_COST_MULTIPLIER,
  STAGE_CONFIG
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

// --- Visual Components ---

const ScreenWrapper: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = "" }) => (
  <div className={`flex flex-col h-full bg-[#020617] text-slate-100 overflow-hidden relative font-sans ${className}`}>
    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>
    <div className="absolute inset-0 bg-gradient-to-b from-blue-900/5 via-transparent to-blue-900/10 pointer-events-none"></div>
    {children}
  </div>
);

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
      className={`relative w-[4.5rem] h-24 md:w-20 md:h-28 flex flex-col items-center justify-between p-1 rounded-xl border-b-4 transition-all duration-75 overflow-hidden shrink-0 group ${
        !isDisabled 
          ? 'bg-slate-800 border-blue-600 hover:bg-slate-700 active:scale-95 active:border-b-0 active:translate-y-1 shadow-lg' 
          : 'bg-slate-900 border-slate-800 opacity-70 cursor-not-allowed grayscale'
      }`}
    >
      {/* Cooldown Overlay */}
      {!isOffCooldown && (
        <div 
          className="absolute inset-0 bg-black/70 z-20 flex items-center justify-center"
        >
           <div className="text-white font-black text-[10px] md:text-xs">
             {((unit.spawnCooldown - timeSinceLastSpawn) / 1000).toFixed(1)}s
           </div>
           <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" style={{ width: `${cooldownPercent}%` }}></div>
        </div>
      )}
      
      {/* Unit Visual */}
      <div className="flex-1 flex items-center justify-center z-10 scale-75 md:scale-90">
        <BattlerVisual typeId={unit.id} isAltForm={isAltActive} />
      </div>

      {/* Info Footer */}
      <div className="w-full bg-slate-950/80 p-1 flex flex-col items-center z-10 rounded-b-lg">
        <div className="text-[8px] md:text-[9px] font-bold uppercase tracking-tight text-slate-300 w-full text-center truncate leading-none mb-0.5">
          {isAltActive ? unit.altForm!.name : unit.name}
        </div>
        <div className={`text-[10px] md:text-xs font-mono font-black ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
          ${stats.cost}
        </div>
      </div>

      {/* Level Badge */}
      <div className="absolute top-1 right-1 text-[8px] font-black bg-blue-900/80 text-blue-200 px-1 rounded z-20 border border-blue-500/30">
        L{unitLevel}
      </div>
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
  isAlmanac?: boolean,
  hasThrownShotgun?: boolean
}> = ({ typeId, isHeavy, isAttacking, hasHat, size = 'md', lastAbilityTime, isAltForm, isAlmanac, hasThrownShotgun }) => {
  const scale = size === 'sm' ? 'scale-75' : size === 'lg' ? 'scale-125' : 'scale-100';
  const isAlly = typeId && !typeId.startsWith('e_');
  const now = Date.now();
  
  const isConstructing = typeId === 'e_builder' && lastAbilityTime && (now - lastAbilityTime < 1500);
  
  if (typeId === 'e_wall') {
    return (
      <div className={`w-14 h-16 bg-gradient-to-br from-amber-800 to-amber-950 border-2 border-amber-950 rounded shadow-2xl relative flex flex-col justify-evenly p-0.5 overflow-hidden ${scale}`}>
        {/* Brick Pattern */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-0.5 h-[20%] opacity-80">
             <div className={`${i % 2 === 0 ? 'flex-1' : 'w-1/3'} bg-amber-700/50 border-r border-black/20`}></div>
             <div className="flex-1 bg-amber-700/50 border-r border-black/20"></div>
             <div className={`${i % 2 === 0 ? 'flex-1' : 'w-1/3'} bg-amber-700/50`}></div>
          </div>
        ))}
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
      case 'e_baller': return 'animate-idle-baller';
      case 'e_boss_shotgunner': return 'animate-idle-boss';
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
            </>
          )}
        </>
      );
      case 'e_baller': return (
        <>
           <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-purple-600 rounded-full z-10 shadow-sm"></div>
           <div className={`absolute top-4 -right-2 w-5 h-5 bg-red-600 rounded-full border border-red-800 shadow-md z-20 transition-all duration-300 ${isAttacking ? 'translate-x-16 -translate-y-4 rotate-[360deg]' : 'translate-x-0'}`}>
              <div className="absolute inset-0 border-r border-black/20 rounded-full"></div>
              <div className="absolute inset-0 border-b border-black/10 rounded-full"></div>
           </div>
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
      case 'e_boss_shotgunner': return (
        <>
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-8 h-8 bg-black rounded-full border-2 border-slate-700 z-10 flex items-center justify-center">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_red]"></div>
          </div>
          {/* Weapon */}
          <div className={`absolute top-2 -left-6 w-12 h-3 bg-slate-800 border border-slate-600 origin-right transition-transform ${hasThrownShotgun ? 'hidden' : ''} ${isAttacking ? '-rotate-12 translate-x-2' : ''}`}>
             <div className="absolute -left-1 top-[-2px] w-2 h-4 bg-amber-900 rounded-sm"></div>
          </div>
          {/* AK-47 Mode */}
          {hasThrownShotgun && (
             <div className={`absolute top-3 -left-5 w-10 h-2 bg-black border border-slate-700 origin-right ${isAttacking ? 'animate-vibrate' : ''}`}>
                <div className="absolute -left-1 top-0 w-1 h-3 bg-amber-800"></div>
             </div>
          )}
          {/* Shield/Armor */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-10 bg-slate-800/50 rounded-full border border-white/10 -z-10"></div>
        </>
      );
      default: return null;
    }
  }, [typeId, isAttacking, isConstructing, isAltForm, hasThrownShotgun]);

  return (
    <div className={`relative transition-transform duration-150 ${scale} ${isHeavy || typeId === 'e_boss_shotgunner' ? 'scale-125' : ''} ${isAttacking ? (isHeavy ? 'animate-double-punch' : 'animate-battler-lunge') : idleAnimationClass}`}>
      {accessories}
      {typeId !== 'e_rage_battler' && typeId !== 'e_boss_shotgunner' && (
        <>
          <div className="w-4 h-4 bg-yellow-400 rounded-sm mx-auto mb-[-1px] shadow-sm relative z-0"></div>
          <div className="flex items-center relative z-0">
            <div className={`w-2 h-6 bg-blue-600 rounded-l-sm transition-transform ${isAttacking ? 'translate-x-1' : ''}`}></div>
            <div className={`w-6 h-7 ${isAltForm && typeId === 'sworder' ? 'bg-zinc-800' : typeId === 'e_baller' ? 'bg-purple-600' : isAlly ? 'bg-[#b91c1c]' : 'bg-[#dc2626]'} shadow-inner border-x border-black/10`}></div>
            <div className={`w-2 h-6 bg-blue-600 rounded-r-sm transition-transform ${isAttacking ? '-translate-x-2 scale-x-150' : ''}`}></div>
          </div>
          <div className="flex justify-center gap-1 mt-[-1px] relative z-0">
            <div className="w-2.5 h-4 bg-slate-800"></div>
            <div className="w-2.5 h-4 bg-slate-800"></div>
          </div>
        </>
      )}
      {typeId === 'e_boss_shotgunner' && (
         <div className="flex flex-col items-center">
            <div className="w-8 h-10 bg-slate-900 rounded-t-xl border-2 border-red-900 relative overflow-hidden">
                <div className="absolute top-2 left-0 right-0 h-1 bg-red-900/50"></div>
            </div>
            <div className="flex gap-1">
               <div className="w-3 h-6 bg-black rounded-b-sm"></div>
               <div className="w-3 h-6 bg-black rounded-b-sm"></div>
            </div>
         </div>
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
    <div className={`relative w-full h-full min-h-[400px] bg-slate-900 border-b-4 border-slate-950 overflow-hidden shadow-inner transition-colors duration-300 ${cannonEffect ? 'bg-red-900/20' : ''}`}>
      {/* Background Visuals */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,_rgba(59,130,246,0.1)_0%,_transparent_70%)]"></div>
      <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>

      {cannonEffect && (
        <div className="absolute inset-0 bg-white/30 z-40 cannon-blast flex items-center justify-center pointer-events-none">
          <div className="w-full h-24 bg-orange-500/50 blur-xl"></div>
        </div>
      )}

      {/* Bases */}
      <div className="absolute left-4 bottom-16 md:bottom-20 z-10 flex flex-col items-center group">
        <div className="relative">
           <div className="text-8xl text-blue-500/80 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] transform transition-transform group-hover:scale-105"><i className="fas fa-building"></i></div>
           {/* HP Bar Floating above base */}
           <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-24 bg-slate-950/80 rounded-full p-1 border border-blue-500/30">
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${playerBasePercent}%` }}></div>
              </div>
              <div className="text-[9px] text-center text-blue-200 font-mono mt-0.5">{Math.ceil(playerBaseHp)}</div>
           </div>
        </div>
      </div>

      <div className="absolute right-4 bottom-16 md:bottom-20 z-10 flex flex-col items-center group">
        <div className="relative">
           <div className={`text-8xl scale-x-[-1] drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] transform transition-transform group-hover:scale-105 ${isEnemyImmune ? 'text-yellow-500/80' : 'text-red-500/80'}`}>
              <i className={isEnemyImmune ? "fas fa-shield-alt" : "fas fa-industry"}></i>
           </div>
           {/* HP Bar Floating above base */}
           <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-24 bg-slate-950/80 rounded-full p-1 border border-red-500/30">
              {isEnemyImmune && <div className="absolute -top-4 w-full text-center text-[8px] font-black text-yellow-400 uppercase tracking-widest animate-pulse">Shielded</div>}
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${enemyBasePercent}%` }}></div>
              </div>
              <div className="text-[9px] text-center text-red-200 font-mono mt-0.5">{Math.ceil(enemyBaseHp)}</div>
           </div>
        </div>
      </div>

      {/* Units */}
      {units.map((u) => {
        const type = (u.side === 'player' ? PLAYER_UNITS : ENEMY_UNITS).find(t => t.id === u.typeId);
        if (!type) return null;

        const level = u.side === 'player' ? (unitLevels[u.typeId] || 1) : 1;
        
        let enemyScaling = 1.0;
        if (u.side === 'enemy' && u.typeId === 'e_battler' && currentStage === 1) {
          enemyScaling = 0.75;
        }
        if (u.side === 'enemy' && currentStage === 9) {
          enemyScaling = 0.98;
        }
        
        const isAlt = u.side === 'player' && level >= 10 && !!type.altForm && u.isAltForm;
        const currentHpBase = (isAlt ? type.altForm!.hp : type.hp);
        const maxHp = currentHpBase * (u.side === 'player' ? (1 + (level - 1) * STAT_GAIN_PER_LEVEL) : enemyScaling);
        const hpPercent = Math.max(0, Math.min(100, (u.currentHp / maxHp) * 100));
        
        const isAttacking = now - u.lastAttackTime < 250;
        const pos = (u.x / FIELD_WIDTH) * 100;
        
        // Boss Scale
        const isBoss = u.typeId === 'e_boss_shotgunner';

        return (
          <div key={u.instanceId} className={`absolute bottom-20 md:bottom-24 flex flex-col items-center transition-all duration-100 ease-linear z-20 ${isAttacking ? 'recoil' : ''} ${isBoss ? 'z-30' : ''}`} style={{ left: `${pos}%`, transform: `translateX(-50%) ${u.side === 'enemy' ? 'scaleX(-1)' : ''} ${isBoss ? 'scale(1.5)' : ''}` }}>
            {/* Visual Effect on Attack */}
            {isAttacking && u.typeId !== 'e_wall' && (
              <div className={`absolute -top-12 text-4xl slash-effect z-30 pointer-events-none ${type.id === 'e_baller' ? 'text-red-500' : 'text-white'}`}>
                <i className={
                  type.id === 'sworder' || type.id === 'e_pistoler' || type.id === 'pistoler' || type.id === 'e_rage_battler' ? 'fas fa-shield-slash text-white' : 
                  type.id === 'e_baller' ? 'fas fa-circle' :
                  type.id === 'e_boss_shotgunner' ? 'fas fa-skull text-red-600' :
                  'fas fa-bolt text-yellow-400'
                }></i>
              </div>
            )}
            
            {/* HP Bar */}
            <div className={`h-1.5 bg-black/50 rounded-full mb-1 overflow-hidden border border-white/10 ${isBoss ? 'w-20' : 'w-10'}`}>
               <div className={`h-full ${u.side === 'player' ? 'bg-blue-400' : 'bg-red-400'}`} style={{ width: `${hpPercent}%` }} />
            </div>
            
            {/* Unit */}
            <div className={`filter drop-shadow-lg ${u.typeId !== 'e_wall' && !isBoss ? 'animate-bounce' : ''}`} style={{ animationDuration: `${0.8 / (type.speed || 1)}s` }}>
              <BattlerVisual 
                typeId={u.typeId} 
                isHeavy={type.icon?.includes('heavy')} 
                isAttacking={isAttacking} 
                hasHat={type.id === 'e_builder'} 
                lastAbilityTime={u.lastAbilityTime}
                isAltForm={u.isAltForm}
                hasThrownShotgun={u.hasThrownShotgun}
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
  const [bossSpawned, setBossSpawned] = useState(false);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setDeferredPrompt(null);
      } else {
        console.log('User dismissed the install prompt');
      }
    }
  };
  
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
      battleLog: ["System initialized."],
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
      // Play boss theme if Stage 10
      sounds.startBattleTheme(gameState.currentStage === 10);
    } else {
      sounds.stopBattleTheme();
    }
    
    return () => {
      // Cleanup on unmount (though this app stays mounted mostly)
      if (gameState.screen !== 'battle') sounds.stopBattleTheme();
    };
  }, [gameState.screen, gameState.isGameOver, gameState.currentStage]);

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
  const enemyCooldownsRef = useRef<Record<string, number>>({ 'e_battler': 0, 'e_double_puncher': 0, 'e_builder': 0, 'e_pistoler': 0, 'e_rage_battler': 0, 'e_baller': 0 });
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
        if (prev.currentStage === 9) {
          hpScaling = 0.98;
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
    enemyCooldownsRef.current = { 'e_battler': 0, 'e_double_puncher': 0, 'e_builder': 0, 'e_pistoler': 0, 'e_rage_battler': 0, 'e_baller': 0 };
    setShowSandboxPanel(isSandbox); // Auto open panel in sandbox
    setBossSpawned(false);
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
        
        // --- SPAWN LOGIC START ---
        if (timeElapsed > 5000 && !prev.sandboxPaused) {
          // STAGE 10 LOGIC: No Mercy (Boss Stage)
          if (prev.currentStage === 10) {
              if (!bossSpawned && timeElapsed > 2000) {
                 // Summon Boss immediately after "shield" (start delay)
                 unitToSpawn = 'e_boss_shotgunner';
                 setBossSpawned(true);
              } else if (bossSpawned) {
                 // Regular spawns to support boss: Baller, Builder, Pistoler, Battler
                 if (enemyCooldownsRef.current['e_baller'] === 0 && enemyMoneyRef.current >= 250) {
                    unitToSpawn = 'e_baller'; 
                    enemyCooldownsRef.current['e_baller'] = 10000;
                 } else if (enemyCooldownsRef.current['e_builder'] === 0 && enemyMoneyRef.current >= 300) {
                    unitToSpawn = 'e_builder'; 
                    enemyCooldownsRef.current['e_builder'] = 15000;
                 } else if (enemyCooldownsRef.current['e_pistoler'] === 0 && enemyMoneyRef.current >= 200) {
                    unitToSpawn = 'e_pistoler';
                    enemyCooldownsRef.current['e_pistoler'] = 6000;
                 } else if (enemyCooldownsRef.current['e_battler'] === 0 && enemyMoneyRef.current >= 80) {
                    unitToSpawn = 'e_battler'; 
                    enemyCooldownsRef.current['e_battler'] = 2500;
                 }
              }
          }
          // STAGE 9 LOGIC: Nine of a Kinds (Strategic)
          else if (prev.currentStage === 9) {
             const enemiesOnField = prev.units.filter(u => u.side === 'enemy');
             // Count melee/tank units including walls
             const frontliners = enemiesOnField.filter(u => ['e_battler', 'e_double_puncher', 'e_rage_battler', 'e_wall'].includes(u.typeId)).length;
             
             // Maintain a frontline of at least 4 units
             if (frontliners < 4) {
                 const meatshields = ['e_battler', 'e_double_puncher', 'e_rage_battler'];
                 const available = meatshields.filter(id => {
                    const u = ENEMY_UNITS.find(e => e.id === id)!;
                    return enemyMoneyRef.current >= u.cost && enemyCooldownsRef.current[id] === 0;
                 });
                 if (available.length > 0) {
                     const pick = available[Math.floor(Math.random() * available.length)];
                     unitToSpawn = pick;
                     enemyCooldownsRef.current[pick] = ENEMY_UNITS.find(e => e.id === pick)!.spawnCooldown;
                 }
             } 
             // If frontline is sufficient, try to spawn backliners
             else {
                 const backliners = ['e_baller', 'e_pistoler', 'e_builder'];
                 const available = backliners.filter(id => {
                    const u = ENEMY_UNITS.find(e => e.id === id)!;
                    return enemyMoneyRef.current >= u.cost && enemyCooldownsRef.current[id] === 0;
                 });
                 if (available.length > 0) {
                     const pick = available[Math.floor(Math.random() * available.length)];
                     unitToSpawn = pick;
                     enemyCooldownsRef.current[pick] = ENEMY_UNITS.find(e => e.id === pick)!.spawnCooldown;
                 } else {
                     // If can't spawn backliner (cooldowns/money), but have excess money, reinforce frontline
                     if (enemyMoneyRef.current > 400) {
                         const meatshields = ['e_battler', 'e_double_puncher', 'e_rage_battler'];
                         const availableMS = meatshields.filter(id => {
                            const u = ENEMY_UNITS.find(e => e.id === id)!;
                            return enemyMoneyRef.current >= u.cost && enemyCooldownsRef.current[id] === 0;
                         });
                         if (availableMS.length > 0) {
                             const pick = availableMS[Math.floor(Math.random() * availableMS.length)];
                             unitToSpawn = pick;
                             enemyCooldownsRef.current[pick] = ENEMY_UNITS.find(e => e.id === pick)!.spawnCooldown;
                         }
                     }
                 }
             }
          }
          // STAGE 8 LOGIC: Bullet Hell
          else if (prev.currentStage === 8) {
             // Wall builder spawns
             if (enemyCooldownsRef.current['e_builder'] === 0 && enemyMoneyRef.current >= 300) {
                unitToSpawn = 'e_builder'; enemyCooldownsRef.current['e_builder'] = 15000;
             } 
             // Baller knockback support
             else if (enemyCooldownsRef.current['e_baller'] === 0 && enemyMoneyRef.current >= 250) {
                unitToSpawn = 'e_baller'; enemyCooldownsRef.current['e_baller'] = 5000;
             }
             // Rapid fire pistolers
             else if (enemyCooldownsRef.current['e_pistoler'] === 0 && enemyMoneyRef.current >= 200) {
                unitToSpawn = 'e_pistoler'; enemyCooldownsRef.current['e_pistoler'] = 2500; 
             }
          }
          // STAGE 7 LOGIC: Baller's Rise
          else if (prev.currentStage === 7) {
            if (enemyCooldownsRef.current['e_baller'] === 0 && enemyMoneyRef.current >= 250) {
              unitToSpawn = 'e_baller'; 
              enemyCooldownsRef.current['e_baller'] = 8000;
            } else if (enemyCooldownsRef.current['e_battler'] === 0 && enemyMoneyRef.current >= 100) {
              unitToSpawn = 'e_battler'; 
              enemyCooldownsRef.current['e_battler'] = 2000;
            } else if (enemyCooldownsRef.current['e_pistoler'] === 0 && enemyMoneyRef.current >= 200) {
              unitToSpawn = 'e_pistoler';
              enemyCooldownsRef.current['e_pistoler'] = 10000;
            }
          }
          // STAGE 6 LOGIC: MeatShielding
          else if (prev.currentStage === 6) {
            const maxHp = 500 + (prev.currentStage - 1) * 1000;
            const isBaseLow = prev.enemyBaseHp < maxHp * 0.8;
            if (enemyCooldownsRef.current['e_battler'] === 0 && enemyMoneyRef.current >= 80) {
              unitToSpawn = 'e_battler'; enemyCooldownsRef.current['e_battler'] = 1500;
            } else if (enemyCooldownsRef.current['e_double_puncher'] === 0 && enemyMoneyRef.current >= 150) {
              unitToSpawn = 'e_double_puncher'; enemyCooldownsRef.current['e_double_puncher'] = 4500;
            } else if ((timeElapsed > 30000 || isBaseLow) && enemyCooldownsRef.current['e_pistoler'] === 0 && enemyMoneyRef.current >= 200) {
              unitToSpawn = 'e_pistoler'; enemyCooldownsRef.current['e_pistoler'] = 8000;
            }
          } else if (prev.currentStage === 5) {
            const chance = Math.random();
            if (chance < 0.12 && enemyCooldownsRef.current['e_rage_battler'] === 0 && enemyMoneyRef.current >= 100) {
              unitToSpawn = 'e_rage_battler'; enemyCooldownsRef.current['e_rage_battler'] = 3500;
            }
          } else {
            // General Logic
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
                const chance = Math.random();
                if (chance < 0.15 && enemyCooldownsRef.current['e_double_puncher'] === 0 && enemyMoneyRef.current >= 150) {
                  unitToSpawn = 'e_double_puncher'; enemyCooldownsRef.current['e_double_puncher'] = 10000;
                } else if (chance < 0.35 && enemyCooldownsRef.current['e_battler'] === 0 && enemyMoneyRef.current >= 80) {
                  unitToSpawn = 'e_battler'; enemyCooldownsRef.current['e_battler'] = 5000;
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
                if (chance < 0.25 && enemyCooldownsRef.current['e_battler'] === 0 && enemyMoneyRef.current >= 80) {
                  unitToSpawn = 'e_battler'; enemyCooldownsRef.current['e_battler'] = 8000;
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
          
          // --- BOSS LOGIC START ---
          if (u.typeId === 'e_boss_shotgunner') {
             // Transition Logic: Throw Shotgun
             // Adjusted Threshold to 5000 (approx 75% of new HP 6563) to match buff
             if (u.currentHp < 5000 && !u.hasThrownShotgun) {
                u.hasThrownShotgun = true;
                // AK-47 Mode speed
                effectiveAttackCooldown = 250; 
                u.lastAttackTime = now; // Reset timer for new phase
             } 
             // Phase 2: AK-47
             else if (u.hasThrownShotgun) {
                effectiveAttackCooldown = 250;
             }
             // Phase 1: Shotgun (default)
             else {
                effectiveAttackCooldown = 2500;
             }
          }
          // --- BOSS LOGIC END ---

          let enemyDamageScaling = 1.0;
          if (u.side === 'enemy' && u.typeId === 'e_battler' && prev.currentStage === 1) {
            enemyDamageScaling = 0.75;
          }
          if (u.side === 'enemy' && prev.currentStage === 9) {
             enemyDamageScaling = 0.98;
          }
          
          const actualDmg = stats.damage * (u.side === 'player' ? (1 + (level - 1) * STAT_GAIN_PER_LEVEL) : enemyDamageScaling);
          if (u.typeId === 'e_wall') continue;
          
          const distToBase = u.side === 'player' ? FIELD_WIDTH - u.x : u.x;
          
          const possibleTargets = newUnits.filter(other => other.side !== u.side && Math.abs(u.x - other.x) <= stats.range);
          
          let target: ActiveUnit | undefined;
          
          if (possibleTargets.length > 0) {
            if (u.side === 'enemy') {
                const tank = possibleTargets.find(t => t.typeId === 'tank');
                target = tank || possibleTargets[0];
            } else {
                target = possibleTargets[0];
            }
          }
          
          if (target) {
            if (now - u.lastAttackTime > effectiveAttackCooldown) {
              u.lastAttackTime = now; sounds.playAttack();

              // --- SPECIAL BOSS ATTACK LOGIC ---
              if (u.typeId === 'e_boss_shotgunner') {
                  // Phase Transition Throw Attack
                  if (u.currentHp < 5000 && !u.hasThrownShotgun) {
                      u.hasThrownShotgun = true; // Mark done
                      
                      // Throw passes through 5 allies
                      const targetsToHit = possibleTargets
                          .sort((a, b) => Math.abs(u.x - a.x) - Math.abs(u.x - b.x))
                          .slice(0, 5);
                      
                      targetsToHit.forEach(t => t.currentHp = -99999);
                  } 
                  // Phase 1: Shotgun (Multi-target)
                  else if (!u.hasThrownShotgun) {
                      // Hit up to 6 targets
                      const targets = possibleTargets.slice(0, 6);
                      targets.forEach(t => t.currentHp -= actualDmg);
                  }
                  // Phase 2: AK-47 (Single target, fast, lower damage)
                  else {
                      target.currentHp -= 31; // Buffed AK damage (25 -> 31)
                  }
              } else {
                  // Standard Unit Attack
                  target.currentHp -= actualDmg;
              }

              // --- KNOCKBACK LOGIC ---
              if (u.typeId === 'e_baller') {
                 const knockbackDist = 45; // Buffed from 30
                 target.x += (target.side === 'player' ? -1 : 1) * knockbackDist;
                 target.x = Math.max(0, Math.min(FIELD_WIDTH, target.x));
              }

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
                if (timeElapsed > 5000) {
                   eDmg += actualDmg;
                   sounds.playBaseHit();
                }
              } else {
                // Boss Base Damage Logic
                if (u.typeId === 'e_boss_shotgunner' && u.hasThrownShotgun) {
                    pDmg += 31; // AK Base Damage
                } else if (u.typeId === 'e_boss_shotgunner' && !u.hasThrownShotgun) {
                    // Update Shotgun base damage to be 2x the new massive unit damage
                    // This ensures it stays threatening (210 * 2 = 420) without being 1-shot (1260)
                    pDmg += actualDmg * 2; 
                } else {
                    pDmg += actualDmg;
                }
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
          if (!prev.sandboxMode) {
             xp += XP_PER_WIN; if (xp >= XP_TO_LEVEL(plvl)) { xp -= XP_TO_LEVEL(plvl); plvl++; }
             const isFirst = !prev.unlockedStages.includes(prev.currentStage + 1);
             const reward = Math.floor(prev.currentStage * REWARD_PER_STAGE * (isFirst ? FIRST_CLEAR_MULTIPLIER : 1));
             newCoins += reward; setLastWinReward({ coins: reward, isFirst });
             // Fix: Remove the 8 cap to allow unlocking "9" (which is just beating 8)
             if (!stages.includes(prev.currentStage + 1)) stages.push(prev.currentStage + 1);
          } else {
             setLastWinReward({ coins: 0, isFirst: false });
          }
        }
        return { ...prev, money: newMoney, coins: newCoins, units: filtered, playerBaseHp: fPHp, enemyBaseHp: fEHp, isGameOver: over, winner: win, playerXP: xp, playerLevel: plvl, unlockedStages: stages };
      });
    }, GAME_TICK_INTERVAL);
    return () => clearInterval(interval);
  }, [gameState.screen, gameState.isGameOver, deployUnit, bossSpawned]);

  const renderUnitDetail = (unitId: string | null) => {
    // Shared Upgrade Panel UI Logic
    const renderUpgradeCard = (icon: string, title: string, level: number, desc: string, value: string, cost: number, onUpgrade: () => void) => (
      <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-md">
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 text-center space-y-4 overflow-y-auto custom-scrollbar min-h-0">
           <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-3xl md:text-4xl text-slate-400 shadow-[0_0_20px_rgba(0,0,0,0.5)] shrink-0">
              <i className={icon}></i>
           </div>
           <div className="shrink-0">
             <h2 className="text-2xl md:text-3xl font-black italic text-white uppercase tracking-wider">{title}</h2>
             <div className="text-xs font-mono text-slate-500 uppercase mt-1">Level {level}</div>
           </div>
           <p className="text-slate-400 text-sm max-w-xs leading-relaxed">{desc}</p>
           <div className="bg-slate-800/50 rounded-lg px-6 py-3 border border-white/5 shrink-0">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Current Stats</div>
              <div className="text-2xl font-mono text-white font-bold">{value}</div>
           </div>
        </div>
        <div className="p-4 border-t border-white/5 bg-slate-900/80 shrink-0">
           <button onClick={onUpgrade} disabled={gameState.coins < cost} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:grayscale rounded-xl font-bold text-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              <span>UPGRADE</span>
              <span className="bg-black/20 px-2 py-0.5 rounded text-sm font-mono">${cost}</span>
           </button>
        </div>
      </div>
    );

    if (unitId === 'starting_budget_upgrade') {
      const level = gameState.startingBudgetLevel;
      const cost = Math.floor(STARTING_BUDGET_UPGRADE_BASE_COST * Math.pow(STARTING_BUDGET_UPGRADE_COST_MULTIPLIER, level - 1));
      return renderUpgradeCard("fas fa-briefcase", "Initial Budget", level, "Increases starting money for operations.", `$${INITIAL_MONEY + (level - 1) * STARTING_BUDGET_GAIN_PER_LEVEL}`, cost, () => {
        sounds.playUpgrade(); setGameState(p => ({ ...p, coins: p.coins - cost, startingBudgetLevel: p.startingBudgetLevel + 1 }));
      });
    }
    
    if (unitId === 'cannon_upgrade') {
      const cost = CANNON_UPGRADE_BASE_COST * gameState.cannonLevel;
      const curDmg = CANNON_BASE_DAMAGE + (gameState.cannonLevel - 1) * CANNON_DAMAGE_PER_LEVEL;
      return renderUpgradeCard("fas fa-meteor", "Orbital Cannon", gameState.cannonLevel, "Increases damage of the base defense cannon.", `${curDmg} DMG`, cost, () => {
        sounds.playUpgrade(); setGameState(p => ({ ...p, coins: p.coins - cost, cannonLevel: p.cannonLevel + 1 }));
      });
    }

    if (unitId === 'bank_upgrade') {
      const cost = getBankUpgradeCost(gameState.bankLevel);
      const curIncome = (BASE_BANK_INCOME_PER_TICK + (gameState.bankLevel - 1) * BANK_INCOME_GAIN_PER_LEVEL) * 10;
      return renderUpgradeCard("fas fa-chart-line", "Corporate Bank", gameState.bankLevel, "Increases passive income generation rate.", `$${curIncome.toFixed(1)}/s`, cost, () => {
        sounds.playUpgrade(); setGameState(p => ({ ...p, coins: p.coins - cost, bankLevel: p.bankLevel + 1 }));
      });
    }
    
    if (!unitId) return (
      <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4 opacity-50">
        <i className="fas fa-terminal text-6xl"></i>
        <div className="text-xl font-black uppercase tracking-widest">Select Item</div>
      </div>
    );

    // Try finding in Player units first, then Enemy units
    let unit = PLAYER_UNITS.find(u => u.id === unitId);
    let isEnemy = false;
    
    if (!unit) {
        unit = ENEMY_UNITS.find(u => u.id === unitId);
        if (unit) isEnemy = true;
    }

    if (!unit) return null;

    const level = isEnemy ? 1 : (gameState.unitLevels[unitId] || 1);
    // For enemies, show unlocked in Almanac
    const isUnlocked = isEnemy ? true : isUnitUnlocked(unit);
    const nextLvlCost = isEnemy ? 0 : getUpgradeCost(unit, level);
    const isAltPreferred = !isEnemy && (gameState.preferredForms[unitId] ?? true);
    const isAltAvailable = !isEnemy && level >= 10 && !!unit.altForm;
    const isAlt = isAltAvailable && isAltPreferred;
    const stats = isAlt ? unit.altForm! : unit;
    
    const curHp = Math.floor(stats.hp * (1 + (level - 1) * STAT_GAIN_PER_LEVEL));
    const curDmg = Math.floor(stats.damage * (1 + (level - 1) * STAT_GAIN_PER_LEVEL));
    const isAtMaxLevel = level >= 10;

    return (
      <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-md">
        <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
           <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg shrink-0">
                 <div className="scale-125"><BattlerVisual typeId={unit.id} isAltForm={isAlt} size="lg" isAlmanac={true} /></div>
              </div>
              <div>
                 <h2 className="text-2xl font-black italic text-white leading-none">{isAlt ? unit.altForm!.name : unit.name}</h2>
                 <div className="flex items-center gap-2 mt-2">
                    <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isEnemy ? 'bg-red-600' : 'bg-blue-600'}`}>
                        {isEnemy ? 'HOSTILE ENTITY' : `Level ${level}`}
                    </span>
                    {isAltAvailable && (
                      <button onClick={() => toggleForm(unitId)} className="bg-slate-700 hover:bg-slate-600 text-xs px-2 py-0.5 rounded text-white transition-colors">
                        <i className="fas fa-sync-alt mr-1"></i> Switch Form
                      </button>
                    )}
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                 <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Health</div>
                 <div className="text-xl font-mono text-green-400">{curHp}</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                 <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Damage</div>
                 <div className="text-xl font-mono text-red-400">{curDmg}</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                 <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Range</div>
                 <div className="text-xl font-mono text-blue-400">{stats.range}</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                 <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Speed</div>
                 <div className="text-xl font-mono text-yellow-400">{stats.speed}</div>
              </div>
           </div>

           <p className="text-sm text-slate-400 italic border-l-2 border-blue-500 pl-4 py-1">{stats.description}</p>
        </div>

        <div className="p-4 border-t border-white/5 bg-slate-900/80 shrink-0">
           {isUnlocked ? (
              gameState.screen === 'shop' ? (
                <button 
                  onClick={() => upgradeUnit(unitId)} 
                  disabled={gameState.coins < nextLvlCost || isAtMaxLevel} 
                  className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${isAtMaxLevel ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98]'}`}
                >
                  {isAtMaxLevel ? 'MAX LEVEL' : <><span>UPGRADE</span><span className="bg-black/20 px-2 py-0.5 rounded text-sm font-mono">${nextLvlCost}</span></>}
                </button>
              ) : (
                isEnemy ? (
                    <div className="w-full py-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 font-bold text-center flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                        <i className="fas fa-exclamation-triangle"></i> Competitor Analysis Only
                    </div>
                ) : (
                    <div className="text-center text-xs text-slate-500 font-mono uppercase tracking-widest">Asset Managed via Shop</div>
                )
              )
           ) : (
              <div className="w-full py-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 font-bold text-center flex items-center justify-center gap-2">
                 <i className="fas fa-lock"></i> LOCKED
              </div>
           )}
        </div>
      </div>
    );
  };
  
  const renderScreen = () => {
    switch(gameState.screen) {
      case 'menu':
        return (
            <ScreenWrapper className="justify-center items-center">
                <div className="relative z-10 flex flex-col items-center gap-12 w-full max-w-4xl px-6">
                    {/* Header */}
                    <div className="text-center space-y-2 animate-in slide-in-from-top duration-700">
                        <div className="text-blue-500 font-black tracking-[0.5em] text-xs uppercase mb-2">Internal Tools v{GAME_VERSION}</div>
                        <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]">
                            CORPORATE
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">UPRISING</span>
                        </h1>
                    </div>

                    {/* Main Dashboard Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full animate-in slide-in-from-bottom duration-700 delay-100">
                        {/* Featured: Campaign */}
                        <button 
                            onClick={() => setGameState(p => ({...p, screen: 'stages'}))}
                            className="md:col-span-3 group relative h-48 bg-gradient-to-r from-blue-900/40 to-slate-900/40 rounded-3xl border border-blue-500/30 hover:border-blue-400 transition-all overflow-hidden flex items-center justify-between p-8 shadow-2xl hover:shadow-blue-900/20"
                        >
                            <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
                            <div className="relative z-10 text-left">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    <span className="text-blue-300 font-bold text-xs tracking-widest uppercase">Active Operation</span>
                                </div>
                                <div className="text-4xl font-black italic text-white mb-1">CAMPAIGN</div>
                                <div className="text-slate-400 font-medium">Continue your hostile takeover.</div>
                            </div>
                            <div className="relative z-10 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/50">
                                <i className="fas fa-play"></i>
                            </div>
                        </button>

                        {/* Secondary Actions */}
                        <button onClick={() => setGameState(p => ({...p, screen: 'shop'}))} className="h-32 bg-slate-900/60 rounded-2xl border border-white/10 hover:bg-slate-800 hover:border-white/20 transition-all flex flex-col items-center justify-center gap-2 group">
                            <i className="fas fa-shopping-cart text-3xl text-slate-500 group-hover:text-white transition-colors"></i>
                            <span className="font-bold text-sm tracking-wide text-slate-300">ACQUISITIONS</span>
                        </button>
                        
                        <button onClick={() => setGameState(p => ({...p, screen: 'loadout'}))} className="h-32 bg-slate-900/60 rounded-2xl border border-white/10 hover:bg-slate-800 hover:border-white/20 transition-all flex flex-col items-center justify-center gap-2 group">
                            <i className="fas fa-users-cog text-3xl text-slate-500 group-hover:text-white transition-colors"></i>
                            <span className="font-bold text-sm tracking-wide text-slate-300">PERSONNEL</span>
                        </button>

                        <button onClick={() => setGameState(p => ({...p, screen: 'almanac'}))} className="h-32 bg-slate-900/60 rounded-2xl border border-white/10 hover:bg-slate-800 hover:border-white/20 transition-all flex flex-col items-center justify-center gap-2 group">
                            <i className="fas fa-database text-3xl text-slate-500 group-hover:text-white transition-colors"></i>
                            <span className="font-bold text-sm tracking-wide text-slate-300">ARCHIVES</span>
                        </button>
                    </div>

                    {/* Sandbox Button */}
                    <button 
                        onClick={() => startBattle(1, true)}
                        className="text-xs font-bold text-yellow-600 hover:text-yellow-400 uppercase tracking-widest border-b border-transparent hover:border-yellow-500 transition-all pb-1 animate-in fade-in delay-300"
                    >
                        <i className="fas fa-flask mr-2"></i> Enter Simulation Mode
                    </button>
                </div>
            </ScreenWrapper>
        );
      case 'stages':
        return (
            <ScreenWrapper>
                <div className="flex-none p-6 md:p-10">
                    <div className="flex items-center gap-4">
                        <button onClick={exitToMenu} className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400 hover:text-white"><i className="fas fa-arrow-left"></i></button>
                        <h1 className="text-4xl font-black italic tracking-tighter">OPERATIONS MAP</h1>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl">
                        {STAGE_CONFIG.map(stage => {
                            const isUnlocked = gameState.unlockedStages.includes(stage.id);
                            const isBeaten = gameState.unlockedStages.includes(stage.id + 1);
                            
                            return (
                                <button 
                                    key={stage.id}
                                    disabled={!isUnlocked}
                                    onClick={() => startBattle(stage.id)}
                                    className={`relative group rounded-3xl overflow-hidden text-left shadow-xl transition-all ${isUnlocked ? 'hover:scale-[1.02] hover:shadow-2xl' : 'opacity-60 grayscale cursor-not-allowed'}`}
                                >
                                    {/* Thumbnail Section */}
                                    <div className={`h-32 bg-gradient-to-br ${stage.color} relative overflow-hidden flex items-center justify-center`}>
                                        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                                        <i className={`${stage.icon} text-8xl text-white/20 absolute -right-4 -bottom-4 transform -rotate-12 group-hover:scale-110 transition-transform duration-500`}></i>
                                        <div className="relative z-10 text-4xl text-white drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                                            <i className={stage.icon}></i>
                                        </div>
                                        {isBeaten && (
                                            <div className="absolute top-3 left-3 bg-green-500 text-slate-900 text-[10px] font-black uppercase px-2 py-1 rounded-full shadow-lg z-20">
                                                <i className="fas fa-check mr-1"></i> Complete
                                            </div>
                                        )}
                                    </div>

                                    {/* Info Section */}
                                    <div className="bg-slate-900 p-4 border-t border-white/5 h-24 flex flex-col justify-center relative">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                                            Stage 0{stage.id}
                                        </div>
                                        <div className={`text-xl font-black italic leading-none mb-1 ${isUnlocked ? 'text-white' : 'text-slate-600'}`}>
                                            {stage.name}
                                        </div>
                                        <div className="text-xs text-slate-400 font-medium truncate">
                                            {stage.subtitle}
                                        </div>

                                        {!isUnlocked && (
                                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[1px] flex items-center justify-center">
                                                <i className="fas fa-lock text-slate-500 text-xl"></i>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </ScreenWrapper>
        );
      case 'shop':
      case 'loadout':
      case 'almanac':
        const isShop = gameState.screen === 'shop';
        const isLoadout = gameState.screen === 'loadout';
        return (
            <ScreenWrapper className="flex flex-col md:flex-row">
                {/* Left Sidebar: Navigation & List */}
                <div className="w-full h-[40%] md:h-full md:w-1/3 md:min-w-[320px] md:max-w-md border-b md:border-b-0 md:border-r border-white/5 bg-slate-900/80 backdrop-blur flex flex-col">
                    <div className="p-4 md:p-6 border-b border-white/5 shrink-0">
                        <div className="flex items-center gap-4 mb-4 md:mb-6">
                            <button onClick={exitToMenu} className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"><i className="fas fa-arrow-left"></i></button>
                            <h1 className="text-xl md:text-2xl font-black italic tracking-tighter truncate">{isShop ? 'ACQUISITIONS' : isLoadout ? 'LOADOUT' : 'ARCHIVES'}</h1>
                        </div>
                        {/* Tab Switcher - Quick nav between management screens */}
                        <div className="flex bg-slate-950 p-1 rounded-lg">
                            <button onClick={() => setGameState(p => ({...p, screen: 'shop'}))} className={`flex-1 py-1.5 md:py-2 rounded-md text-[10px] md:text-xs font-bold transition-all ${isShop ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>SHOP</button>
                            <button onClick={() => setGameState(p => ({...p, screen: 'loadout'}))} className={`flex-1 py-1.5 md:py-2 rounded-md text-[10px] md:text-xs font-bold transition-all ${isLoadout ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>LOADOUT</button>
                            <button onClick={() => setGameState(p => ({...p, screen: 'almanac'}))} className={`flex-1 py-1.5 md:py-2 rounded-md text-[10px] md:text-xs font-bold transition-all ${gameState.screen === 'almanac' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>DATA</button>
                        </div>
                        {isShop && (
                            <div className="mt-3 bg-blue-900/20 border border-blue-500/30 p-2 md:p-3 rounded-xl flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Budget</span>
                                <span className="text-lg md:text-xl font-mono font-black text-white">${gameState.coins.toLocaleString()}</span>
                            </div>
                        )}
                        
                        {gameState.screen === 'almanac' && (
                            <div className="flex bg-slate-950 p-1 rounded-lg mt-3">
                                <button onClick={() => { setAlmanacType('ally'); setSelectedUnitId(null); }} className={`flex-1 py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all ${almanacType === 'ally' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>ALLIES</button>
                                <button onClick={() => { setAlmanacType('enemy'); setSelectedUnitId(null); }} className={`flex-1 py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all ${almanacType === 'enemy' ? 'bg-red-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>HOSTILES</button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 custom-scrollbar">
                        {/* Loadout Specific: Active Squad Header */}
                        {isLoadout && (
                            <div className="mb-6">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-2">Active Squad ({gameState.loadout.length}/10)</div>
                                <div className="grid grid-cols-5 gap-2">
                                    {gameState.loadout.map((id, idx) => {
                                        const u = PLAYER_UNITS.find(unit => unit.id === id);
                                        if(!u) return null;
                                        return (
                                            <button key={idx} onClick={() => {
                                                const newL = [...gameState.loadout];
                                                newL.splice(idx, 1);
                                                setGameState(p => ({...p, loadout: newL}));
                                            }} className="aspect-square bg-slate-800 rounded-lg border border-blue-500/50 flex items-center justify-center relative group hover:border-red-500 transition-colors">
                                                <div className="scale-50"><BattlerVisual typeId={u.id} /></div>
                                                <div className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-lg"><i className="fas fa-times"></i></div>
                                            </button>
                                        )
                                    })}
                                    {Array(10 - gameState.loadout.length).fill(0).map((_, i) => (
                                        <div key={i} className="aspect-square bg-slate-950/50 rounded-lg border border-dashed border-slate-800 flex items-center justify-center">
                                            <i className="fas fa-plus text-slate-700 text-xs"></i>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* List Items */}
                        {(isShop ? 
                            [{id: 'bank_upgrade', name: 'Corporate Bank', icon: 'fas fa-chart-line', group: 'Infra'}, {id: 'starting_budget_upgrade', name: 'Startup Capital', icon: 'fas fa-briefcase', group: 'Infra'}, {id: 'cannon_upgrade', name: 'Orbital Cannon', icon: 'fas fa-meteor', group: 'Infra'}, ...PLAYER_UNITS.map(u => ({...u, group: 'Units'}))] 
                            : (gameState.screen === 'almanac' ? (almanacType === 'ally' ? PLAYER_UNITS : ENEMY_UNITS) : PLAYER_UNITS).map(u => ({...u, group: 'Units'}))
                        ).map((item: any) => {
                            const isSelected = selectedUnitId === item.id;
                            const isOwned = isShop || gameState.unlockedStages.includes(item.unlockLevel) || gameState.screen === 'almanac';
                            
                            // Loadout Logic
                            const isInLoadout = gameState.loadout.includes(item.id);
                            
                            return (
                                <button 
                                    key={item.id}
                                    onClick={() => {
                                        setSelectedUnitId(item.id);
                                        if (isLoadout && isOwned && !isInLoadout && gameState.loadout.length < 10) {
                                            setGameState(p => ({...p, loadout: [...p.loadout, item.id]}));
                                        }
                                        sounds.playClick();
                                    }}
                                    className={`w-full p-2 md:p-3 rounded-xl flex items-center gap-3 transition-all border ${isSelected ? 'bg-blue-600 border-blue-500 shadow-lg' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'}`}
                                >
                                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-base md:text-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-500'}`}>
                                        {item.icon ? <i className={item.icon}></i> : <div className="scale-50"><BattlerVisual typeId={item.id} isAlmanac={true} /></div>}
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <div className={`font-bold text-xs md:text-sm truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>{item.name}</div>
                                        <div className={`text-[9px] md:text-[10px] truncate ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>{item.group === 'Infra' ? 'Infrastructure' : 'Personnel Asset'}</div>
                                    </div>
                                    {isLoadout && isInLoadout && <div className="text-blue-400 text-xs"><i className="fas fa-check-circle"></i></div>}
                                    {!isOwned && !isShop && <div className="text-red-500 text-xs"><i className="fas fa-lock"></i></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Details */}
                <div className="flex-1 h-[60%] md:h-full bg-slate-950 relative overflow-hidden">
                    {renderUnitDetail(selectedUnitId)}
                </div>
            </ScreenWrapper>
        );
      case 'battle':
        return (
            <ScreenWrapper className="bg-slate-900">
                {/* Immersive HUD - Top - Added top padding for mobile safe areas */}
                <div className="absolute top-0 left-0 right-0 z-30 pt-12 px-4 pb-4 md:p-4 pointer-events-none flex justify-between items-start">
                    <div className="flex gap-4 pointer-events-auto">
                        <button onClick={exitToMenu} className="w-10 h-10 rounded-xl bg-slate-900/80 backdrop-blur border border-white/10 text-white flex items-center justify-center hover:bg-red-900/50 hover:border-red-500/50 transition-colors shadow-lg">
                            <i className="fas fa-pause"></i>
                        </button>
                        <div className="bg-slate-900/80 backdrop-blur px-4 py-2 rounded-xl border border-white/10 shadow-lg flex flex-col">
                            <span className="text-[10px] font-black uppercase text-green-400 tracking-widest">Budget</span>
                            <span className="text-2xl font-mono font-black text-white leading-none">${Math.floor(gameState.money)}</span>
                        </div>
                    </div>
                    
                    <div className="bg-slate-900/80 backdrop-blur px-6 py-2 rounded-xl border border-white/10 shadow-lg flex flex-col items-center">
                         <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Current Objective</span>
                         <span className="text-lg font-black italic text-white">{gameState.currentStage === 7 ? "BALLER'S RISE" : gameState.currentStage === 8 ? "BULLET HELL" : gameState.currentStage === 9 ? "NINE OF A KINDS" : gameState.currentStage === 10 ? "NO MERCY!" : `STAGE 0${gameState.currentStage}`}</span>
                    </div>

                    <div className="bg-slate-900/80 backdrop-blur px-4 py-2 rounded-xl border border-white/10 shadow-lg flex flex-col items-end pointer-events-auto">
                        <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Income Rate</span>
                        <div className="flex items-center gap-3">
                            <span className="text-xl font-mono font-black text-white leading-none">LVL {gameState.walletLevel + 1}</span>
                            <button 
                                onClick={upgradeWallet}
                                disabled={gameState.walletLevel >= WALLET_UPGRADE_COSTS.length || gameState.money < WALLET_UPGRADE_COSTS[gameState.walletLevel]}
                                className="w-8 h-8 rounded bg-yellow-600 hover:bg-yellow-500 flex items-center justify-center text-xs text-black font-bold shadow-lg disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
                            >
                                <i className="fas fa-arrow-up"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Viewport */}
                <div className="flex-1 relative">
                    <Battlefield 
                        units={gameState.units} 
                        playerBaseHp={gameState.playerBaseHp} 
                        enemyBaseHp={gameState.enemyBaseHp} 
                        maxBaseHp={500 + (gameState.currentStage - 1) * 1000} 
                        unitLevels={gameState.unitLevels} 
                        cannonEffect={cannonEffectActive} 
                        currentStage={gameState.currentStage}
                        isEnemyImmune={false} 
                    />
                    
                    {/* Sandbox Panel Overlay - Moved down to avoid top HUD */}
                    {gameState.sandboxMode && (
                        <div className={`absolute top-32 right-4 z-40 bg-slate-900/90 backdrop-blur border border-yellow-500/30 p-4 rounded-xl transition-all w-64 shadow-2xl ${showSandboxPanel ? 'translate-x-0' : 'translate-x-[120%]'}`}>
                            <div className="text-xs font-black text-yellow-500 uppercase tracking-widest mb-4 border-b border-yellow-500/20 pb-2 flex justify-between">
                                <span>Sandbox Tools</span>
                                <button onClick={() => setShowSandboxPanel(false)}><i className="fas fa-times"></i></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Spawn Hostile</div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {ENEMY_UNITS.map(u => (
                                            <button key={u.id} onClick={() => deploySandboxUnit(u.id, 'enemy')} className="aspect-square bg-slate-800 hover:bg-slate-700 rounded border border-white/10 flex items-center justify-center" title={u.name}>
                                                <div className="scale-[0.6]"><BattlerVisual typeId={u.id} /></div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => setGameState(p => ({...p, sandboxPaused: !p.sandboxPaused}))} className={`w-full py-2 rounded font-bold text-xs ${gameState.sandboxPaused ? 'bg-green-600 text-white' : 'bg-yellow-600 text-black'}`}>
                                    {gameState.sandboxPaused ? 'RESUME WAVES' : 'PAUSE WAVES'}
                                </button>
                            </div>
                        </div>
                    )}
                    {gameState.sandboxMode && !showSandboxPanel && (
                        <button onClick={() => setShowSandboxPanel(true)} className="absolute top-32 right-0 bg-yellow-600 text-black p-2 rounded-l-lg shadow-lg z-40"><i className="fas fa-tools"></i></button>
                    )}
                </div>

                {/* Bottom Deployment Tray */}
                <div className="h-32 md:h-40 bg-slate-950 border-t border-slate-800 z-30 flex items-center px-4 gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                    
                    {/* Cannon Control */}
                    <button 
                        onClick={fireCannon}
                        disabled={Date.now() < cannonReadyTime}
                        className="h-24 w-24 md:h-28 md:w-28 shrink-0 bg-slate-900 rounded-2xl border-2 border-slate-700 relative overflow-hidden group active:scale-95 transition-all shadow-inner hover:border-orange-500/50"
                    >
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 space-y-1">
                             <div className={`text-4xl transition-all ${Date.now() >= cannonReadyTime ? 'text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)] scale-110' : 'text-slate-700'}`}>
                                <i className="fas fa-meteor"></i>
                             </div>
                             <div className={`text-[10px] font-black uppercase tracking-widest ${Date.now() >= cannonReadyTime ? 'text-white' : 'text-slate-600'}`}>Cannon</div>
                        </div>
                        {/* Cooldown Overlay */}
                        {Date.now() < cannonReadyTime && (
                             <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center backdrop-blur-[1px]">
                                 <div className="text-xl font-mono font-black text-white">
                                    {Math.ceil((cannonReadyTime - Date.now()) / 1000)}
                                 </div>
                             </div>
                        )}
                        <div className="absolute bottom-0 left-0 h-1.5 bg-orange-500 transition-all duration-100 shadow-[0_0_10px_#f97316]" style={{ width: `${Math.min(100, Math.max(0, 100 - ((cannonReadyTime - Date.now()) / CANNON_COOLDOWN) * 100))}%` }}></div>
                    </button>

                    <div className="w-px h-20 bg-gradient-to-b from-transparent via-slate-700 to-transparent"></div>

                    {/* Unit Deck - Horizontal Scroll */}
                    <div className="flex-1 overflow-x-auto flex gap-3 h-full items-center pb-2 no-scrollbar pl-2">
                        {gameState.loadout.map(id => {
                            const unit = PLAYER_UNITS.find(u => u.id === id);
                            if(!unit) return null;
                            return (
                                <UnitCard 
                                    key={id} 
                                    unit={unit} 
                                    money={gameState.money} 
                                    unitLevel={gameState.unitLevels[id] || 1}
                                    isAltPreferred={gameState.preferredForms[id] ?? true}
                                    lastSpawnTime={unitLastSpawnTimes[id] || 0}
                                    onDeploy={(uid) => deployUnit('player', uid)}
                                />
                            )
                        })}
                    </div>
                </div>

                {/* Notifications Area */}
                <div className="absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-lg pointer-events-none flex flex-col items-center gap-2 z-20">
                    {gameState.battleLog.slice(0, 2).map((log, i) => (
                        <div key={i} className="bg-slate-900/90 backdrop-blur text-blue-100 text-xs px-4 py-2 rounded-full border border-blue-500/20 shadow-lg animate-in fade-in slide-in-from-top-4">
                             <span className="text-blue-400 font-bold mr-2">LOG:</span> {log}
                        </div>
                    ))}
                </div>

                {/* Game Over Screen */}
                {gameState.isGameOver && (
                    <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
                        <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-10 max-w-md w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
                             {/* Background Glow */}
                             <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${gameState.winner === 'player' ? 'from-green-500 via-emerald-400 to-green-500' : 'from-red-500 via-orange-500 to-red-500'}`}></div>
                             
                             <div className={`w-28 h-28 rounded-full flex items-center justify-center text-6xl mb-8 shadow-2xl ${gameState.winner === 'player' ? 'bg-gradient-to-br from-green-500 to-emerald-700 text-white' : 'bg-gradient-to-br from-red-500 to-orange-700 text-white'}`}>
                                 <i className={`fas ${gameState.winner === 'player' ? 'fa-trophy' : 'fa-skull'}`}></i>
                             </div>
                             
                             <h2 className="text-4xl font-black italic text-white mb-2 tracking-tight">{gameState.winner === 'player' ? 'VICTORY' : 'LIQUIDATED'}</h2>
                             <p className="text-slate-400 mb-8 font-medium">{gameState.winner === 'player' ? 'Hostile takeover successful. Market share increased.' : 'Your department has been downsized. Permanently.'}</p>
                             
                             {gameState.winner === 'player' && lastWinReward && (
                                <div className="bg-slate-950 rounded-xl p-4 w-full mb-8 border border-white/5">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Performance Bonus</div>
                                    <div className="flex items-center justify-center gap-2 text-3xl font-mono text-yellow-400 font-black tracking-tighter">
                                        <i className="fas fa-coins text-xl"></i> +{lastWinReward.coins}
                                    </div>
                                    {lastWinReward.isFirst && <div className="text-[10px] text-green-400 font-bold mt-2 uppercase tracking-widest bg-green-900/20 py-1 px-3 rounded-full inline-block">First Clear Bonus</div>}
                                </div>
                             )}

                             <div className="grid grid-cols-2 gap-4 w-full">
                                <button onClick={exitToMenu} className="bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold transition-all">RETURN TO HUB</button>
                                <button onClick={() => startBattle(gameState.currentStage, gameState.sandboxMode)} className="bg-white hover:bg-blue-50 text-slate-900 py-4 rounded-xl font-bold transition-all shadow-lg">RETRY</button>
                             </div>
                        </div>
                    </div>
                )}
            </ScreenWrapper>
        );
      default:
        return <div>Loading...</div>;
    }
  };

  return <div className="flex flex-col h-screen select-none font-sans bg-[#020617] text-slate-100 overflow-hidden">
      <style>{`
        /* Animation Keyframes */
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes pulse-slow { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.2; } }
        
        /* Unit Animations */
        @keyframes idle-sway { 0%, 100% { transform: translateX(0) rotate(0deg); } 50% { transform: translateX(2px) rotate(2deg); } }
        @keyframes idle-aggressive { 0%, 100% { transform: scale(1) translateY(0); } 25% { transform: scale(1.05) translateY(-2px); } 75% { transform: scale(0.98) translateY(1px); } }
        @keyframes idle-fidget { 0%, 100% { transform: rotate(0deg); } 10% { transform: rotate(-3deg); } 20% { transform: rotate(3deg); } 30% { transform: rotate(0deg); } }
        @keyframes idle-breathing { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.04) translateY(-1px); } }
        @keyframes idle-gentle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes hammer-hit { 0% { transform: translate(-50%, 0) rotate(0deg); opacity: 0; } 20% { opacity: 1; } 50% { transform: translate(-50%, 10px) rotate(-45deg); } 100% { transform: translate(-50%, 0) rotate(0deg); opacity: 0; } }
        @keyframes battler-lunge { 0% { transform: translateX(0); } 50% { transform: translateX(15px); } 100% { transform: translateX(0); } }
        @keyframes double-punch { 0% { transform: translateX(0); } 25% { transform: translateX(12px); } 50% { transform: translateX(4px); } 75% { transform: translateX(16px); } 100% { transform: translateX(0); } }
        @keyframes unit-recoil { 0% { transform: translateX(0); } 50% { transform: translateX(-5px); } 100% { transform: translateX(0); } }
        @keyframes slash-animation { 0% { transform: scale(0) rotate(-45deg); opacity: 0; } 20% { transform: scale(1.5) rotate(45deg); opacity: 1; } 100% { transform: scale(1.2) rotate(60deg); opacity: 0; } }
        @keyframes idle-baller { 0% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-3px) rotate(-2deg); } 50% { transform: translateY(0) rotate(0deg); } 75% { transform: translateY(-1px) rotate(2deg); } 100% { transform: translateY(0) rotate(0deg); } }
        @keyframes idle-boss { 0%, 100% { transform: scale(1.5); } 50% { transform: scale(1.55); } }
        @keyframes vibrate { 0% { transform: translate(0); } 20% { transform: translate(-2px, 2px); } 40% { transform: translate(-2px, -2px); } 60% { transform: translate(2px, 2px); } 80% { transform: translate(2px, -2px); } 100% { transform: translate(0); } }

        /* Classes */
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-idle-sway { animation: idle-sway 2.5s ease-in-out infinite; }
        .animate-idle-aggressive { animation: idle-aggressive 1.5s ease-in-out infinite; }
        .animate-idle-fidget { animation: idle-fidget 4s ease-in-out infinite; }
        .animate-idle-breathing { animation: idle-breathing 2s ease-in-out infinite; }
        .animate-idle-gentle { animation: idle-gentle 3s ease-in-out infinite; }
        .animate-hammer-hit { animation: hammer-hit 0.5s ease-in-out infinite; }
        .animate-battler-lunge { animation: battler-lunge 0.2s ease-out; }
        .animate-double-punch { animation: double-punch 0.3s ease-in-out; }
        .recoil { animation: unit-recoil 0.1s ease-in-out; }
        .slash-effect { animation: slash-animation 0.3s ease-out forwards; }
        .animate-idle-baller { animation: idle-baller 0.8s ease-in-out infinite; }
        .animate-idle-boss { animation: idle-boss 2s ease-in-out infinite; }
        .animate-vibrate { animation: vibrate 0.1s linear infinite; }

        /* Utilities */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      {renderScreen()}
      <GameAssistant gameState={gameState} />
  </div>;
}
