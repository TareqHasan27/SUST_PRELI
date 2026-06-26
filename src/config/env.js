import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// env.js is inside src/config/
// so ../../.env points to project root .env
const envPath = path.resolve(__dirname, "../../.env");

const result = dotenv.config({ path: envPath });

if (result.error && process.env.NODE_ENV !== "production") {
  console.warn("Could not load .env file:", result.error.message);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 12000)
};

export function hasGeminiConfig() {
  console.log("Gemini key loaded:", env.geminiApiKey);
  return Boolean(env.geminiApiKey && env.geminiApiKey.trim().length > 0);
}