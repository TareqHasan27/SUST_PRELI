import { CASE_TO_DEPARTMENT } from "../config/enums.js";

export function routeDepartment(caseType, ticket = {}, verdict = "insufficient_data") {
  if (caseType === "refund_request") {
    const text = String(ticket.complaint || "").toLowerCase();
    if (verdict === "inconsistent" || text.includes("dispute") || text.includes("contest")) {
      return "dispute_resolution";
    }
    return "customer_support";
  }
  return CASE_TO_DEPARTMENT[caseType] || "customer_support";
}

export function chooseSeverity(caseType, verdict, match) {
  if (caseType === "phishing_or_social_engineering") return "critical";
  if (caseType === "merchant_settlement_delay") return "medium";
  if (caseType === "other") return "low";
  if (caseType === "refund_request") return "low";
  if (caseType === "wrong_transfer" && verdict === "inconsistent") return "medium";
  if (caseType === "wrong_transfer" && match?.ambiguous) return "medium";
  if (["wrong_transfer", "payment_failed", "duplicate_payment", "agent_cash_in_issue"].includes(caseType)) return "high";
  return "low";
}
