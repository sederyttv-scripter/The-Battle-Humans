
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GameState, Side } from '../types';
import { PLAYER_UNITS, ENEMY_UNITS, WALLET_UPGRADE_COSTS, MONEY_MULTIPLIER } from '../constants';

interface GameAssistantProps {
  gameState: GameState;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const GameAssistant: React.FC<GameAssistantProps> = ({ gameState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Yo! I'm here to help you win. Ask me anything about the battle, upgrades, or strategy!" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const getContextData = () => {
    // 1. Battle Context (Only relevant if in battle)
    const isBattle = gameState.screen === 'battle';
    
    const playerUnitCounts = gameState.units
      .filter(u => u.side === 'player')
      .reduce((acc, u) => {
        acc[u.typeId] = (acc[u.typeId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const enemyUnitCounts = gameState.units
      .filter(u => u.side === 'enemy')
      .reduce((acc, u) => {
        acc[u.typeId] = (acc[u.typeId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const closestEnemy = gameState.units
      .filter(u => u.side === 'enemy')
      .reduce((min, u) => Math.min(min, u.x), 1000);

    // 2. Meta Game Context (Always relevant, especially for Shop/Loadout)
    const metaData = {
      savingsCoins: gameState.coins, // Currency for upgrades
      playerLevel: gameState.playerLevel,
      unlockedStages: gameState.unlockedStages,
      unitLevels: gameState.unitLevels, // Current level of each unit
      loadout: gameState.loadout, // Current equipped units
      upgrades: {
        cannonLevel: gameState.cannonLevel,
        bankLevel: gameState.bankLevel, // Corporate Bank
        startingBudgetLevel: gameState.startingBudgetLevel
      }
    };

    return {
      currentScreen: gameState.screen,
      // Battle Data
      battleState: isBattle ? {
        stage: gameState.currentStage,
        battleMoney: Math.floor(gameState.money), // Currency for deploying units
        walletLevel: gameState.walletLevel + 1,
        baseHealth: { player: Math.floor(gameState.playerBaseHp), enemy: Math.floor(gameState.enemyBaseHp) },
        unitsOnField: { player: playerUnitCounts, enemy: enemyUnitCounts },
        closestEnemyDistance: closestEnemy === 1000 ? 'None' : Math.floor(closestEnemy)
      } : null,
      // Global Data
      playerProfile: metaData,
      // Reference Data (Static)
      gameReference: {
        units: PLAYER_UNITS.filter(u => gameState.loadout.includes(u.id)).map(u => ({ id: u.id, name: u.name, cost: u.cost, role: u.description })),
        walletCost: WALLET_UPGRADE_COSTS[gameState.walletLevel] || 'MAX'
      }
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = getContextData();

      const systemPrompt = `
        You are a chill, helpful gaming buddy for 'Battle Humans: Corporate Uprising'.
        Speak in a super casual, easy-to-understand way. No complex words.
        
        CURRENT SITUATION:
        User is currently on the "${context.currentScreen}" screen.
        
        CONTEXT DATA (JSON):
        ${JSON.stringify(context)}

        GUIDELINES:
        1. **If in 'battle'**:
           - Focus on 'battleState'. 
           - 'battleMoney' is for deploying units NOW.
           - Explain counters (e.g., "Tanks block, Pistolers shoot from back").
           
        2. **If in 'shop'**:
           - Focus on 'playerProfile'.
           - 'savingsCoins' are for PERMANENT upgrades.
           - Check 'unitLevels' to see what is low level.
           - Suggest upgrading the "Corporate Bank" (improves income) or "Human Tank" (better defense).
           
        3. **If in 'loadout'**:
           - Discuss team composition ('loadout').
           - Suggest a mix of cheap meatshields (Baby/Tank) and damage dealers (Sworder/Pistoler).

        4. **General**:
           - Keep it short (under 40 words).
           - Be friendly and encouraging.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + "\n\nUser Question: " + userMessage }] }
        ]
      });

      const text = response.text || "Sorry, I zoned out. Ask again?";
      setMessages(prev => [...prev, { role: 'model', text }]);

    } catch (error) {
      console.error("AI Assistant Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "My internet is acting up. Try again in a sec." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  const isBattle = gameState.screen === 'battle';

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        onClick={toggleOpen}
        className={`absolute z-50 w-14 h-14 bg-cyan-600 hover:bg-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(8,145,178,0.6)] transition-all hover:scale-110 active:scale-95 border-2 border-cyan-300 ${
          isBattle ? 'bottom-36 md:bottom-44 right-4 md:right-6' : 'bottom-6 right-4 md:right-6'
        }`}
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-robot'} text-white text-2xl`}></i>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className={`absolute z-50 w-80 md:w-96 h-96 bg-slate-900/95 backdrop-blur-md rounded-2xl border-2 border-cyan-500/50 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 ${
          isBattle ? 'bottom-52 right-4 md:right-6' : 'bottom-24 right-4 md:right-6'
        }`}>
          {/* Header */}
          <div className="bg-cyan-900/30 p-3 border-b border-cyan-500/30 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
            <h3 className="font-mono font-bold text-sm tracking-widest uppercase text-cyan-400">Battle Assistant</h3>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-cyan-700">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-xs md:text-sm font-medium leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-cyan-700 text-white rounded-tr-none' 
                    : 'bg-slate-800 border border-slate-700 text-cyan-100 rounded-tl-none shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 p-3 rounded-xl rounded-tl-none flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce bg-cyan-500"></div>
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce delay-100 bg-cyan-500"></div>
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce delay-200 bg-cyan-500"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-slate-900 border-t border-cyan-900/50 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask for help..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 rounded-lg transition-colors"
            >
              <i className="fas fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
