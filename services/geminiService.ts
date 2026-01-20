import { GoogleGenAI } from "@google/genai";
import { AppState, EquipmentStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateUsageReport = async (data: any, type: 'CURRENT' | 'HISTORY'): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not configured. Unable to generate AI report.";
  }

  try {
    let prompt = "";
    
    // Common instructions for clean output
    const formatInstructions = `
      IMPORTANT FORMATTING RULES:
      1. Output PLAIN TEXT ONLY. Do NOT use Markdown, bold (**), italics (*), headers (##), or bullet points.
      2. Do not use emojis.
      3. Structure the response in 3 short paragraphs labeled exactly as: "RESUMEN:", "TENDENCIAS:", and "ACCIONES:".
      4. Keep it professional, fluid, and direct.
    `;

    if (type === 'CURRENT') {
        prompt = `
          You are an AI operations manager for a creative technology center (CRTIC).
          Analyze the following JSON data representing the CURRENT active state of equipment loans.
          
          Data: ${JSON.stringify(data).slice(0, 15000)}

          ${formatInstructions}

          Provide a status report in Spanish covering:
          - Utilization pressure and current demand.
          - High demand categories right now.
          - Immediate warnings (shortages or odd patterns).
        `;
    } else {
        prompt = `
          You are an AI data analyst for a creative technology center (CRTIC).
          Analyze the following JSON data representing the HISTORICAL usage logs.

          Data: ${JSON.stringify(data).slice(0, 15000)}

          ${formatInstructions}

          Provide a strategic analysis in Spanish covering:
          - Which user profiles (Roles/Areas) use the most resources.
          - Equipment categories with highest turnover vs underutilized ones.
          - Strategic recommendations for purchasing or maintenance.
        `;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No insights generated.";

  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating report. Please check API configuration or data size.";
  }
};