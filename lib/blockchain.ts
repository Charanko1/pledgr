"use client";

import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  JsonRpcSigner,
} from "ethers";
import ABI from "@/lib/abi/TrustKasTreasury.json";
import { BLOCKCHAIN_POLLING_INTERVAL_MS } from "@/lib/realtime";

const DEFAULT_RPC_URL = "https://rpc.bohr.life";
const DEFAULT_EXPLORER_URL = "https://scan.bohr.life";
const DEFAULT_CHAIN_ID = 968;

function getConfiguredChainId() {
  const parsed = Number(process.env.NEXT_PUBLIC_BOT_CHAIN_ID || DEFAULT_CHAIN_ID);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

function getConfiguredChainIdHex() {
  return `0x${getConfiguredChainId().toString(16)}`;
}

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
export const BOT_CHAIN_ID = getConfiguredChainIdHex();
export const BOT_RPC_URL =
  process.env.NEXT_PUBLIC_BOT_RPC_URL || DEFAULT_RPC_URL;
export const BOT_EXPLORER_URL =
  process.env.NEXT_PUBLIC_BOT_EXPLORER_URL || DEFAULT_EXPLORER_URL;

const BOT_CHAIN = {
  chainId: BOT_CHAIN_ID,
  chainName:
    getConfiguredChainId() === 677 ? "BOT Chain Mainnet" : "BOT Chain Testnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: [BOT_RPC_URL],
  blockExplorerUrls: [BOT_EXPLORER_URL],
};

let provider: BrowserProvider | null = null;
let signer: JsonRpcSigner | null = null;
let contract: Contract | null = null;
let readProvider: JsonRpcProvider | null = null;
let readContract: Contract | null = null;

function assertContractAddress() {
  if (!CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not configured.");
  }
}

async function ensureChain() {
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (current === BOT_CHAIN.chainId) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BOT_CHAIN.chainId }],
    });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [BOT_CHAIN],
      });
      return;
    }

    throw error;
  }
}

export async function getProvider() {
  if (!window.ethereum) {
    throw new Error("Please install MetaMask.");
  }

  await ensureChain();

  if (provider) return provider;

  await window.ethereum.request({ method: "eth_requestAccounts" });
  provider = new BrowserProvider(window.ethereum);
  return provider;
}

export async function getSigner() {
  const p = await getProvider();
  const accounts = (await window.ethereum.request({
    method: "eth_accounts",
  })) as string[];

  if (!accounts[0]) {
    signer = null;
    throw new Error("Connect a MetaMask wallet first.");
  }

  const nextSigner = await p.getSigner();
  const nextAddress = (await nextSigner.getAddress()).toLowerCase();
  const cachedAddress = signer
    ? (await signer.getAddress()).toLowerCase()
    : "";

  if (!signer || cachedAddress !== nextAddress) {
    signer = nextSigner;
  }

  return signer;
}

export async function getWalletAddress() {
  const s = await getSigner();
  return s.getAddress();
}

export async function getContract() {
  assertContractAddress();

  const s = await getSigner();
  contract = new Contract(CONTRACT_ADDRESS, ABI, s);
  return contract;
}

export async function getContractAdmin() {
  assertContractAddress();

  // Read-only admin checks never need MetaMask permissions or wallet prompts.
  const readOnlyContract = getReadContract();
  return (await readOnlyContract.admin()) as string;
}

export async function isContractAdmin(address?: string) {
  const wallet = address || (await getWalletAddress());
  const admin = await getContractAdmin();
  return admin.toLowerCase() === wallet.toLowerCase();
}

export function getReadProvider() {
  if (readProvider) return readProvider;

  readProvider = new JsonRpcProvider(
    BOT_RPC_URL,
    {
      name: `bot-chain-${getConfiguredChainId()}`,
      chainId: getConfiguredChainId(),
    },
    { staticNetwork: true }
  );

  (readProvider as JsonRpcProvider & { pollingInterval?: number }).pollingInterval = BLOCKCHAIN_POLLING_INTERVAL_MS;

  return readProvider;
}

export function getReadContract() {
  assertContractAddress();

  if (!readContract || readContract.target !== CONTRACT_ADDRESS) {
    readContract = new Contract(CONTRACT_ADDRESS, ABI, getReadProvider());
  }

  return readContract;
}

export async function getTreasuryBalance() {
  const readContractInstance = getReadContract();
  return readContractInstance.getBalance();
}

export async function getCampaignOnChain(proposalId: string) {
  assertContractAddress();
  return getReadContract().getCampaign(proposalId);
}

export function getExplorerTxUrl(txHash: string) {
  return `${BOT_EXPLORER_URL}/tx/${txHash}`;
}

export function resetBlockchainCache() {
  provider = null;
  signer = null;
  contract = null;
  readContract = null;
  readProvider?.destroy();
  readProvider = null;
}
