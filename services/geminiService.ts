
import { GoogleGenAI } from "@google/genai";

// Initialize AI client using the provided API key strictly from environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Local fallback commentary for when the API is rate-limited or unavailable
const FALLBACK_COMMENTARY = [
  "The Interns are unionizing and it is not looking good for the payroll.",
  "CEO has entered the lobby, hide the company card.",
  "Quarterly projections suggest we need more boots on the ground.",
  "Synergy levels are reaching critical mass.",
  "The office printer is jammed with the souls of the departed.",
  "HR is currently 're-evaluating' the concept of lunch breaks.",
  "Paradigm shifts detected in the breakroom.",
  "The coffee machine is the only thing keeping this company afloat.",
  "Blockchain solutions applied to the frontline; results are 'disruptive'.",
  "Lowering the bar to increase the reach. Classic management.",
  "Leveraging core competencies to survive the lunch rush.",
  "A deep dive into the trenches revealed zero work-life balance.",
  "Actioning the deliverables with extreme prejudice.",
  "The mission statement has been updated to include 'not dying'."
];

let lastCallTime = 0;
const MIN_API_INTERVAL = 15000; // Only try the API every 15 seconds to save quota

/**
 * Generates sarcastic corporate-themed battle commentary using Gemini.
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
    lastCallTime = now;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a sarcastic corporate AI reporter. Generate a short (1 sentence), funny commentary for this game event in "Battle Humans: Corporate Uprising": ${event}. Focus on corporate jargon, burnout, and office politics.`,
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