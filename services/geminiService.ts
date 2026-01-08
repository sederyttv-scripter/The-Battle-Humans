
import { GoogleGenAI } from "@google/genai";

// Initialize AI client lazily to avoid top-level failures
let ai: GoogleGenAI | null = null;

// Local fallback commentary for when the API is rate-limited or unavailable
const FALLBACK_COMMENTARY = [
  "The humans are marching forward!",
  "A huge wave of enemies is approaching!",
  "Hold the line!",
  "The cannon is charging up!",
  "Victory is within reach!",
  "Don't let them break through!",
  "Reinforcements have arrived!",
  "That was a massive hit!",
  "The boss is angry!",
  "Keep spawning units!",
  "Defend the base at all costs!",
  "It's chaos on the battlefield!",
  "What a strategy!",
  "They are pushing us back!"
];

let lastCallTime = 0;
const MIN_API_INTERVAL = 15000; // Only try the API every 15 seconds to save quota

/**
 * Generates hype battle commentary using Gemini.
 * @param event - The game event description to comment on.
 * @returns A single sentence of flavorful text.
 */
export const generateBattleCommentary = async (event: string): Promise<string> => {
  const now = Date.now();
  
  // Rate limiting: If we called the API too recently, use fallback immediately
  if (now - lastCallTime < MIN_API_INTERVAL) {
    return FALLBACK_COMMENTARY[Math.floor(Math.random() * FALLBACK_COMMENTARY.length)];
  }

  // API Key is assumed to be available as per guidelines
  try {
    if (!ai) {
        // Double check if API key exists before initializing to prevent crashes
        if (!process.env.API_KEY) {
            console.warn("API_KEY is missing. Using fallback commentary.");
            return FALLBACK_COMMENTARY[Math.floor(Math.random() * FALLBACK_COMMENTARY.length)];
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    lastCallTime = now;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an energetic e-sports style commentator for a strategy game called "Battle Humans". Generate a short (1 sentence), hype commentary for this game event: ${event}. Be excited and intense.`,
      config: {
        maxOutputTokens: 50,
        // FIX: Add thinkingBudget when maxOutputTokens is set to prevent empty responses.
        thinkingConfig: { thinkingBudget: 25 },
        temperature: 0.9
      }
    });

    // FIX: The 'text' property should be accessed directly, not called as a function.
    const text = response.text;
    return text?.trim() || FALLBACK_COMMENTARY[Math.floor(Math.random() * FALLBACK_COMMENTARY.length)];
  } catch (error: any) {
    // If we hit a 429 (Rate Limit), increase the cooldown significantly
    if (error?.message?.includes('429')) {
      lastCallTime = now + 60000; // Stop trying for 60 seconds
      console.warn("Gemini API rate limited. Switching to local commentary.");
    } else {
      console.error("Gemini Error:", error);
    }
    
    // Return a random themed fallback message instead of an error string
    return FALLBACK_COMMENTARY[Math.floor(Math.random() * FALLBACK_COMMENTARY.length)];
  }
};
