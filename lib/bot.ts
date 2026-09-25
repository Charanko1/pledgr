import { formatEther, parseEther } from "ethers";

export function parseBotAmount(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error("BOT amount is required.");
  const atomic = parseEther(normalized);
  if (atomic <= 0n) throw new Error("BOT amount must be greater than zero.");
  return atomic;
}

export function formatBotAmount(value: string | bigint) {
  const atomic = typeof value === "bigint" ? value : BigInt(value || "0");
  return formatEther(atomic);
}

export function fundingPercentage(funded: string | bigint, target: string | bigint) {
  const fundedAtomic = typeof funded === "bigint" ? funded : BigInt(funded || "0");
  const targetAtomic = typeof target === "bigint" ? target : BigInt(target || "0");
  if (targetAtomic <= 0n) return 0;
  const percent = (fundedAtomic * 10000n) / targetAtomic;
  return Number(percent > 10000n ? 10000n : percent) / 100;
}
