import { Contract, EventLog, Interface, JsonRpcProvider } from "ethers";
import ABI from "@/lib/abi/TrustKasTreasury.json";

export const REALTIME_RPC_URL = process.env.NEXT_PUBLIC_BOT_RPC_URL || "https://rpc.bohr.life";
export const REALTIME_CHAIN_ID = 968;

export type BlockchainEventType =
  | "CampaignCreated"
  | "CampaignApproved"
  | "Donated"
  | "CampaignCancelled"
  | "WithdrawalRequested"
  | "ValidatorReleaseApproved"
  | "ValidatorReleaseApprovalReset"
  | "AdminReleaseApproved"
  | "RefundClaimed"
  | "FundReleased";

export interface BlockchainEvent {
  type: BlockchainEventType;
  proposalId: string;
  txHash: string;
  blockNumber: number;
  actor?: string;
  recipient?: string;
  amount?: string;
}

const iface = new Interface(ABI);
let readProvider: JsonRpcProvider | null = null;
let readContract: Contract | null = null;
const processedEventKeys = new Set<string>();
const MAX_PROCESSED_EVENTS = 500;

export function getRealtimeProvider() {
  if (readProvider) return readProvider;
  readProvider = new JsonRpcProvider(
    REALTIME_RPC_URL,
    { name: "bot-chain-testnet", chainId: REALTIME_CHAIN_ID },
    { staticNetwork: true }
  );
  return readProvider;
}

export function getRealtimeContract() {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
  if (!address) return null;
  if (!readContract || readContract.target !== address) {
    readContract = new Contract(address, ABI, getRealtimeProvider());
  }
  return readContract;
}

function getEventLog(args: unknown[]): EventLog | null {
  const candidate = args[args.length - 1];
  if (
    candidate &&
    typeof candidate === "object" &&
    "transactionHash" in candidate &&
    "blockNumber" in candidate
  ) return candidate as EventLog;
  return null;
}

async function decodeBlockchainEvent(type: BlockchainEventType, log: EventLog): Promise<BlockchainEvent | null> {
  // Dynamic string values that are indexed in Solidity are returned by ethers
  // as Indexed hashes. We recover the original proposalId from tx calldata.
  const tx = await getRealtimeProvider().getTransaction(log.transactionHash);
  if (!tx) return null;
  const parsedTx = iface.parseTransaction({ data: tx.data, value: tx.value });
  if (!parsedTx || String(parsedTx.args[0]) === "") return null;
  const proposalId = String(parsedTx.args[0]);

  if (type === "CampaignCreated") {
    const logEvent = iface.parseLog(log);
    if (!logEvent) return null;
    return { type, proposalId, actor: String(logEvent.args[1]), recipient: String(logEvent.args[2]), amount: String(logEvent.args[3]), txHash: log.transactionHash, blockNumber: log.blockNumber };
  }
  if (type === "CampaignApproved") {
    const logEvent = iface.parseLog(log);
    if (!logEvent) return null;
    return { type, proposalId, actor: String(logEvent.args[1]), txHash: log.transactionHash, blockNumber: log.blockNumber };
  }
  if (type === "Donated") {
    const logEvent = iface.parseLog(log);
    if (!logEvent) return null;
    return { type, proposalId, actor: String(logEvent.args[0]), amount: String(logEvent.args[1]), txHash: log.transactionHash, blockNumber: log.blockNumber };
  }
  if (type === "WithdrawalRequested") {
    const logEvent = iface.parseLog(log);
    if (!logEvent) return null;
    return { type, proposalId, actor: String(logEvent.args[1]), recipient: String(logEvent.args[1]), txHash: log.transactionHash, blockNumber: log.blockNumber };
  }
  if (type === "ValidatorReleaseApproved") {
    const logEvent = iface.parseLog(log);
    if (!logEvent) return null;
    return { type, proposalId, actor: String(logEvent.args[1]), txHash: log.transactionHash, blockNumber: log.blockNumber };
  }
  if (type === "ValidatorReleaseApprovalReset") {
    const logEvent = iface.parseLog(log);
    if (!logEvent) return null;
    return { type, proposalId, actor: String(logEvent.args[1]), txHash: log.transactionHash, blockNumber: log.blockNumber };
  }
  if (type === "AdminReleaseApproved") {
    const logEvent = iface.parseLog(log);
    if (!logEvent) return null;
    return { type, proposalId, actor: String(logEvent.args[1]), txHash: log.transactionHash, blockNumber: log.blockNumber };
  }
  if (type === "CampaignCancelled") {
    const logEvent = iface.parseLog(log);
    if (!logEvent) return null;
    return { type, proposalId, actor: String(logEvent.args[1]), txHash: log.transactionHash, blockNumber: log.blockNumber };
  }
  if (type === "RefundClaimed") {
    const logEvent = iface.parseLog(log);
    if (!logEvent) return null;
    return { type, proposalId, actor: String(logEvent.args[1]), amount: String(logEvent.args[2]), txHash: log.transactionHash, blockNumber: log.blockNumber };
  }

  const logEvent = iface.parseLog(log);
  if (!logEvent) return null;
  return { type, proposalId, recipient: String(logEvent.args[1]), amount: String(logEvent.args[2]), txHash: log.transactionHash, blockNumber: log.blockNumber };
}

export async function subscribeToTrustKasEvents(handlers: {
  onEvent: (event: BlockchainEvent) => void;
  onStatus: (status: "connected" | "disconnected") => void;
}) {
  const contract = getRealtimeContract();
  if (!contract) {
    handlers.onStatus("disconnected");
    return () => undefined;
  }

  try {
    await getRealtimeProvider().getBlockNumber();
  } catch (error) {
    console.error("BLOCKCHAIN RPC CONNECTION ERROR:", error);
    handlers.onStatus("disconnected");
    return () => undefined;
  }

  const listeners: Array<{ name: BlockchainEventType; listener: (...args: any[]) => void }> = [];

  const attach = (name: BlockchainEventType) => {
    const listener = (...args: any[]) => {
      const log = getEventLog(args);
      if (!log) return;
      const key = `${log.transactionHash.toLowerCase()}:${name}`;
      if (processedEventKeys.has(key)) return;
      processedEventKeys.add(key);
      if (processedEventKeys.size > MAX_PROCESSED_EVENTS) {
        const oldest = processedEventKeys.values().next().value;
        if (oldest) processedEventKeys.delete(oldest);
      }

      void decodeBlockchainEvent(name, log)
        .then((event) => {
          if (event) handlers.onEvent(event);
          else processedEventKeys.delete(key);
        })
        .catch((error) => {
          console.error(`BLOCKCHAIN ${name} DECODE ERROR:`, error);
          processedEventKeys.delete(key);
        });
    };
    contract.on(name, listener);
    listeners.push({ name, listener });
  };

  attach("CampaignCreated");
  attach("CampaignApproved");
  attach("Donated");
  attach("CampaignCancelled");
  attach("WithdrawalRequested");
  attach("ValidatorReleaseApproved");
  attach("ValidatorReleaseApprovalReset");
  attach("AdminReleaseApproved");
  attach("RefundClaimed");
  attach("FundReleased");
  handlers.onStatus("connected");

  return () => {
    for (const { name, listener } of listeners) contract.off(name, listener);
    handlers.onStatus("disconnected");
  };
}

export function resetRealtimeBlockchainCache() {
  readContract = null;
  readProvider = null;
  processedEventKeys.clear();
}
