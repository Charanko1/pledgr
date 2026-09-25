import { Contract, Interface, JsonRpcProvider, isAddress } from "ethers";
import ABI from "@/lib/abi/TrustKasTreasury.json";

export const BOT_CHAIN_ID = 968;
export const BOT_RPC_URL = process.env.BOT_RPC_URL || process.env.NEXT_PUBLIC_BOT_RPC_URL || "https://rpc.bohr.life";
export const SERVER_CONTRACT_ADDRESS = process.env.TRUSTKAS_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

const iface = new Interface(ABI);
const FUNCTION_BY_EVENT = {
  CampaignCreated: "createCampaign",
  CampaignApproved: "approveCampaign",
  Donated: "donate",
  CampaignCancelled: "cancelCampaign",
  ValidatorReleaseApproved: "approveValidatorRelease",
  WithdrawalRequested: "requestWithdrawal",
  ValidatorReleaseApprovalReset: "resetValidatorReleaseApproval",
  AdminReleaseApproved: "approveAdminRelease",
  RefundClaimed: "claimRefund",
  FundReleased: "releaseFund",
} as const;
export type VerifiedEventType = keyof typeof FUNCTION_BY_EVENT;

let provider: JsonRpcProvider | null = null;

export function getServerProvider() {
  if (provider) return provider;
  provider = new JsonRpcProvider(BOT_RPC_URL, { name: "bot-chain-testnet", chainId: BOT_CHAIN_ID }, { staticNetwork: true });
  return provider;
}

export function assertContractAddress() {
  if (!SERVER_CONTRACT_ADDRESS || !isAddress(SERVER_CONTRACT_ADDRESS)) throw new Error("PLEDGR contract address is not configured correctly.");
}

export function getServerContract() {
  assertContractAddress();
  return new Contract(SERVER_CONTRACT_ADDRESS, ABI, getServerProvider());
}

export async function getConfirmedTransaction(txHash: string) {
  const tx = await getServerProvider().getTransaction(txHash);
  if (!tx) throw new Error("Transaction not found on the BOT blockchain.");
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Transaction is not confirmed successfully.");
  if (!tx.to || tx.to.toLowerCase() !== SERVER_CONTRACT_ADDRESS.toLowerCase()) throw new Error("Transaction was not sent to the PLEDGR contract.");
  return { tx, receipt };
}

export async function verifyContractEvent(txHash: string, eventType: VerifiedEventType, expectedProposalId: string) {
  assertContractAddress();
  const { tx, receipt } = await getConfirmedTransaction(txHash);
  const parsedTransaction = iface.parseTransaction({ data: tx.data, value: tx.value });
  const expectedFunction = FUNCTION_BY_EVENT[eventType];
  if (!parsedTransaction || parsedTransaction.name !== expectedFunction) throw new Error(`Transaction does not call ${expectedFunction}().`);

  const txProposalId = String(parsedTransaction.args[0]);
  if (txProposalId !== expectedProposalId) throw new Error("Blockchain transaction does not match this proposal.");

  const parsedEvent = receipt.logs
    .filter((log) => log.address.toLowerCase() === SERVER_CONTRACT_ADDRESS.toLowerCase())
    .map((log) => { try { return iface.parseLog(log); } catch { return null; } })
    .find((event) => event?.name === eventType);
  if (!parsedEvent) throw new Error(`Transaction does not contain a valid ${eventType} event.`);

  if (eventType === "Donated" && tx.value !== parsedEvent.args[1]) throw new Error("Donation transaction value does not match the blockchain event.");
  return { tx, receipt, parsedEvent };
}

export function resetServerBlockchainProvider() { provider = null; }
