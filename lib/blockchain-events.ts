import { Contract, EventLog, Interface, JsonRpcProvider } from "ethers";
import ABI from "@/lib/abi/TrustKasTreasury.json";
import { BLOCKCHAIN_POLLING_INTERVAL_MS } from "@/lib/realtime";

const DEFAULT_RPC_URL = "https://rpc.bohr.life";
const DEFAULT_CHAIN_ID = 968;

function readChainId(value: string | undefined) {
  const parsed = Number(value || DEFAULT_CHAIN_ID);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

export const REALTIME_RPC_URL =
  process.env.NEXT_PUBLIC_BOT_RPC_URL || DEFAULT_RPC_URL;
export const REALTIME_CHAIN_ID = readChainId(process.env.NEXT_PUBLIC_BOT_CHAIN_ID);

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

interface Subscriber {
  onEvent: (event: BlockchainEvent) => void;
  onStatus: (status: "connected" | "disconnected") => void;
}

const iface = new Interface(ABI);
let readProvider: JsonRpcProvider | null = null;
let readContract: Contract | null = null;
let sharedContract: Contract | null = null;
let sharedStarted = false;
let startPromise: Promise<void> | null = null;
const subscribers = new Set<Subscriber>();
const listeners: Array<{
  name: BlockchainEventType;
  listener: (...args: any[]) => void;
}> = [];
const processedEventKeys = new Set<string>();
const MAX_PROCESSED_EVENTS = 1000;

export function getRealtimeProvider() {
  if (readProvider) return readProvider;

  readProvider = new JsonRpcProvider(
    REALTIME_RPC_URL,
    {
      name: `bot-chain-${REALTIME_CHAIN_ID}`,
      chainId: REALTIME_CHAIN_ID,
    },
    { staticNetwork: true }
  );

  // Contract events over an HTTP JSON-RPC provider are delivered by polling.
  // A conservative interval keeps the browser responsive without hammering the RPC.
  (readProvider as JsonRpcProvider & { pollingInterval?: number }).pollingInterval = BLOCKCHAIN_POLLING_INTERVAL_MS;

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
  ) {
    return candidate as EventLog;
  }
  return null;
}

function notifyStatus(status: "connected" | "disconnected") {
  for (const subscriber of subscribers) {
    try {
      subscriber.onStatus(status);
    } catch (error) {
      console.error("BLOCKCHAIN STATUS HANDLER ERROR:", error);
    }
  }
}

function emitEvent(event: BlockchainEvent) {
  for (const subscriber of subscribers) {
    try {
      subscriber.onEvent(event);
    } catch (error) {
      console.error("BLOCKCHAIN EVENT HANDLER ERROR:", error);
    }
  }
}

function markProcessed(key: string) {
  if (processedEventKeys.has(key)) return false;

  processedEventKeys.add(key);
  if (processedEventKeys.size > MAX_PROCESSED_EVENTS) {
    const oldest = processedEventKeys.values().next().value;
    if (oldest) processedEventKeys.delete(oldest);
  }

  return true;
}

async function decodeBlockchainEvent(
  type: BlockchainEventType,
  log: EventLog
): Promise<BlockchainEvent | null> {
  const logEvent = iface.parseLog(log);
  if (!logEvent) return null;

  // Donated exposes proposalId as a non-indexed event argument, so no extra
  // transaction RPC call is needed for this high-frequency event.
  if (type === "Donated") {
    return {
      type,
      proposalId: String(logEvent.args[2]),
      actor: String(logEvent.args[0]),
      amount: String(logEvent.args[1]),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    };
  }

  // Dynamic strings are indexed in the remaining events. Ethers exposes them
  // as Indexed hashes, so recover the original proposalId from tx calldata.
  const tx = await getRealtimeProvider().getTransaction(log.transactionHash);
  if (!tx) return null;

  const parsedTx = iface.parseTransaction({ data: tx.data, value: tx.value });
  if (!parsedTx || String(parsedTx.args[0] ?? "") === "") return null;

  const proposalId = String(parsedTx.args[0]);

  switch (type) {
    case "CampaignCreated":
      return {
        type,
        proposalId,
        actor: String(logEvent.args[1]),
        recipient: String(logEvent.args[2]),
        amount: String(logEvent.args[3]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    case "CampaignApproved":
      return {
        type,
        proposalId,
        actor: String(logEvent.args[1]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    case "WithdrawalRequested":
      return {
        type,
        proposalId,
        actor: String(logEvent.args[1]),
        recipient: String(logEvent.args[1]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    case "ValidatorReleaseApproved":
      return {
        type,
        proposalId,
        actor: String(logEvent.args[1]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    case "ValidatorReleaseApprovalReset":
      return {
        type,
        proposalId,
        actor: String(logEvent.args[1]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    case "AdminReleaseApproved":
      return {
        type,
        proposalId,
        actor: String(logEvent.args[1]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    case "CampaignCancelled":
      return {
        type,
        proposalId,
        actor: String(logEvent.args[1]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    case "RefundClaimed":
      return {
        type,
        proposalId,
        actor: String(logEvent.args[1]),
        amount: String(logEvent.args[2]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    case "FundReleased":
      return {
        type,
        proposalId,
        recipient: String(logEvent.args[1]),
        amount: String(logEvent.args[2]),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
  }
}

function attachEventListeners(contract: Contract) {
  if (sharedStarted) return;

  const attach = (name: BlockchainEventType) => {
    const listener = (...args: any[]) => {
      const log = getEventLog(args);
      if (!log) return;

      const key = `${log.transactionHash.toLowerCase()}:${name}`;
      if (!markProcessed(key)) return;

      void decodeBlockchainEvent(name, log)
        .then((event) => {
          if (event) emitEvent(event);
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

  sharedStarted = true;
}

function detachEventListeners() {
  if (!sharedContract) return;

  for (const { name, listener } of listeners) {
    sharedContract.off(name, listener);
  }
  listeners.length = 0;
  sharedStarted = false;
}

async function startSharedSubscription() {
  if (sharedStarted) return;
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const contract = getRealtimeContract();
    if (!contract) throw new Error("PLEDGR contract address is not configured.");

    await getRealtimeProvider().getBlockNumber();
    sharedContract = contract;
    attachEventListeners(contract);
    notifyStatus("connected");
  })().catch((error) => {
    notifyStatus("disconnected");
    throw error;
  }).finally(() => {
    startPromise = null;
  });

  return startPromise;
}

export async function subscribeToTrustKasEvents(subscriber: Subscriber) {
  subscribers.add(subscriber);

  const contract = getRealtimeContract();
  if (!contract) {
    subscriber.onStatus("disconnected");
    return () => {
      subscribers.delete(subscriber);
    };
  }

  try {
    await startSharedSubscription();
  } catch (error) {
    console.error("BLOCKCHAIN RPC CONNECTION ERROR:", error);
    subscriber.onStatus("disconnected");
  }

  return () => {
    subscribers.delete(subscriber);

    if (subscribers.size === 0) {
      detachEventListeners();
      sharedContract = null;
      processedEventKeys.clear();
    }
  };
}

export function resetRealtimeBlockchainCache() {
  detachEventListeners();
  sharedContract = null;
  readContract = null;
  readProvider?.destroy();
  readProvider = null;
  processedEventKeys.clear();
  subscribers.clear();
  startPromise = null;
}
