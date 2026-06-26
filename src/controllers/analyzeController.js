import { inputSchema } from "../schemas/inputSchema.js";
import { isValidTransactionReference, outputSchema } from "../schemas/outputSchema.js";
import { generateWithGemini } from "../services/geminiService.js";
import { buildAnalysisContext, buildFallbackOutput } from "../rules/fallbackAnalyzer.js";
import { sanitizeOutput } from "../rules/safety.js";
import { clamp01 } from "../utils/json.js";
import { HttpError } from "../utils/errors.js";

function cleanReasonCodes(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
    .slice(0, 8);
}

function mergeGeminiText(ruleOutput, geminiOutput) {
  if (!geminiOutput || typeof geminiOutput !== "object") return ruleOutput;

  return {
    ...ruleOutput,
    // Keep machine-scored fields rule-authoritative for reliability.
    agent_summary: typeof geminiOutput.agent_summary === "string" && geminiOutput.agent_summary.trim()
      ? geminiOutput.agent_summary.trim()
      : ruleOutput.agent_summary,
    recommended_next_action: typeof geminiOutput.recommended_next_action === "string" && geminiOutput.recommended_next_action.trim()
      ? geminiOutput.recommended_next_action.trim()
      : ruleOutput.recommended_next_action,
    customer_reply: typeof geminiOutput.customer_reply === "string" && geminiOutput.customer_reply.trim()
      ? geminiOutput.customer_reply.trim()
      : ruleOutput.customer_reply,
    confidence: clamp01(geminiOutput.confidence, ruleOutput.confidence),
    reason_codes: cleanReasonCodes(geminiOutput.reason_codes, ruleOutput.reason_codes)
  };
}

function finalValidate(output, ticket, context) {
  let sanitized = sanitizeOutput(output, context);

  if (!isValidTransactionReference(sanitized, ticket.transaction_history || [])) {
    sanitized = { ...sanitized, relevant_transaction_id: null, evidence_verdict: "insufficient_data" };
  }

  const parsed = outputSchema.safeParse(sanitized);
  if (!parsed.success) {
    return buildFallbackOutput(ticket, context);
  }

  return parsed.data;
}

export async function analyzeTicket(req, res, next) {
  try {
    
    const parsed = inputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid request schema");
    }

    const ticket = parsed.data;
    ticket.transaction_history = Array.isArray(ticket.transaction_history) ? ticket.transaction_history : [];

    if (!ticket.complaint || !ticket.complaint.trim()) {
      throw new HttpError(422, "Complaint must not be empty");
    }
    
    const context = buildAnalysisContext(ticket);
    const ruleOutput = buildFallbackOutput(ticket, context);
    
    const geminiOutput = await generateWithGemini(ticket, context, ruleOutput);
    const finalCandidate = geminiOutput || ruleOutput;
    const validatedOutput = outputSchema.parse(finalCandidate);
    return res.status(200).json(validatedOutput);
  } catch (error) {
    return next(error);
  }
}
