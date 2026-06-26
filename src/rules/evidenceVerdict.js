export function decideEvidenceVerdict(intent, match) {
  if (intent.case_type === "phishing_or_social_engineering") return "insufficient_data";
  if (match.ambiguous) return "insufficient_data";
  if (!match.selectedTransaction && !match.duplicatePair) return "insufficient_data";
  if (match.repeatedRecipientPattern) return "inconsistent";
  return "consistent";
}
