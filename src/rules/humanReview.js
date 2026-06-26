export function decideHumanReview(caseType, verdict, match) {
  if (caseType === "phishing_or_social_engineering") return true;
  if (caseType === "wrong_transfer") return verdict !== "insufficient_data";
  if (caseType === "duplicate_payment") return Boolean(match?.duplicatePair || match?.selectedTransaction);
  if (caseType === "agent_cash_in_issue") return Boolean(match?.selectedTransaction);
  if (verdict === "inconsistent") return true;
  if (caseType === "refund_request" && verdict === "inconsistent") return true;
  return false;
}
