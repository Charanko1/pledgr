export function resolveBotNetwork(chainId: string | undefined) {
  const id = Number(chainId || 677);
  if (id === 677) return { chainId: id, name: "BOT Chain Mainnet", label: "MAINNET", rpcUrl: "https://rpc.botchain.ai", explorerUrl: "https://scan.botchain.ai" };
  if (id === 968) return { chainId: id, name: "BOT Chain Testnet", label: "TESTNET", rpcUrl: "https://rpc.bohr.life", explorerUrl: "https://scan.bohr.life" };
  throw new Error("Unsupported BOT network. Set NEXT_PUBLIC_BOT_CHAIN_ID to 677 (mainnet) or 968 (testnet).");
}

// Direct property access is required for Next.js to embed public configuration.
export const BOT_NETWORK = resolveBotNetwork(process.env.NEXT_PUBLIC_BOT_CHAIN_ID);
