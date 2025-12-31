
import React from 'react';
import { STAGE_CONFIG, ENEMY_UNITS } from './constants';
import { ActiveUnit } from './types';

// --- UI Component: Stage Selection ---

interface StageSelectionProps {
  unlockedStages: number[];
  onSelectStage: (id: number) => void;
  onExit: () => void;
}

export const StageSelectionScreen: React.FC<StageSelectionProps> = ({ unlockedStages, onSelectStage, onExit }) => {
  return (
    <>
        <div className="flex-none p-6 md:p-10">
            <div className="flex items-center gap-4">
                <button onClick={onExit} className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400 hover:text-white"><i className="fas fa-arrow-left"></i></button>
                <h1 className="text-4xl font-black italic tracking-tighter">OPERATIONS MAP</h1>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl">
                {STAGE_CONFIG.map(stage => {
                    const isUnlocked = unlockedStages.includes(stage.id);
                    const isBeaten = unlockedStages.includes(stage.id + 1);
                    
                    return (
                        <button 
                            key={stage.id}
                            disabled={!isUnlocked}
                            onClick={() => onSelectStage(stage.id)}
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
    </>
  );
};

// --- Game Logic: Spawning System ---

export interface StageContext {
  stageId: number;
  timeElapsed: number;
  enemyMoney: number;
  enemyCooldowns: Record<string, number>;
  units: ActiveUnit[];
  enemyBaseHp: number;
  bossSpawned: boolean;
}

export interface SpawnCommand {
  unitId: string;
  cooldown: number;
  setBossSpawned?: boolean;
}

export const evaluateStageSpawns = (ctx: StageContext): SpawnCommand | null => {
  const { stageId, timeElapsed, enemyMoney, enemyCooldowns, units, enemyBaseHp, bossSpawned } = ctx;

  // Helper to check availability
  const canSpawn = (unitId: string, costOverride?: number) => {
    const unit = ENEMY_UNITS.find(u => u.id === unitId);
    if (!unit) return false;
    const cost = costOverride ?? unit.cost;
    return enemyCooldowns[unitId] === 0 && enemyMoney >= cost;
  };

  // STAGE 14: Stunlocking (Builder, Baller, Battler, Cake Thrower)
  if (stageId === 14) {
    // Early game pressure with Battlers
    if (timeElapsed < 20000) {
      if (canSpawn('e_battler')) {
        return { unitId: 'e_battler', cooldown: 2000 };
      } else if (canSpawn('e_baller')) {
        return { unitId: 'e_baller', cooldown: 8000 };
      }
    }
    
    // Count current units for strategic spawning
    const enemiesOnField = units.filter(u => u.side === 'enemy');
    const builders = enemiesOnField.filter(u => u.typeId === 'e_builder').length;
    const cakeThrowers = enemiesOnField.filter(u => u.typeId === 'e_cake_thrower').length;
    const ballers = enemiesOnField.filter(u => u.typeId === 'e_baller').length;
    const frontliners = enemiesOnField.filter(u => 
      ['e_battler', 'e_double_puncher', 'e_rage_battler', 'e_wall'].includes(u.typeId)
    ).length;
    
    // Priority 1: Always have at least 1 Builder for economy
    if (builders === 0 && canSpawn('e_builder')) {
      return { unitId: 'e_builder', cooldown: 12000 };
    }
    
    // Priority 2: Cake Thrower for heavy stun/area control
    if (cakeThrowers < 2 && canSpawn('e_cake_thrower')) {
      // Reduce cost for Cake Thrower to make it more spammable in this stage
      if (canSpawn('e_cake_thrower', 600)) { // Reduced from likely higher cost
        return { unitId: 'e_cake_thrower', cooldown: 15000 };
      }
    }
    
    // Priority 3: Maintain front line with Battlers
    if (frontliners < 3) {
      const meatshields = ['e_battler', 'e_rage_battler'];
      const available = meatshields.filter(id => canSpawn(id));
      if (available.length > 0) {
        const pick = available[Math.floor(Math.random() * available.length)];
        const u = ENEMY_UNITS.find(e => e.id === pick)!;
        return { unitId: pick, cooldown: u.spawnCooldown || 3000 };
      }
    }
    
    // Priority 4: Baller for range pressure
    if (ballers < 2 && canSpawn('e_baller')) {
      return { unitId: 'e_baller', cooldown: 6000 };
    }
    
    // Priority 5: Additional Builder if rich
    if (builders < 2 && enemyMoney > 1200 && canSpawn('e_builder')) {
      return { unitId: 'e_builder', cooldown: 20000 };
    }
    
    // Priority 6: Spam whatever we can afford
    const availableUnits = ['e_battler', 'e_baller', 'e_builder', 'e_cake_thrower']
      .filter(id => canSpawn(id));
    
    if (availableUnits.length > 0) {
      const pick = availableUnits[Math.floor(Math.random() * availableUnits.length)];
      const u = ENEMY_UNITS.find(e => e.id === pick)!;
      return { unitId: pick, cooldown: u.spawnCooldown || 5000 };
    }
  }
  // STAGE 13: Cake Thrower
  else if (stageId === 13) {
     if (canSpawn('e_cake_thrower')) {
         return { unitId: 'e_cake_thrower', cooldown: 8000 };
     } else if (canSpawn('e_battler')) {
         return { unitId: 'e_battler', cooldown: 2500 };
     } else if (canSpawn('e_pistoler')) {
         return { unitId: 'e_pistoler', cooldown: 6000 };
     }
  }
  // STAGE 12: Puncher Bros
  else if (stageId === 12) {
     if (canSpawn('e_fourth_puncher')) {
         return { unitId: 'e_fourth_puncher', cooldown: 9000 };
     } else if (canSpawn('e_double_puncher')) {
         return { unitId: 'e_double_puncher', cooldown: 4000 };
     } else if (canSpawn('e_builder')) {
         return { unitId: 'e_builder', cooldown: 15000 };
     }
  }
  // STAGE 11: Fourth Puncher Debut
  else if (stageId === 11) {
     if (canSpawn('e_fourth_puncher')) {
         return { unitId: 'e_fourth_puncher', cooldown: 12000 };
     } else if (canSpawn('e_battler')) {
         return { unitId: 'e_battler', cooldown: 2500 };
     }
  }
  // STAGE 10: No Mercy (Boss Stage)
  else if (stageId === 10) {
      if (!bossSpawned && timeElapsed > 2000) {
         // Summon Boss
         return { unitId: 'e_boss_shotgunner', cooldown: 0, setBossSpawned: true };
      } else if (bossSpawned) {
         if (canSpawn('e_baller')) {
            return { unitId: 'e_baller', cooldown: 10000 };
         } else if (canSpawn('e_builder')) {
            return { unitId: 'e_builder', cooldown: 15000 };
         } else if (canSpawn('e_pistoler')) {
            return { unitId: 'e_pistoler', cooldown: 6000 };
         } else if (canSpawn('e_battler')) {
            return { unitId: 'e_battler', cooldown: 2500 };
         }
      }
  }
  // STAGE 9: Nine of a Kinds (Strategic)
  else if (stageId === 9) {
     const enemiesOnField = units.filter(u => u.side === 'enemy');
     const frontliners = enemiesOnField.filter(u => ['e_battler', 'e_double_puncher', 'e_rage_battler', 'e_wall'].includes(u.typeId)).length;
     
     if (frontliners < 4) {
         const meatshields = ['e_battler', 'e_double_puncher', 'e_rage_battler'];
         const available = meatshields.filter(id => canSpawn(id));
         if (available.length > 0) {
             const pick = available[Math.floor(Math.random() * available.length)];
             const u = ENEMY_UNITS.find(e => e.id === pick)!;
             return { unitId: pick, cooldown: u.spawnCooldown };
         }
     } else {
         const backliners = ['e_baller', 'e_pistoler', 'e_builder'];
         const available = backliners.filter(id => canSpawn(id));
         if (available.length > 0) {
             const pick = available[Math.floor(Math.random() * available.length)];
             const u = ENEMY_UNITS.find(e => e.id === pick)!;
             return { unitId: pick, cooldown: u.spawnCooldown };
         } else if (enemyMoney > 400) {
             // Reinforce if rich
             const meatshields = ['e_battler', 'e_double_puncher', 'e_rage_battler'];
             const availableMS = meatshields.filter(id => canSpawn(id));
             if (availableMS.length > 0) {
                 const pick = availableMS[Math.floor(Math.random() * availableMS.length)];
                 const u = ENEMY_UNITS.find(e => e.id === pick)!;
                 return { unitId: pick, cooldown: u.spawnCooldown };
             }
         }
     }
  }
  // STAGE 8: Bullet Hell
  else if (stageId === 8) {
     if (canSpawn('e_builder')) {
        return { unitId: 'e_builder', cooldown: 15000 };
     } else if (canSpawn('e_baller')) {
        return { unitId: 'e_baller', cooldown: 5000 };
     } else if (canSpawn('e_pistoler')) {
        return { unitId: 'e_pistoler', cooldown: 2500 }; 
     }
  }
  // STAGE 7: Baller's Rise
  else if (stageId === 7) {
    if (canSpawn('e_baller')) {
      return { unitId: 'e_baller', cooldown: 8000 };
    } else if (canSpawn('e_battler')) {
      return { unitId: 'e_battler', cooldown: 2000 };
    } else if (canSpawn('e_pistoler')) {
      return { unitId: 'e_pistoler', cooldown: 10000 };
    }
  }
  // STAGE 6: MeatShielding
  else if (stageId === 6) {
    const maxHp = 500 + (stageId - 1) * 1000;
    const isBaseLow = enemyBaseHp < maxHp * 0.8;
    if (canSpawn('e_battler')) {
      return { unitId: 'e_battler', cooldown: 1500 };
    } else if (canSpawn('e_double_puncher')) {
      return { unitId: 'e_double_puncher', cooldown: 4500 };
    } else if ((timeElapsed > 30000 || isBaseLow) && canSpawn('e_pistoler')) {
      return { unitId: 'e_pistoler', cooldown: 8000 };
    }
  } 
  // STAGE 5: The Rage
  else if (stageId === 5) {
    const chance = Math.random();
    if (chance < 0.12 && canSpawn('e_rage_battler')) {
      return { unitId: 'e_rage_battler', cooldown: 3500 };
    }
  } 
  
  // GENERAL FALLBACK / EARLIER STAGES
  
  // General Logic for Stages 3-5 (Mixed support)
  if (stageId >= 3 && stageId <= 5) {
      const chance = Math.random();
      if (chance < 0.15 && canSpawn('e_builder')) {
          return { unitId: 'e_builder', cooldown: 18000 };
      }
  }
  // General Logic for Stages 4-5 (Pistoler support)
  if (stageId >= 4 && stageId <= 5) {
      const chance = Math.random();
      if (chance < 0.1 && canSpawn('e_pistoler')) {
          return { unitId: 'e_pistoler', cooldown: 12000 };
      }
  }

  // Stage 2 Specifics
  if (stageId === 2) {
    const chance = Math.random();
    if (chance < 0.15 && canSpawn('e_double_puncher')) {
      return { unitId: 'e_double_puncher', cooldown: 10000 };
    } else if (chance < 0.35 && canSpawn('e_battler')) {
      return { unitId: 'e_battler', cooldown: 5000 };
    }
  } 
  // Stage 3+ General Spawns
  else if (stageId >= 3) {
    const chance = Math.random();
    // Don't re-spawn if handled above, but these are checks for "else if" flow
    // Since we return early above for specific combos, these act as fillers
    if (chance < 0.15 && canSpawn('e_double_puncher')) {
      return { unitId: 'e_double_puncher', cooldown: 6000 };
    } else if (chance < 0.4 && canSpawn('e_battler')) {
      return { unitId: 'e_battler', cooldown: 3000 };
    }
  } 
  // Stage 1
  else if (stageId === 1) {
    const chance = Math.random();
    if (chance < 0.25 && canSpawn('e_battler')) {
      return { unitId: 'e_battler', cooldown: 8000 };
    }
  }

  return null;
};
