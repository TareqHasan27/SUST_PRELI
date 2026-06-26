import { normalizeTicket } from "./normalize.js";
import { detectIntent } from "./intent.js";
import { matchTransactions } from "./transactionMatcher.js";
import { decideEvidenceVerdict } from "./evidenceVerdict.js";
import { chooseSeverity, routeDepartment } from "./routing.js";
import { decideHumanReview } from "./humanReview.js";
import { safeCustomerReply, safeRecommendedNextAction, sanitizeOutput } from "./safety.js";
import { clamp01 } from "../utils/json.js";

function formatAmount(amount) {
  return typeof amount === "number" ? `${amount} BDT` : "the reported amount";
}

function buildAgentSummary(ticket, context) {
  const { intent, match, verdict } = context;
  const tx = match.selectedTransaction;
  const txId = match.relevant_transaction_id;

  if (intent.case_type === "phishing_or_social_engineering") {
    return "Customer reports a suspicious contact or credential-seeking attempt involving PIN, OTP, password, or account-blocking pressure. Treat as a likely social engineering case.";
  }

  if (match.ambiguous) {
    return "Customer complaint has multiple plausible matching transactions in the provided history. More non-secret details are needed before selecting a transaction.";
  }

  if (!tx && verdict === "insufficient_data") {
    if (intent.case_type === "other") {
      return "Customer submitted a vague complaint without enough transaction, amount, or issue details to identify a relevant transaction.";
    }
    return `Customer appears to report ${intent.case_type}, but the provided transaction history is insufficient to identify a matching transaction.`;
  }

  switch (intent.case_type) {
    case "wrong_transfer":
      return `Customer reports a wrong transfer${txId ? ` involving ${txId}` : ""}${tx ? ` for ${formatAmount(tx.amount)} to ${tx.counterparty || "the counterparty"}` : ""}.${match.repeatedRecipientPattern ? " Prior transfers to the same counterparty weaken the wrong-recipient claim." : ""}`;
    case "payment_failed":
      return `Customer reports a failed payment with possible balance deduction${txId ? ` involving ${txId}` : ""}${tx ? ` for ${formatAmount(tx.amount)}` : ""}.`;
    case "refund_request":
      return `Customer requests a refund${txId ? ` related to ${txId}` : ""}${tx ? ` for ${formatAmount(tx.amount)}` : ""}. Eligibility should be checked through official policy.`;
    case "duplicate_payment":
      if (match.duplicatePair) {
        const a = match.duplicatePair.original;
        const b = match.duplicatePair.duplicate;
        return `Customer reports duplicate payment. Two similar completed payments were found: ${a.transaction_id} and ${b.transaction_id}; ${b.transaction_id} is the suspected duplicate.`;
      }
      return "Customer reports duplicate payment, but the provided transaction history does not clearly show two matching completed payments.";
    case "merchant_settlement_delay":
      return `Merchant reports delayed settlement${txId ? ` involving ${txId}` : ""}${tx ? ` for ${formatAmount(tx.amount)}` : ""}.`;
    case "agent_cash_in_issue":
      return `Customer reports an agent cash-in not reflected in balance${txId ? ` involving ${txId}` : ""}${tx ? ` with status ${tx.status || "unknown"}` : ""}.`;
    default:
      return "Customer complaint does not clearly match a defined case type and needs customer support clarification.";
  }
}

function buildReasonCodes(context) {
  const codes = [...context.intent.signals];
  if (context.match.reason) codes.push(context.match.reason);
  if (context.verdict === "inconsistent") codes.push("evidence_inconsistent");
  if (context.verdict === "insufficient_data") codes.push("needs_clarification");
  if (context.match.duplicatePair) codes.push("biller_verification_required");
  if (context.match.repeatedRecipientPattern) codes.push("established_recipient_pattern");
  return [...new Set(codes)].map((code) => code.replace(/[^a-z0-9_]/g, "_").toLowerCase());
}

function confidenceFor(context) {
  if (context.intent.case_type === "phishing_or_social_engineering") return 0.95;
  if (context.verdict === "consistent" && context.match.relevant_transaction_id) return 0.88;
  if (context.verdict === "inconsistent") return 0.75;
  if (context.match.ambiguous) return 0.65;
  if (context.verdict === "insufficient_data") return 0.6;
  return context.intent.confidenceHint || 0.7;
}

export function buildAnalysisContext(ticket) {
  const normalized = normalizeTicket(ticket);
  const intent = detectIntent(ticket, normalized);
  const match = matchTransactions(ticket, normalized, intent);
  const verdict = decideEvidenceVerdict(intent, match);
  const department = routeDepartment(intent.case_type, ticket, verdict);
  const severity = chooseSeverity(intent.case_type, verdict, match);
  const humanReview = decideHumanReview(intent.case_type, verdict, match);

  return {
    normalized,
    intent,
    match,
    verdict,
    department,
    severity,
    humanReview
  };
}

export function buildFallbackOutput(ticket, context = buildAnalysisContext(ticket)) {
  const base = {
    ticket_id: ticket.ticket_id,
    relevant_transaction_id: context.match.relevant_transaction_id,
    evidence_verdict: context.verdict,
    case_type: context.intent.case_type,
    severity: context.severity,
    department: context.department,
    agent_summary: buildAgentSummary(ticket, context),
    recommended_next_action: "",
    customer_reply: "",
    human_review_required: context.humanReview,
    confidence: clamp01(confidenceFor(context)),
    reason_codes: buildReasonCodes(context)
  };

  base.recommended_next_action = safeRecommendedNextAction(base, context);
  base.customer_reply = safeCustomerReply(base, context);

  return sanitizeOutput(base, context);
}
