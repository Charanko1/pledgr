/** Keep provider diagnostics out of user-facing notifications. */
export function walletErrorMessage(error: unknown): string {
  const seen = new Set<unknown>();
  const codes: string[] = [], messages: string[] = [];
  function visit(value: unknown, depth = 0) {
    if (!value || depth > 6 || seen.has(value)) return;
    if (typeof value === "string") { messages.push(value); return; }
    if (typeof value !== "object") return;
    seen.add(value);
    const item = value as Record<string, unknown>;
    if (item.code != null) codes.push(String(item.code));
    for (const key of ["message", "shortMessage", "reason"]) if (typeof item[key] === "string") messages.push(item[key] as string);
    for (const key of ["error", "info", "cause", "data", "originalError"]) visit(item[key], depth + 1);
  }
  visit(error);
  const combined = messages.join(" ");
  if (codes.includes("4001") || codes.includes("ACTION_REJECTED") || /user (rejected|denied)|ethers-user-denied/i.test(combined)) return "Request cancelled in your wallet. You can try again when you’re ready.";
  if (codes.includes("INSUFFICIENT_FUNDS") || /insufficient funds/i.test(combined)) return "Not enough BOT in your wallet to cover this amount and the network fee.";
  if (codes.includes("-32002")) return "A wallet request is already open. Check MetaMask to continue or cancel it.";
  if (codes.some(code => ["NETWORK_ERROR", "TIMEOUT", "4900", "4901"].includes(code))) return "Could not reach the network. Check your wallet connection and try again.";
  if (codes.includes("CALL_EXCEPTION")) return "The contract could not complete this action. Refresh the proposal and check its current status before trying again.";
  const message = messages[0] || "Something went wrong. Please try again.";
  // Preserve our concise application guidance (including submitted transaction hashes).
  return message.length <= 500 && !/payload=|info=|\"jsonrpc\"|\"method\":|version=6\./i.test(message)
    ? message : "The wallet could not complete this request. Check the network and proposal status, then try again.";
}
