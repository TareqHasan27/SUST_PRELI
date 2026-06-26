import { env, hasGeminiConfig } from "../config/env.js";
import { buildQueueStormPrompt, buildMergePrompt } from "../prompts/queuestormPrompt.js";
import { extractJsonObject } from "../utils/json.js";

function withTimeout(promise, timeoutMs) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Gemini request timed out")), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

function getResponseText(response) {
  if (!response) return "";

  if (typeof response.text === "string") return response.text;

  if (typeof response.text === "function") return response.text();

  if (response.candidates?.[0]?.content?.parts) {
    return response.candidates[0].content.parts
      .map((part) => part.text || "")
      .join("\n");
  }

  return "";
}

async function callGeminiJson(prompt) {
  const { GoogleGenAI } = await import("@google/genai");

  const ai = new GoogleGenAI({
    apiKey: env.geminiApiKey
  });

  const request = ai.models.generateContent({
    model: env.geminiModel,
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  });

  const response = await withTimeout(request, env.llmTimeoutMs);
  const text = getResponseText(response);

  return extractJsonObject(text);
}

export async function generateWithGemini(ticket, ruleContext, ruleOutput) {
  if (!hasGeminiConfig()) return null;

  try {
    console.log("Using Gemini model:", env.geminiModel);

    const firstPrompt = buildQueueStormPrompt(ticket, ruleContext, ruleOutput);
    const geminiOutput = await callGeminiJson(firstPrompt);

    if (!geminiOutput) {
      console.warn("Gemini first response was empty or invalid JSON.");
      return null;
    }

    const mergePrompt = buildMergePrompt(ticket, ruleOutput, geminiOutput);
    const mergedOutput = await callGeminiJson(mergePrompt);

    if (!mergedOutput) {
      console.warn("Gemini merge response was empty or invalid JSON. Using first Gemini output.");
      return geminiOutput;
    }

    return mergedOutput;
  } catch (error) {
    console.error("Error generating with Gemini:", error?.message || error);
    return null;
  }
}