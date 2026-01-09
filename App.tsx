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
  BOSS_CLEAR_MULTIPLIER,
  GAME_VERSION, 
  STARTING_BUDGET_GAIN_PER_LEVEL, 
  STARTING_BUDGET_UPGRADE_BASE_COST, 
  STARTING_BUDGET_UPGRADE_COST_MULTIPLIER,
  STAGE_CONFIG,
  BOSS_STAGE_IDS,
  GACHA_COST
} from './constants';
import { generateBattleCommentary } from './services/geminiService';
import { sounds } from './services/soundService';
import { StageSelectionScreen, evaluateStageSpawns } from './stage';
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
    'bh_level', 'bh_xp', 'bh_coins', 'bh_diamonds', 'bh_unit_levels', 
    'bh_preferred_forms', 'bh_loadout', 'bh_stages', 'bh_boss_claims',
    'bh_cannon_level', 'bh_bank_level', 'bh_starting_budget_level', 'bh_version',
    'bh_pity'
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

const BattlerVisual: React.FC<{ 
  typeId?: string,
  isHeavy?: boolean, 
  isAttacking?: boolean, 
  hasHat?: boolean, 
  size?: 'sm' | 'md' | 'lg',
  lastAbilityTime?: number,
  isAltForm?: boolean,
  isAlmanac?: boolean,
  hasThrownShotgun?: boolean,
  hasThrownCake?: boolean,
  isStunned?: boolean
}> = ({ typeId, isHeavy, isAttacking, hasHat, size = 'md', lastAbilityTime, isAltForm, isAlmanac, hasThrownShotgun, hasThrownCake, isStunned }) => {
  const scale = size === 'sm' ? 'scale-75' : size === 'lg' ? 'scale-125' : 'scale-100';
  const isAlly = typeId && !typeId.startsWith('e_');
  const now = Date.now();
  
  const isConstructing = typeId === 'e_builder' && lastAbilityTime && (now - lastAbilityTime < 1500);
  const isSlamming = typeId === 'e_boss_shotgunner' && lastAbilityTime && (now - lastAbilityTime < 1000);
  const isThrowingCake = typeId === 'e_cake_thrower' && lastAbilityTime && (now - lastAbilityTime < 600);
  const isThrowingCola = typeId === 'cola_thrower' && isAttacking;
  
  // --- HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP ---

  const idleAnimationClass = useMemo(() => {
    if (!isAlmanac && !isStunned) return '';
    if (isStunned) return ''; // No idle anim when stunned
    switch(typeId) {
      case 'e_battler': return 'animate-idle-sway';
      case 'e_rage_battler': return 'animate-idle-aggressive';
      case 'e_double_puncher': return 'animate-idle-aggressive';
      case 'e_fourth_puncher': return 'animate-idle-aggressive';
      case 'e_builder': return 'animate-idle-fidget';
      case 'e_pistoler': return 'animate-idle-breathing';
      case 'e_baller': return 'animate-idle-baller';
      case 'e_boss_shotgunner': return 'animate-idle-boss';
      case 'e_cake_thrower': return 'animate-idle-sway';
      case 'e_enforcer': return 'animate-idle-aggressive';
      case 'cola_thrower': return 'animate-idle-fidget';
      case 'retro_battler': return 'animate-step-jump'; 
      case 'grappler': return 'animate-idle-breathing';
      case 'megaphone': return 'animate-idle-breathing';
      case 'e_tactical_trooper': return 'animate-idle-breathing';
      case 'e_sniper': return 'animate-idle-gentle';
      case 'e_heavy_gunner': return 'animate-idle-aggressive';
      default: return 'animate-idle-gentle';
    }
  }, [typeId, isAlmanac, isStunned]);

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
      case 'e_pistoler': 
        if (typeId === 'pistoler' && isAltForm) {
            return (
              <>
                 <div className={`absolute -right-4 top-3 w-8 h-3 bg-zinc-900 rounded-sm border border-zinc-600 transition-transform ${isAttacking ? 'translate-x-1' : ''}`}>
                    <div className="absolute top-1 left-2 w-1.5 h-3 bg-black/60 rounded-sm"></div>
                 </div>
                 {isAttacking && (
                    <div className="absolute -right-8 top-2.5 w-6 h-4 bg-yellow-400/80 blur-[2px] rounded-full animate-pulse z-20"></div>
                 )}
              </>
            );
        }
        return (
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
      case 'grappler': return (
        <>
           {/* Head Visor */}
           <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-4 bg-slate-500 rounded-sm border border-slate-400 shadow-sm z-10">
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-cyan-400 shadow-[0_0_5px_cyan]"></div>
           </div>
           
           {/* Grappling Hooks */}
           {/* Arm 1 (Right) */}
           <div className={`absolute top-2 -right-4 w-10 h-2 bg-slate-600 rounded-full origin-left transition-transform duration-200 ${isAttacking ? 'scale-x-150' : 'rotate-12'}`}>
              <div className="absolute -right-1 top-[-3px] w-3 h-3 border-2 border-slate-300 rounded-full border-l-transparent rotate-45"></div>
           </div>

           {/* Arm 2 (Left) - Only for Alt Form */}
           {isAltForm && (
             <div className={`absolute top-2 -left-4 w-10 h-2 bg-slate-600 rounded-full origin-right transition-transform duration-200 ${isAttacking ? 'scale-x-150' : '-rotate-12'}`}>
                <div className="absolute -left-1 top-[-3px] w-3 h-3 border-2 border-slate-300 rounded-full border-r-transparent -rotate-45"></div>
             </div>
           )}
        </>
      );
      case 'megaphone': return (
        <>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-gray-300 rounded-full border border-gray-500 z-10 flex items-center justify-center">
                <i className={`fas fa-bullhorn text-xs ${isAltForm ? 'text-red-500' : 'text-slate-700'}`}></i>
            </div>
            {isAttacking && (
                <div className={`absolute top-0 ${isAlly ? '-right-8' : '-left-8'} w-8 h-8 opacity-50 animate-ping`}>
                    <i className="fas fa-rss text-yellow-400"></i>
                </div>
            )}
        </>
      );
      case 'cola_thrower':
        if (isAltForm) {
            // Cola Spray: Backpack with hose
            return (
                <>
                   <div className="absolute top-1 -left-3 w-4 h-6 bg-red-800 rounded-sm border border-red-600 -z-10"></div>
                   <div className={`absolute top-3 -right-4 w-8 h-2 bg-black rounded-full origin-left ${isAttacking ? 'animate-vibrate' : ''}`}>
                      <div className="absolute right-0 top-0 w-1 h-2 bg-gray-400"></div>
                      {isAttacking && (
                          <div className="absolute right-0 top-[-4px] w-6 h-4 bg-red-500/50 blur-sm animate-pulse rounded-full"></div>
                      )}
                   </div>
                </>
            );
        }
        // Base Form: Throwing Bottle
        return (
            <>
               <div className={`absolute top-0 -right-2 w-3 h-8 bg-red-900/80 rounded-sm border border-red-500 transition-transform duration-500 ${isAttacking ? 'translate-x-6 -translate-y-4 rotate-[360deg] opacity-0' : 'rotate-12'}`}>
                  <div className="absolute top-1 left-0 right-0 h-2 bg-white/50"></div>
               </div>
               {isAttacking && (
                  <div className="absolute top-0 right-4 w-4 h-10 bg-red-600 rounded-full animate-spin z-20 blur-[1px]"></div>
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
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-2.5 bg-orange-500 rounded-t-full z-10 border border-orange-700 shadow-sm"></div>
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
      case 'e_fourth_puncher': return (
        <>
          {/* Hat/Headgear to distinguish from Double Puncher */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-2 bg-slate-800 rounded-sm z-10 border border-slate-600"></div>
          
          {/* Back Arms - Positioned behind torso (-z-10) and tighter to body */}
          <div className={`absolute top-2 left-0 w-2 h-8 bg-[#7f1d1d] border border-black/30 rounded-bl-full origin-top-right -z-10 transition-transform ${isAttacking ? '-rotate-[135deg] translate-x-1' : '-rotate-45'}`}></div>
          <div className={`absolute top-2 right-0 w-2 h-8 bg-[#7f1d1d] border border-black/30 rounded-br-full origin-top-left -z-10 transition-transform ${isAttacking ? 'rotate-[135deg] -translate-x-1' : 'rotate-45'}`}></div>
        </>
      );
      case 'e_cake_thrower': return (
        <>
           {/* Chef Hat */}
           <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full border border-gray-200 z-10"></div>
           <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white rounded-sm border-x border-gray-200 z-10"></div>
           
           {/* The Cake (Held) */}
           {!hasThrownCake && (
             <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 bg-pink-400 border-2 border-pink-600 rounded z-20 shadow-lg flex items-center justify-center">
                <div className="w-6 h-6 bg-pink-300 rounded-sm border border-pink-400/50"></div>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-2 bg-red-500 rounded-full"></div>
             </div>
           )}

           {/* The Cake (Projectile) */}
           {isThrowingCake && (
             <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 bg-pink-400 border-2 border-pink-600 rounded z-30 shadow-xl flex items-center justify-center animate-cake-projectile">
                <div className="w-6 h-6 bg-pink-300 rounded-sm border border-pink-400/50"></div>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-2 bg-red-500 rounded-full"></div>
             </div>
           )}
        </>
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
      case 'e_enforcer': return (
        <>
           {/* Hood/Head */}
           <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-zinc-800 rounded-full z-10 shadow-sm"></div>
           <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-2 bg-black/80 z-20 skew-y-6"></div> {/* Bandana Mask */}
           
           {/* Jacket Body */}
           <div className="absolute top-1 left-1/2 -translate-x-1/2 w-7 h-7 bg-zinc-900 rounded-t-md z-0 border-x border-zinc-700"></div>
           
           {/* Chain */}
           <div className="absolute top-6 left-1/2 -translate-x-1/2 w-6 h-4 border-b-2 border-dashed border-gray-400 rounded-full"></div>

           {/* Weapon: Pipe */}
           <div className={`absolute top-2 -right-4 w-10 h-1.5 bg-gray-400 border border-gray-600 rounded-full origin-left transition-transform ${isAttacking ? 'rotate-[-20deg] translate-y-4' : '-rotate-[100deg]'}`}></div>
        </>
      );
      case 'e_tactical_trooper': return (
        <>
           {/* Helmet */}
           <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-5 bg-emerald-900 rounded-t-md z-10 border border-emerald-950">
              <div className="absolute bottom-1 left-0 right-0 h-1 bg-black opacity-50"></div>
           </div>
           {/* Night Vision Goggles (Up) */}
           <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-2 bg-black border border-green-500 rounded-sm z-20">
              <div className="flex justify-center gap-0.5 h-full items-center">
                  <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-green-400 rounded-full"></div>
              </div>
           </div>
           
           {/* Rifle */}
           <div className={`absolute top-3 -left-5 w-12 h-2.5 bg-black rounded-sm border border-zinc-700 origin-right transition-transform ${isAttacking ? 'translate-x-1' : ''}`}>
               <div className="absolute -left-1 top-0 w-1 h-2.5 bg-zinc-500"></div> {/* Muzzle */}
               <div className="absolute right-2 top-2.5 w-1 h-2 bg-black"></div> {/* Mag */}
           </div>
        </>
      );
      case 'e_sniper': return (
        <>
           {/* Hood */}
           <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 bg-stone-800 rounded-full z-10 shadow-sm border border-stone-900"></div>
           <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-2 bg-black z-20"></div> {/* Mask */}
           
           {/* Long Rifle */}
           <div className={`absolute top-2 -left-8 w-16 h-2 bg-stone-900 border border-black origin-right transition-transform ${isAttacking ? '-translate-x-2' : ''}`}>
              <div className="absolute left-4 -top-2 w-4 h-1 bg-black"></div> {/* Scope */}
              <div className="absolute -left-1 top-[-1px] w-2 h-3 bg-black"></div> {/* Muzzle Brake */}
           </div>
           
           {/* Ghillie bits */}
           <div className="absolute top-0 -right-2 w-3 h-6 bg-stone-700/80 rounded-full -z-10 rotate-12"></div>
        </>
      );
      case 'e_heavy_gunner': return (
        <>
           {/* Heavy Helmet */}
           <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-7 h-7 bg-slate-800 rounded-sm border-2 border-slate-600 z-10">
               <div className="absolute top-2 left-1/2 -translate-x-1/2 w-5 h-1.5 bg-black/80"></div> {/* Visor slit */}
           </div>
           
           {/* Minigun */}
           <div className={`absolute top-3 -left-6 w-12 h-6 bg-slate-900 rounded-lg border border-slate-600 origin-right ${isAttacking ? 'animate-vibrate' : ''}`}>
               <div className="absolute -left-2 top-1 w-2 h-4 bg-slate-500 border border-black animate-spin"></div> {/* Barrels */}
               <div className="absolute right-0 top-6 w-8 h-8 bg-yellow-900/50 rounded-full -z-10 blur-sm"></div> {/* Ammo Box hint */}
           </div>
           
           {/* Armor Padding */}
           <div className="absolute top-0 -left-3 w-4 h-8 bg-slate-700 rounded-sm -z-10"></div>
           <div className="absolute top-0 -right-3 w-4 h-8 bg-slate-700 rounded-sm -z-10"></div>
        </>
      );
      default: return null;
    }
  }, [typeId, isAttacking, isConstructing, isAltForm, hasThrownShotgun, hasThrownCake, isThrowingCake, isAlly]);

  // --- CONDITIONAL RETURNS MUST BE AFTER HOOKS ---

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

  // Special Rendering for Retro Battler (8-bit)
  if (typeId === 'retro_battler') {
      const isGunner = isAltForm;
      return (
        <div className={`relative transition-transform duration-100 ${scale} ${isAttacking ? 'animate-vibrate' : idleAnimationClass}`}>
            {isStunned && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-4 flex justify-center gap-1 z-30">
                   <div className="w-2 h-2 bg-yellow-400 animate-spin"></div>
                   <div className="w-2 h-2 bg-yellow-400 animate-spin delay-75"></div>
                </div>
            )}
            
            <div className="flex flex-col items-center">
                {/* 8-bit Head */}
                <div className="w-6 h-6 bg-[#fccb95] border-4 border-black relative z-10 box-border">
                   {isGunner && <div className="absolute top-1 left-0 w-full h-2 bg-black opacity-80"></div>} {/* Sunglasses */}
                   {!isGunner && (
                       <>
                           <div className="absolute top-2 left-1 w-1 h-1 bg-black"></div>
                           <div className="absolute top-2 right-1 w-1 h-1 bg-black"></div>
                       </>
                   )}
                </div>
                {/* 8-bit Torso */}
                <div className={`w-6 h-5 ${isGunner ? 'bg-purple-600' : 'bg-green-600'} border-x-4 border-black relative box-border`}>
                   {/* Belt */}
                   <div className="absolute bottom-0 w-full h-1 bg-black/50"></div>
                </div>
                {/* 8-bit Legs */}
                <div className="flex gap-1">
                   <div className="w-2 h-3 bg-blue-800 border-4 border-black border-t-0 box-border"></div>
                   <div className="w-2 h-3 bg-blue-800 border-4 border-black border-t-0 box-border"></div>
                </div>
            </div>

            {/* Weapons */}
            {isGunner ? (
                // Pixel Gun
                <div className={`absolute top-4 -right-5 w-6 h-3 bg-gray-400 border-2 border-black origin-left ${isAttacking ? 'translate-x-1' : ''}`}>
                    <div className="absolute -top-1 right-0 w-1 h-2 bg-black"></div>
                    {isAttacking && <div className="absolute right-[-4px] top-0 w-2 h-2 bg-yellow-400"></div>}
                </div>
            ) : (
                // Pixel Sword
                <div className={`absolute top-2 -right-5 w-2 h-8 bg-gray-300 border-2 border-black origin-bottom transition-transform ${isAttacking ? 'rotate-90' : 'rotate-12'}`}>
                   <div className="absolute top-0 -left-1 w-4 h-1 bg-gray-300 border-2 border-black"></div>
                   <div className="absolute bottom-0 left-0 w-full h-2 bg-amber-800"></div>
                </div>
            )}
        </div>
      );
  }

  return (
    <div className={`relative transition-transform duration-150 ${scale} ${isHeavy || typeId === 'e_boss_shotgunner' || typeId === 'e_fourth_puncher' ? 'scale-125' : ''} ${isSlamming ? 'animate-boss-slam' : isAttacking ? (isHeavy ? 'animate-double-punch' : 'animate-battler-lunge') : idleAnimationClass}`}>
      {/* Stun Effect */}
      {isStunned && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-4 flex justify-center gap-1 z-30 animate-pulse">
           <i className="fas fa-star text-yellow-400 text-xs animate-spin" style={{ animationDuration: '1s' }}></i>
           <i className="fas fa-star text-yellow-400 text-sm animate-spin" style={{ animationDuration: '1.2s' }}></i>
           <i className="fas fa-star text-yellow-400 text-xs animate-spin" style={{ animationDuration: '0.8s' }}></i>
        </div>
      )}
      
      {accessories}
      {typeId !== 'e_rage_battler' && typeId !== 'e_boss_shotgunner' && (
        <>
          <div className="w-4 h-4 bg-yellow-400 rounded-sm mx-auto mb-[-1px] shadow-sm relative z-0"></div>
          <div className="flex items-center relative z-0">
            <div className={`w-2 h-6 bg-blue-600 rounded-l-sm transition-transform ${isAttacking ? 'translate-x-1' : ''}`}></div>
            <div className={`w-6 h-7 ${isAltForm && typeId === 'sworder' ? 'bg-zinc-800' : typeId === 'e_baller' || typeId === 'e_cake_thrower' ? 'bg-purple-600' : typeId === 'e_enforcer' ? 'bg-zinc-800' : isAlly ? 'bg-[#b91c1c]' : 'bg-[#dc2626]'} shadow-inner border-x border-black/10`}></div>
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

const UnitHpBar: React.FC<{ unit: ActiveUnit, unitLevels: Record<string, number>, currentStage: number }> = ({ unit, unitLevels, currentStage }) => {
    const type = (unit.side === 'player' ? PLAYER_UNITS : ENEMY_UNITS).find(t => t.id === unit.typeId);
    if (!type) return null;

    let maxHp = type.hp;
    if (unit.side === 'player') {
        const level = unitLevels[unit.typeId] || 1;
        const isAlt = unit.isAltForm && !!type.altForm;
        const stats = isAlt ? type.altForm! : type;
        maxHp = stats.hp * (1 + (level - 1) * STAT_GAIN_PER_LEVEL);
    } else {
        let hpScaling = 1.0;
        if (unit.typeId === 'e_battler' && currentStage === 1) hpScaling = 0.75;
        if (currentStage === 9) hpScaling = 0.98;
        if (currentStage >= 11) hpScaling = 1.05;
        maxHp = type.hp * hpScaling;
    }
    
    if (unit.typeId === 'e_boss_shotgunner') maxHp = 6563; 

    const pct = Math.max(0, Math.min(100, (unit.currentHp / maxHp) * 100));
    
    return (
        <div className="w-full h-full bg-slate-700">
            <div className={`h-full ${unit.side === 'player' ? 'bg-green-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }}></div>
        </div>
    );
};

const Battlefield: React.FC<{
  units: ActiveUnit[];
  playerBaseHp: number;
  enemyBaseHp: number;
  maxBaseHp: number;
  unitLevels: Record<string, number>;
  cannonEffect: boolean;
  currentStage: number;
  isEnemyImmune: boolean;
}> = ({ units, playerBaseHp, enemyBaseHp, maxBaseHp, unitLevels, cannonEffect, currentStage, isEnemyImmune }) => {
  const playerHpPercent = Math.max(0, (playerBaseHp / maxBaseHp) * 100);
  const enemyHpPercent = Math.max(0, (enemyBaseHp / maxBaseHp) * 100);

  return (
    <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-slate-900">
             <div className="absolute bottom-0 w-full h-1/2 bg-[linear-gradient(to_bottom,transparent_0%,rgba(30,58,138,0.2)_100%)]"></div>
             <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        </div>
        
        <div className="absolute inset-0 flex items-end pb-32 md:pb-40 px-4 md:px-10">
            <div className="relative w-full h-40 md:h-56">
                
                {/* Player Base */}
                <div className="absolute left-0 bottom-0 z-10 flex flex-col items-center group">
                    <div className="mb-2 relative">
                        <div className="w-24 h-3 bg-slate-800 rounded-full border border-slate-600 overflow-hidden">
                            <div className="h-full bg-green-500 transition-all duration-300" style={{width: `${playerHpPercent}%`}}></div>
                        </div>
                        <div className="text-[9px] font-bold text-white text-center absolute -top-4 w-full text-shadow">{Math.floor(playerBaseHp)} HP</div>
                    </div>
                    <div className="w-16 h-32 md:w-24 md:h-40 bg-slate-800 border-2 border-blue-500 rounded-t-xl relative shadow-[0_0_30px_rgba(59,130,246,0.3)] flex items-end justify-center">
                        <div className="absolute inset-0 bg-blue-900/20"></div>
                        <div className="text-4xl text-blue-500/50 mb-4"><i className="fas fa-building"></i></div>
                    </div>
                </div>

                {/* Enemy Base */}
                <div className="absolute right-0 bottom-0 z-10 flex flex-col items-center">
                    <div className="mb-2 relative">
                        <div className="w-24 h-3 bg-slate-800 rounded-full border border-slate-600 overflow-hidden">
                            <div className="h-full bg-red-500 transition-all duration-300" style={{width: `${enemyHpPercent}%`}}></div>
                        </div>
                         <div className="text-[9px] font-bold text-white text-center absolute -top-4 w-full text-shadow">{Math.ceil(enemyBaseHp)} HP</div>
                    </div>
                    <div className={`w-16 h-32 md:w-24 md:h-40 bg-slate-800 border-2 border-red-500 rounded-t-xl relative shadow-[0_0_30px_rgba(239,68,68,0.3)] flex items-end justify-center ${isEnemyImmune ? 'opacity-50' : ''}`}>
                         <div className="absolute inset-0 bg-red-900/20"></div>
                         <div className="text-4xl text-red-500/50 mb-4"><i className="fas fa-industry"></i></div>
                    </div>
                </div>

                {/* Units Layer */}
                <div className="absolute inset-x-16 md:inset-x-24 bottom-0 h-full pointer-events-none">
                    {units.map(unit => {
                        const leftPercent = (unit.x / FIELD_WIDTH) * 100;
                        const isEnemy = unit.side === 'enemy';
                        
                        return (
                            <div 
                                key={unit.instanceId} 
                                className="absolute bottom-0 transition-all duration-100 ease-linear will-change-transform"
                                style={{ 
                                    left: `${leftPercent}%`, 
                                    transform: `translateX(-50%)`, 
                                    zIndex: Math.floor(unit.x) 
                                }}
                            >
                                <div className={`relative ${isEnemy ? 'scale-x-[-1]' : ''}`}>
                                    {/* HP Bar */}
                                    <div className={`absolute -top-8 left-1/2 -translate-x-1/2 w-8 h-1 bg-black/50 rounded-full overflow-hidden ${isEnemy ? 'scale-x-[-1]' : ''}`}>
                                        <UnitHpBar unit={unit} unitLevels={unitLevels} currentStage={currentStage} />
                                    </div>
                                    
                                    <BattlerVisual 
                                        typeId={unit.typeId} 
                                        isAttacking={Date.now() - unit.lastAttackTime < 300}
                                        lastAbilityTime={unit.lastAbilityTime}
                                        isAltForm={unit.isAltForm}
                                        hasThrownShotgun={unit.hasThrownShotgun}
                                        hasThrownCake={unit.hasThrownCake}
                                        isStunned={!!(unit.stunnedUntil && unit.stunnedUntil > Date.now())}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {cannonEffect && (
            <div className="absolute inset-0 z-40 bg-orange-500/20 flex items-center justify-center animate-pulse pointer-events-none">
                 <div className="absolute top-0 w-full h-full bg-gradient-to-b from-orange-500/50 to-transparent"></div>
            </div>
        )}
    </div>
  );
};

export default function App() {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [almanacType, setAlmanacType] = useState<'enemy' | 'ally'>('enemy');
  const [cannonReadyTime, setCannonReadyTime] = useState<number>(0);
  const [cannonEffectActive, setCannonEffectActive] = useState<boolean>(false);
  const [lastWinReward, setLastWinReward] = useState<{coins: number, diamonds: number, isFirst: boolean} | null>(null);
  const [unitLastSpawnTimes, setUnitLastSpawnTimes] = useState<Record<string, number>>({});
  const [showSandboxPanel, setShowSandboxPanel] = useState(false);
  const [bossSpawned, setBossSpawned] = useState(false);
  
  // Gacha State
  const [gachaResult, setGachaResult] = useState<{ unitId: string, isUnlock: boolean, rarity: string } | null>(null);
  const [isGachaRolling, setIsGachaRolling] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setDeferredPrompt(null);
      }
    }
  };
  
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedVersion = getCookie('bh_version');
    if (savedVersion !== GAME_VERSION) {
      clearAllGameData();
    }

    const savedLevel = getCookie('bh_level');
    const savedXP = getCookie('bh_xp');
    const savedUnitLevels = getCookie('bh_unit_levels');
    const savedPreferredForms = getCookie('bh_preferred_forms');
    const savedLoadout = getCookie('bh_loadout');
    const savedCannonLevel = getCookie('bh_cannon_level');
    const savedBankLevel = getCookie('bh_bank_level');
    const savedStartingBudgetLevel = getCookie('bh_starting_budget_level');
    const savedDiamonds = getCookie('bh_diamonds');
    const savedBossClaims = getCookie('bh_boss_claims');
    const savedPity = getCookie('bh_pity');
    
    // Default Unit Levels
    const initialUnitLevels = PLAYER_UNITS.reduce((acc, unit) => {
        acc[unit.id] = unit.unlockLevel === 1 ? 1 : 0; // Only unlock baby initially
        if (unit.id === 'cola_thrower') acc[unit.id] = 0; // Explicitly locked
        if (unit.id === 'retro_battler') acc[unit.id] = 0; // Explicitly locked
        if (unit.id === 'grappler') acc[unit.id] = 0;
        if (unit.id === 'megaphone') acc[unit.id] = 0;
        return acc;
    }, {} as Record<string, number>);

    return {
      screen: 'menu',
      money: INITIAL_MONEY,
      coins: 9999999999999999, // FOR TESTING: 9 Quadrillion (ish)
      diamonds: 1000000, // FOR TESTING: 1 Million Diamonds
      walletLevel: 0,
      playerBaseHp: 500,
      enemyBaseHp: 500,
      units: [],
      isGameOver: false,
      winner: null,
      battleLog: ["System initialized."],
      playerLevel: savedLevel ? parseInt(savedLevel) : 1,
      playerXP: savedXP ? parseInt(savedXP) : 0,
      unitLevels: savedUnitLevels ? JSON.parse(savedUnitLevels) : initialUnitLevels,
      preferredForms: savedPreferredForms ? JSON.parse(savedPreferredForms) : {},
      loadout: savedLoadout ? JSON.parse(savedLoadout) : ['baby'],
      unlockedStages: STAGE_CONFIG.map(s => s.id), // FOR TESTING: Unlock All Stages
      claimedBossStages: savedBossClaims ? JSON.parse(savedBossClaims) : [],
      currentStage: 1,
      cannonLevel: savedCannonLevel ? parseInt(savedCannonLevel) : 1,
      bankLevel: savedBankLevel ? parseInt(savedBankLevel) : 1,
      startingBudgetLevel: savedStartingBudgetLevel ? parseInt(savedStartingBudgetLevel) : 1,
      baseHealthLevel: 1,
      sandboxMode: false,
      sandboxPaused: false,
      pityCounter: savedPity ? parseInt(savedPity) : 0
    };
  });

  useEffect(() => {
    setCookie('bh_version', GAME_VERSION);
    setCookie('bh_level', gameState.playerLevel.toString());
    setCookie('bh_xp', gameState.playerXP.toString());
    setCookie('bh_coins', gameState.coins.toString());
    setCookie('bh_diamonds', gameState.diamonds.toString());
    setCookie('bh_unit_levels', JSON.stringify(gameState.unitLevels));
    setCookie('bh_preferred_forms', JSON.stringify(gameState.preferredForms));
    setCookie('bh_loadout', JSON.stringify(gameState.loadout));
    setCookie('bh_stages', JSON.stringify(gameState.unlockedStages));
    setCookie('bh_boss_claims', JSON.stringify(gameState.claimedBossStages));
    setCookie('bh_cannon_level', gameState.cannonLevel.toString());
    setCookie('bh_bank_level', gameState.bankLevel.toString());
    setCookie('bh_starting_budget_level', gameState.startingBudgetLevel.toString());
    setCookie('bh_pity', gameState.pityCounter.toString());
  }, [gameState.playerLevel, gameState.playerXP, gameState.coins, gameState.diamonds, gameState.unitLevels, gameState.preferredForms, gameState.loadout, gameState.unlockedStages, gameState.claimedBossStages, gameState.cannonLevel, gameState.bankLevel, gameState.startingBudgetLevel, gameState.pityCounter]);

  // --- Theme Music Controller ---
  useEffect(() => {
    if (gameState.screen === 'battle' && !gameState.isGameOver) {
      if (gameState.currentStage === 10) {
        sounds.startBattleTheme('boss');
      } else if (gameState.currentStage >= 11) {
        sounds.startBattleTheme('electronic');
      } else {
        sounds.startBattleTheme('normal');
      }
    } else {
      sounds.stopBattleTheme();
    }
    
    return () => {
      // Cleanup on unmount (though this app stays mounted mostly)
      if (gameState.screen !== 'battle') sounds.stopBattleTheme();
    };
  }, [gameState.screen, gameState.isGameOver, gameState.currentStage]);

  const isUnitUnlocked = (unit: UnitType) => {
      // Special logic for Gacha units
      if (unit.unlockLevel >= 100) {
          return (gameState.unitLevels[unit.id] || 0) > 0;
      }
      return gameState.unlockedStages.includes(unit.unlockLevel);
  }

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
  const enemyCooldownsRef = useRef<Record<string, number>>({ 
      'e_battler': 0, 'e_double_puncher': 0, 'e_builder': 0, 'e_pistoler': 0, 
      'e_rage_battler': 0, 'e_baller': 0, 'e_fourth_puncher': 0, 'e_cake_thrower': 0, 'e_enforcer': 0,
      'e_tactical_trooper': 0, 'e_sniper': 0, 'e_heavy_gunner': 0
  });
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
        if (typeId === 'e_battler' && prev.currentStage === 1) hpScaling = 0.75;
        if (prev.currentStage === 9) hpScaling = 0.98;
        if (prev.currentStage >= 11) hpScaling = 1.05; // 5% Boost for World 2

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

  // --- GACHA LOGIC ---
  const rollGacha = () => {
      if (gameState.diamonds < GACHA_COST || isGachaRolling) return;
      
      setIsGachaRolling(true);
      sounds.playUpgrade(); // Sound effect start
      
      setGameState(p => ({...p, diamonds: p.diamonds - GACHA_COST}));

      setTimeout(() => {
          const rand = Math.random();
          let unitId = '';
          let rarity = 'Rare';
          
          // Pity Check (30th pull guarantees Uber)
          const isPityTrigger = gameState.pityCounter >= 29;

          if (isPityTrigger || rand < 0.05) { // 5% Uber Rare or Pity
             rarity = 'Uber Rare';
             unitId = 'grappler'; // Replaces CEO as Uber Rare
          } else if (rand < 0.30) { // 25% Super Rare
             rarity = 'Super Rare';
             const pool = ['megaphone']; // Replaced 'engineer' (Lead Dev)
             unitId = pool[Math.floor(Math.random() * pool.length)];
          } else { // 70% Rare
             rarity = 'Rare';
             const pool = ['cola_thrower', 'retro_battler']; 
             unitId = pool[Math.floor(Math.random() * pool.length)];
          }

          // Check if already owned
          const currentLevel = gameState.unitLevels[unitId] || 0;
          const isUnlock = currentLevel === 0;
          
          // Reset pity if Uber Rare, else increment
          const newPity = rarity === 'Uber Rare' ? 0 : gameState.pityCounter + 1;

          setGameState(p => ({
              ...p,
              pityCounter: newPity,
              unitLevels: {
                  ...p.unitLevels,
                  [unitId]: Math.min(10, (p.unitLevels[unitId] || 0) + 1)
              }
          }));

          setGachaResult({ unitId, isUnlock, rarity });
          setIsGachaRolling(false);
          sounds.playWin(); // Success sound
      }, 2000); // Animation delay
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
    enemyCooldownsRef.current = { 
        'e_battler': 0, 'e_double_puncher': 0, 'e_builder': 0, 'e_pistoler': 0, 
        'e_rage_battler': 0, 'e_baller': 0, 'e_fourth_puncher': 0, 'e_cake_thrower': 0, 'e_enforcer': 0,
        'e_tactical_trooper': 0, 'e_sniper': 0, 'e_heavy_gunner': 0
    };
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
        battleLog: ["Base Cannon fired!", ...prev.battleLog].slice(0, 10)
      };
    });

    setCannonReadyTime(now + CANNON_COOLDOWN);
    setTimeout(() => setCannonEffectActive(false), 500);

    try {
      const commentary = await generateBattleCommentary("The player fired the base cannon.");
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
        
        // --- SPAWN LOGIC START (REFACTORED to stage.tsx) ---
        if (timeElapsed > 5000 && !prev.sandboxPaused) {
          const spawnCommand = evaluateStageSpawns({
            stageId: prev.currentStage,
            timeElapsed,
            enemyMoney: enemyMoneyRef.current,
            enemyCooldowns: enemyCooldownsRef.current,
            units: prev.units,
            enemyBaseHp: prev.enemyBaseHp,
            bossSpawned
          });

          if (spawnCommand) {
            if (spawnCommand.setBossSpawned) {
              setBossSpawned(true);
            }
            
            unitToSpawn = spawnCommand.unitId;
            // Set cooldown
            enemyCooldownsRef.current[spawnCommand.unitId] = spawnCommand.cooldown;
          }

          if (unitToSpawn) {
            // BOSS SPAWN FIX: Don't deduct cost for Boss in Stage 10 to allow it to spawn support
            // (Preserving original logic behavior)
            if (unitToSpawn !== 'e_boss_shotgunner') {
                const u = ENEMY_UNITS.find(e => e.id === unitToSpawn);
                if (u) enemyMoneyRef.current -= u.cost;
            }
            setTimeout(() => deployUnit('enemy', unitToSpawn!), 0);
          }
        }
        // --- SPAWN LOGIC END ---

        const newUnits = [...prev.units.map(u => ({ ...u }))];
        let pDmg = 0; let eDmg = 0;
        const pendingUnits: ActiveUnit[] = [];
        for (let u of newUnits) {
          // --- STUN LOGIC ---
          if (u.stunnedUntil && u.stunnedUntil > now) {
            continue; // Skip movement and attack if stunned
          }

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
             // Phase 3 Transition Logic: Ground Slam
             if (u.currentHp <= 3000 && !u.hasSlammed) {
                u.hasSlammed = true;
                u.lastAbilityTime = now; // Trigger Slam animation
                
                // Heal 25% of Max HP (6563) -> ~1640
                const maxBossHp = 6563; 
                u.currentHp = Math.min(maxBossHp, u.currentHp + (maxBossHp * 0.25));
                
                // Instant Kill Player Units
                newUnits.forEach(target => {
                    if (target.side === 'player') {
                        target.currentHp = -99999;
                    }
                });
                
                // Summon 3 Double Punchers
                for(let i=0; i<3; i++) {
                     pendingUnits.push({
                        instanceId: nextInstanceId.current++,
                        typeId: 'e_double_puncher',
                        side: 'enemy',
                        x: u.x + (Math.random() * 60 - 30),
                        currentHp: 225, // Base HP of Double Puncher
                        lastAttackTime: 0,
                        lastAbilityTime: 0
                     });
                }
                
                sounds.playBaseHit(); // Heavy impact sound
             }

             // Transition Logic: Throw Shotgun
             if (u.currentHp < 5000 && !u.hasThrownShotgun) {
                u.hasThrownShotgun = true;
                // AK-47 Mode speed
                effectiveAttackCooldown = 100; // Buffed to 0.1s
                u.lastAttackTime = now; // Reset timer for new phase
             } 
             // Phase 2: AK-47
             else if (u.hasThrownShotgun) {
                effectiveAttackCooldown = 100; // Buffed to 0.1s
             }
             // Phase 1: Shotgun (default)
             else {
                effectiveAttackCooldown = 2500;
             }
          }
          // --- BOSS LOGIC END ---

          let enemyDamageScaling = 1.0;
          if (u.side === 'enemy') {
              if (u.typeId === 'e_battler' && prev.currentStage === 1) enemyDamageScaling = 0.75;
              if (prev.currentStage === 9) enemyDamageScaling = 0.98;
              if (prev.currentStage >= 11) enemyDamageScaling = 1.05; // 5% Boost
          }
          
          let actualDmg = stats.damage * (u.side === 'player' ? (1 + (level - 1) * STAT_GAIN_PER_LEVEL) : enemyDamageScaling);
          if (u.typeId === 'e_wall') continue;
          
          const distToBase = u.side === 'player' ? FIELD_WIDTH - u.x : u.x;
          
          // Effective Range Logic for Cake Thrower and Cola Thrower (Alt)
          let effectiveRange = stats.range;
          if (u.typeId === 'e_cake_thrower' && u.hasThrownCake) {
             effectiveRange = 40; // Reverts to melee range after throwing
          }

          const possibleTargets = newUnits.filter(other => other.side !== u.side && Math.abs(u.x - other.x) <= effectiveRange);
          
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
                      target.currentHp -= 37; // Buffed AK damage (was 31)
                  }
              } 
              // --- CAKE THROWER LOGIC ---
              else if (u.typeId === 'e_cake_thrower' && !u.hasThrownCake) {
                  u.hasThrownCake = true;
                  u.lastAbilityTime = now; // MARK THROW TIME FOR ANIMATION
                  target.currentHp -= actualDmg;
                  target.stunnedUntil = now + 3000; // 3s Stun
                  sounds.playBaseHit(); // Heavy impact
              }
              // --- MEGAPHONE MANIAC LOGIC ---
              else if (u.typeId === 'megaphone') {
                  sounds.playMegaphoneNoise();
                  if (u.isAltForm) {
                      // Earrape: Global Hit
                      const allEnemies = newUnits.filter(t => t.side !== u.side);
                      allEnemies.forEach(t => {
                          const isBoss = t.typeId === 'e_boss_shotgunner';
                          // Alt form deals small damage
                          let dmg = actualDmg;
                          
                          t.currentHp -= dmg;
                          if (!isBoss) {
                              t.stunnedUntil = now + 3000;
                          }
                          // Tiny knockback
                          t.x += (u.side === 'player' ? 1 : -1) * 5;
                          t.x = Math.max(0, Math.min(FIELD_WIDTH, t.x));
                      });
                  } else {
                      // Base: Single Target
                      target.currentHp -= actualDmg;
                      const isBoss = target.typeId === 'e_boss_shotgunner';
                      if (!isBoss) {
                          target.stunnedUntil = now + 3000;
                      }
                      // Tiny knockback
                      target.x += (u.side === 'player' ? 1 : -1) * 5;
                      target.x = Math.max(0, Math.min(FIELD_WIDTH, target.x));
                  }
              }
              // --- COLA THROWER LOGIC ---
              else if (u.typeId === 'cola_thrower') {
                 if (u.isAltForm) {
                     // Cola Spray: Apply stack and calculate damage
                     const stackCount = target.colaStacks || 0;
                     if (stackCount < 14) {
                        target.colaStacks = stackCount + 1;
                     }
                     const finalDmg = actualDmg * (1 + (0.15 * (target.colaStacks || 0)));
                     target.currentHp -= finalDmg;
                     
                     // Alt Form Knockback Buff: Small push per hit
                     if (target.typeId !== 'e_boss_shotgunner') {
                         const sprayKnockback = 15;
                         target.x += (u.side === 'player' ? 1 : -1) * sprayKnockback;
                         target.x = Math.max(0, Math.min(FIELD_WIDTH, target.x));
                     }
                 } else {
                     // Base Form: AOE Knockback
                     // Hit main target and nearby
                     const aoeTargets = newUnits.filter(other => 
                        other.side !== u.side && Math.abs(other.x - target!.x) <= 50
                     );
                     aoeTargets.forEach(t => {
                        t.currentHp -= actualDmg;
                        if (t.typeId !== 'e_boss_shotgunner') {
                            const knockback = 60; // Buffed from 20 to 60 (Massive Knockback)
                            t.x += (u.side === 'player' ? 1 : -1) * knockback;
                            t.x = Math.max(0, Math.min(FIELD_WIDTH, t.x));
                        }
                     });
                 }
              }
              else {
                  // Standard Unit Attack
                  let finalDmg = actualDmg;
                  // Megaphone Alt Form Self-Debuff Logic (When GETTING hit)
                  // But we are in the ATTACKER loop here. The attacker deals damage.
                  // We need to check if the TARGET is a megaphone alt form.
                  if (target.typeId === 'megaphone' && target.isAltForm) {
                      finalDmg *= 1.3;
                  }
                  target.currentHp -= finalDmg;
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
          } else if (distToBase <= effectiveRange) {
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
                    pDmg += 37; // AK Base Damage
                } else if (u.typeId === 'e_boss_shotgunner' && !u.hasThrownShotgun) {
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
        let earnedDiamonds = 0; let claimedBosses = [...prev.claimedBossStages];

        if (fPHp <= 0) { over = true; win = 'enemy'; sounds.playLoss(); }
        else if (fEHp <= 0) {
          over = true; win = 'player'; sounds.playWin();
          if (!prev.sandboxMode) {
             xp += XP_PER_WIN; if (xp >= XP_TO_LEVEL(plvl)) { xp -= XP_TO_LEVEL(plvl); plvl++; }
             const isFirst = !prev.unlockedStages.includes(prev.currentStage + 1);
             
             // Balanced Reward Logic
             const stageInfo = STAGE_CONFIG.find(s => s.id === prev.currentStage);
             const multiplier = isFirst ? (stageInfo?.isBoss ? BOSS_CLEAR_MULTIPLIER : FIRST_CLEAR_MULTIPLIER) : 1;
             const reward = Math.floor(prev.currentStage * REWARD_PER_STAGE * multiplier);
             
             newCoins += reward; 
             if (!stages.includes(prev.currentStage + 1)) stages.push(prev.currentStage + 1);

             // Boss Diamond Reward Logic
             if (BOSS_STAGE_IDS.includes(prev.currentStage) && !claimedBosses.includes(prev.currentStage)) {
                 earnedDiamonds = 100;
                 claimedBosses.push(prev.currentStage);
             }

             setLastWinReward({ coins: reward, isFirst, diamonds: earnedDiamonds });

          } else {
             setLastWinReward({ coins: 0, diamonds: 0, isFirst: false });
          }
        }
        return { 
            ...prev, 
            money: newMoney, 
            coins: newCoins, 
            diamonds: prev.diamonds + earnedDiamonds,
            claimedBossStages: claimedBosses,
            units: filtered, 
            playerBaseHp: fPHp, 
            enemyBaseHp: fEHp, 
            isGameOver: over, 
            winner: win, 
            playerXP: xp, 
            playerLevel: plvl, 
            unlockedStages: stages 
        };
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
      return renderUpgradeCard("fas fa-briefcase", "Starting Money", level, "Increases starting money for operations.", `$${INITIAL_MONEY + (level - 1) * STARTING_BUDGET_GAIN_PER_LEVEL}`, cost, () => {
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
      return renderUpgradeCard("fas fa-chart-line", "Efficiency Upgrade", gameState.bankLevel, "Increases passive income generation rate.", `$${curIncome.toFixed(1)}/s`, cost, () => {
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
                        <div className="text-blue-500 font-black tracking-[0.5em] text-xs uppercase mb-2">Game Version {GAME_VERSION}</div>
                        <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]">
                            BATTLE
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">HUMANS</span>
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
                                <div className="text-slate-400 font-medium">Continue your adventure.</div>
                            </div>
                            <div className="relative z-10 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/50">
                                <i className="fas fa-play"></i>
                            </div>
                        </button>
                        
                        {/* GACHA BUTTON */}
                         <button onClick={() => setGameState(p => ({...p, screen: 'gacha'}))} className="md:col-span-3 h-24 bg-gradient-to-r from-purple-900/60 to-pink-900/60 rounded-2xl border border-pink-500/30 hover:border-pink-400 transition-all flex items-center justify-between px-8 group relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse-slow"></div>
                            <div className="flex flex-col items-start relative z-10">
                                <span className="text-pink-300 font-bold text-xs tracking-widest uppercase mb-1">Recruitment Center</span>
                                <span className="text-2xl font-black italic text-white">RARE CAPSULE</span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-xl border border-pink-500/20">
                                <i className="fas fa-gem text-cyan-400"></i>
                                <span className="font-mono font-bold text-white">{gameState.diamonds}</span>
                            </div>
                        </button>

                        {/* Secondary Actions */}
                        <button onClick={() => setGameState(p => ({...p, screen: 'shop'}))} className="h-32 bg-slate-900/60 rounded-2xl border border-white/10 hover:bg-slate-800 hover:border-white/20 transition-all flex flex-col items-center justify-center gap-2 group">
                            <i className="fas fa-shopping-cart text-3xl text-slate-500 group-hover:text-white transition-colors"></i>
                            <span className="font-bold text-sm tracking-wide text-slate-300">UPGRADES</span>
                        </button>
                        
                        <button onClick={() => setGameState(p => ({...p, screen: 'loadout'}))} className="h-32 bg-slate-900/60 rounded-2xl border border-white/10 hover:bg-slate-800 hover:border-white/20 transition-all flex flex-col items-center justify-center gap-2 group">
                            <i className="fas fa-users-cog text-3xl text-slate-500 group-hover:text-white transition-colors"></i>
                            <span className="font-bold text-sm tracking-wide text-slate-300">UNITS</span>
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
                        <i className="fas fa-flask mr-2"></i> Enter Sandbox Mode
                    </button>
                </div>
            </ScreenWrapper>
        );
      case 'gacha':
        return (
            <ScreenWrapper className="flex items-center justify-center">
                <button onClick={exitToMenu} className="absolute top-6 left-6 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400 hover:text-white z-20"><i className="fas fa-arrow-left"></i></button>
                
                <div className="relative w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border border-pink-500/30 rounded-3xl p-10 flex flex-col items-center shadow-2xl overflow-hidden">
                    {/* Background FX */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20 pointer-events-none"></div>
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl"></div>
                    
                    {!gachaResult ? (
                        <>
                            <h2 className="text-4xl font-black italic text-white mb-2 relative z-10">RECRUITMENT</h2>
                            <p className="text-pink-300 font-medium mb-10 relative z-10">Secure high-value assets for your corporation.</p>
                            
                            <div className="relative w-48 h-48 mb-10 flex items-center justify-center">
                                {isGachaRolling ? (
                                    <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin"></div>
                                ) : (
                                    <div className="w-40 h-40 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full shadow-[0_0_50px_rgba(236,72,153,0.4)] flex items-center justify-center animate-pulse-slow">
                                        <i className="fas fa-question text-6xl text-white/50"></i>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-4 w-full mb-8 text-center text-xs font-bold uppercase tracking-widest text-slate-500">
                                <div><span className="text-white block text-lg">5%</span> Uber Rare</div>
                                <div><span className="text-white block text-lg">25%</span> Super Rare</div>
                                <div><span className="text-white block text-lg">70%</span> Rare</div>
                            </div>

                            <button 
                                onClick={rollGacha}
                                disabled={gameState.diamonds < GACHA_COST || isGachaRolling}
                                className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl font-bold text-xl text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
                            >
                                {isGachaRolling ? (
                                    <span>PROCESSING...</span>
                                ) : (
                                    <>
                                        <span>ROLL 1x</span>
                                        <div className="bg-black/20 px-3 py-1 rounded-lg text-sm flex items-center gap-1">
                                            <i className="fas fa-gem text-cyan-400"></i> {GACHA_COST}
                                        </div>
                                    </>
                                )}
                            </button>
                            <div className="mt-4 text-xs font-bold text-cyan-400 flex items-center justify-between w-full px-4">
                                <div>CURRENT BALANCE: <i className="fas fa-gem ml-1"></i> {gameState.diamonds}</div>
                                <div className="text-pink-300/50">Pity: {gameState.pityCounter}/30</div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center animate-in zoom-in duration-300">
                            <div className={`text-sm font-black uppercase tracking-[0.3em] mb-4 ${
                                gachaResult.rarity === 'Uber Rare' ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 
                                gachaResult.rarity === 'Super Rare' ? 'text-red-400' : 'text-blue-400'
                            }`}>
                                {gachaResult.rarity} ACQUIRED
                            </div>
                            
                            <div className="w-32 h-32 bg-slate-800 rounded-2xl border-2 border-white/20 flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden">
                                <div className="scale-150"><BattlerVisual typeId={gachaResult.unitId} size="lg" isAlmanac={true} /></div>
                                {gachaResult.rarity === 'Uber Rare' && <div className="absolute inset-0 bg-yellow-400/10 animate-pulse"></div>}
                            </div>
                            
                            <h2 className="text-3xl font-black italic text-white mb-2">
                                {PLAYER_UNITS.find(u => u.id === gachaResult.unitId)?.name}
                            </h2>
                            
                            <div className="bg-slate-950/50 px-6 py-2 rounded-full mb-8 border border-white/5 text-sm font-mono text-slate-300">
                                {gachaResult.isUnlock ? 'NEW UNIT UNLOCKED!' : '+1 LEVEL UP!'}
                            </div>
                            
                            <button 
                                onClick={() => setGachaResult(null)}
                                className="px-10 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                CONTINUE
                            </button>
                        </div>
                    )}
                </div>
            </ScreenWrapper>
        );
      case 'stages':
        return (
            <ScreenWrapper>
                <StageSelectionScreen 
                    unlockedStages={gameState.unlockedStages} 
                    onSelectStage={(id) => startBattle(id)} 
                    onExit={exitToMenu} 
                />
            </ScreenWrapper>
        );
      case 'battle':
        return (
             <ScreenWrapper>
                {/* Battle UI Overlay */}
                <div className="absolute top-0 left-0 w-full p-2 z-10 flex justify-between items-start pointer-events-none">
                    <button onClick={exitToMenu} className="pointer-events-auto bg-slate-800/80 text-white p-2 rounded-lg border border-slate-600"><i className="fas fa-pause"></i></button>
                    <div className="flex flex-col items-end gap-1">
                        <div className="bg-slate-900/80 px-3 py-1 rounded-full border border-blue-500/30 flex items-center gap-2">
                             <span className="text-yellow-400 font-bold text-sm"><i className="fas fa-coins mr-1"></i> {Math.floor(gameState.money)}</span>
                             <span className="text-xs text-slate-400">/ {999999}</span>
                        </div>
                        <div className="bg-slate-900/80 px-2 py-0.5 rounded text-[10px] text-slate-400">
                           Level {gameState.walletLevel + 1} ({MONEY_MULTIPLIER[gameState.walletLevel]}x)
                        </div>
                    </div>
                </div>

                {/* Cannon Button */}
                <button 
                   onClick={fireCannon}
                   disabled={Date.now() < cannonReadyTime}
                   className={`absolute bottom-32 right-4 z-20 w-16 h-16 rounded-full border-4 shadow-xl flex items-center justify-center transition-all ${Date.now() < cannonReadyTime ? 'bg-slate-800 border-slate-600 grayscale opacity-50' : 'bg-red-600 border-red-800 animate-pulse hover:scale-110 active:scale-95'}`}
                >
                   <i className="fas fa-meteor text-2xl text-white"></i>
                </button>
                
                {/* Wallet Button */}
                <button
                   onClick={upgradeWallet}
                   disabled={gameState.walletLevel >= WALLET_UPGRADE_COSTS.length - 1 || gameState.money < WALLET_UPGRADE_COSTS[gameState.walletLevel]}
                   className={`absolute bottom-32 left-4 z-20 w-16 h-16 rounded-full border-4 shadow-xl flex flex-col items-center justify-center transition-all ${gameState.walletLevel >= WALLET_UPGRADE_COSTS.length - 1 ? 'bg-slate-800 border-slate-600 opacity-50' : 'bg-yellow-600 border-yellow-800 hover:bg-yellow-500 active:scale-95'}`}
                >
                   <i className="fas fa-arrow-up text-white mb-1"></i>
                   <span className="text-[10px] font-black text-white leading-none">
                      {gameState.walletLevel >= WALLET_UPGRADE_COSTS.length - 1 ? 'MAX' : `$${WALLET_UPGRADE_COSTS[gameState.walletLevel]}`}
                   </span>
                </button>

                {/* Unit Deployment Bar */}
                <div className="absolute bottom-0 w-full h-28 md:h-32 bg-slate-900/90 border-t border-white/10 flex items-center px-2 gap-2 overflow-x-auto no-scrollbar z-30">
                    {gameState.loadout.map(id => {
                        const unit = PLAYER_UNITS.find(u => u.id === id);
                        if (!unit) return null;
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
                        );
                    })}
                </div>

                {/* The Battlefield Render */}
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
                
                {/* Sandbox Panel */}
                {gameState.sandboxMode && (
                   <div className={`absolute top-16 right-0 bg-slate-900/90 border-l border-white/10 transition-transform duration-300 z-50 ${showSandboxPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                      <button onClick={() => setShowSandboxPanel(!showSandboxPanel)} className="absolute top-0 -left-8 w-8 h-8 bg-slate-800 text-white flex items-center justify-center rounded-l-lg text-xs"><i className={`fas ${showSandboxPanel ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i></button>
                      <div className="p-4 w-64 h-[80vh] overflow-y-auto">
                          <h3 className="text-yellow-400 font-bold mb-4 uppercase text-xs tracking-widest border-b border-white/10 pb-2">Sandbox Tools</h3>
                          
                          <div className="mb-4">
                              <label className="text-[10px] text-slate-400 uppercase font-bold">Game Speed</label>
                              <div className="flex gap-2 mt-1">
                                  <button onClick={() => setGameState(p => ({...p, sandboxPaused: !p.sandboxPaused}))} className={`flex-1 py-1 rounded text-xs font-bold ${gameState.sandboxPaused ? 'bg-red-600' : 'bg-slate-700'}`}>{gameState.sandboxPaused ? 'RESUME' : 'PAUSE'}</button>
                              </div>
                          </div>

                          <div className="mb-4">
                              <label className="text-[10px] text-slate-400 uppercase font-bold">Spawn Enemy</label>
                              <div className="grid grid-cols-4 gap-2 mt-1">
                                  {ENEMY_UNITS.map(u => (
                                      <button key={u.id} onClick={() => deploySandboxUnit(u.id, 'enemy')} className="aspect-square bg-red-900/50 hover:bg-red-800 border border-red-500/30 rounded flex items-center justify-center" title={u.name}>
                                          <div className="scale-50"><BattlerVisual typeId={u.id} isAlmanac={true} /></div>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>
                   </div>
                )}
                
                <GameAssistant gameState={gameState} />
                
                {/* Battle Log Overlay */}
                <div className="absolute top-16 left-4 max-w-[200px] md:max-w-sm pointer-events-none opacity-80 z-0">
                    {gameState.battleLog.slice(0, 3).map((log, i) => (
                        <div key={i} className="text-[10px] md:text-xs text-white/80 text-shadow-sm mb-1 animate-in fade-in slide-in-from-left-2">
                             <span className="text-blue-400 mr-1">[{new Date().toLocaleTimeString([], {hour12: false, minute:'2-digit', second:'2-digit'})}]</span> {log}
                        </div>
                    ))}
                </div>

                {/* Game Over Screen */}
                {gameState.isGameOver && (
                    <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm animate-in zoom-in duration-300">
                        <div className="bg-slate-900 border-2 border-white/10 p-8 rounded-3xl text-center max-w-md shadow-2xl relative overflow-hidden">
                             <div className={`absolute top-0 left-0 w-full h-2 ${gameState.winner === 'player' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                             <h2 className={`text-5xl font-black italic mb-2 ${gameState.winner === 'player' ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300' : 'text-red-500'}`}>
                                 {gameState.winner === 'player' ? 'VICTORY' : 'DEFEAT'}
                             </h2>
                             <div className="text-slate-400 mb-8 font-medium">
                                 {gameState.winner === 'player' ? 'The corporation expands.' : 'Your department has been liquidated.'}
                             </div>
                             
                             {lastWinReward && gameState.winner === 'player' && (
                                 <div className="mb-6 bg-slate-950/50 p-4 rounded-xl border border-white/5">
                                     <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Rewards Acquired</div>
                                     <div className="flex justify-center gap-4">
                                         {lastWinReward.coins > 0 && (
                                            <div className="flex flex-col items-center">
                                                <div className="text-yellow-400 text-xl font-mono font-bold">+${lastWinReward.coins}</div>
                                                <div className="text-[10px] text-slate-500">Budget</div>
                                            </div>
                                         )}
                                         {lastWinReward.diamonds > 0 && (
                                            <div className="flex flex-col items-center">
                                                <div className="text-cyan-400 text-xl font-mono font-bold">+{lastWinReward.diamonds}</div>
                                                <div className="text-[10px] text-slate-500">Gems</div>
                                            </div>
                                         )}
                                     </div>
                                 </div>
                             )}

                             <div className="flex gap-4 justify-center">
                                 <button onClick={exitToMenu} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-colors">Return to HQ</button>
                                 {gameState.winner === 'player' && !gameState.sandboxMode && (
                                     <button onClick={() => startBattle(gameState.currentStage + 1)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-105">Next Operation</button>
                                 )}
                                 {gameState.winner === 'enemy' && (
                                     <button onClick={() => startBattle(gameState.currentStage)} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/25 transition-all hover:scale-105">Retry</button>
                                 )}
                             </div>
                        </div>
                    </div>
                )}
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
                            <h1 className="text-xl md:text-2xl font-black italic tracking-tighter truncate">{isShop ? 'UPGRADES' : isLoadout ? 'LOADOUT' : 'ARCHIVES'}</h1>
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
                            [{id: 'bank_upgrade', name: 'Efficiency Upgrade', icon: 'fas fa-chart-line', group: 'Infra'}, {id: 'starting_budget_upgrade', name: 'Starting Money', icon: 'fas fa-briefcase', group: 'Infra'}, {id: 'cannon_upgrade', name: 'Orbital Cannon', icon: 'fas fa-meteor', group: 'Infra'}, ...PLAYER_UNITS.map(u => ({...u, group: 'Units'}))] 
                            : (gameState.screen === 'almanac' ? (almanacType === 'ally' ? PLAYER_UNITS : ENEMY_UNITS) : PLAYER_UNITS).map(u => ({...u, group: 'Units'}))
                        ).map((item: any) => {
                            const isSelected = selectedUnitId === item.id;
                            const isOwned = isShop || isUnitUnlocked(item) || gameState.screen === 'almanac';
                            
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
                                        <div className={`text-[9px] md:text-[10px] truncate ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>{item.group === 'Infra' ? 'Base Upgrade' : 'Combat Unit'}</div>
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
      default:
        // Default fallback with a return button if state gets weird
        return (
            <div className="flex items-center justify-center h-full flex-col gap-4 text-white">
                <div className="text-xl font-bold text-red-500">System Error: Invalid State</div>
                <div className="font-mono text-sm text-slate-400">Current Screen: {gameState.screen || 'undefined'}</div>
                <button onClick={exitToMenu} className="bg-white text-black px-6 py-2 rounded-lg font-bold hover:bg-slate-200">
                    Return to Main Menu
                </button>
            </div>
        );
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
        
        /* New Retro Animation */
        @keyframes step-jump {
            0%, 49% { transform: translateY(0); }
            50%, 100% { transform: translateY(-3px); }
        }

        /* Boss Slam Animation */
        @keyframes boss-slam {
          0% { transform: scale(1.5) translateY(0); }
          20% { transform: scale(1.8) translateY(-40px); }
          40% { transform: scale(1.8) translateY(-40px); }
          50% { transform: scale(1.5) translateY(20px); } /* SLAM */
          60% { transform: scale(1.5) translateY(15px); }
          100% { transform: scale(1.5) translateY(0); }
        }

        /* Cake Throw Animation */
        @keyframes cake-projectile {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          25% { transform: translate(40px, -20px) rotate(90deg) scale(1.1); }
          50% { transform: translate(80px, -30px) rotate(180deg) scale(1.2); }
          75% { transform: translate(120px, -15px) rotate(270deg) scale(1.1); }
          100% { transform: translate(160px, 10px) rotate(360deg) scale(1); opacity: 0; }
        }

        /* Utilities */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .animate-step-jump { animation: step-jump 0.5s steps(2, start) infinite; }
      `}</style>
      {renderScreen()}
  </div>;
}