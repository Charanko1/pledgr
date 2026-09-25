export function buildWalletMessage(walletAddress: string, nonce: string) {
  return [
    "PLEDGR wallet verification",
    "",
    "Sign this message to prove that you control this wallet.",
    "This signature does not authorize a blockchain transaction.",
    "",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}
