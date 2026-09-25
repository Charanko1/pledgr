"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { profileKey } from "@/features/profile/hooks/useProfile";
import { apiClient } from "@/lib/api-client";
import { resetBlockchainCache } from "@/lib/blockchain";
import type { Profile } from "@/types/profile";
import { BrowserProvider } from "ethers";

type WalletContextType = {
  address: string;
  connecting: boolean;
  error: string;
  connectWallet: () => Promise<string | null>;
};

const WalletContext = createContext<WalletContextType | null>(null);

const BOT_CHAIN = {
  chainId: "0x3C8",
  chainName: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: ["https://rpc.bohr.life"],
  blockExplorerUrls: ["https://scan.bohr.life"],
};

async function ensureBotChain() {
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (current === BOT_CHAIN.chainId) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BOT_CHAIN.chainId }],
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [BOT_CHAIN],
    });
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [activeAddress, setActiveAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  const persistWallet = useCallback(async (walletAddress: string, provider: BrowserProvider) => {
    const challenge = await apiClient<{ message: string }>("/api/wallet/challenge", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    });

    const signer = await provider.getSigner();
    const signature = await signer.signMessage(challenge.message);

    const saved = await apiClient<Profile>("/api/wallet/connect", {
      method: "POST",
      body: JSON.stringify({ walletAddress, signature }),
    });

    client.setQueryData(profileKey, saved);
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: saved._id,
        name: saved.name,
        email: saved.email,
        role: saved.role,
        walletAddress: saved.walletAddress,
      })
    );
    return saved;
  }, [client]);

  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (pending.current) return null;
    if (!window.ethereum) {
      setError("Install MetaMask to connect your wallet.");
      return null;
    }

    pending.current = true;
    setConnecting(true);
    setError("");

    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const walletAddress = accounts[0];
      if (!walletAddress) throw new Error("No wallet account was selected.");

      await ensureBotChain();
      const provider = new BrowserProvider(window.ethereum);
      await persistWallet(walletAddress, provider);
      const signer = await provider.getSigner();
      const confirmedAddress = await signer.getAddress();
      setActiveAddress(confirmedAddress);
      return confirmedAddress;
    } catch (err) {
      const code = (err as { code?: number }).code;
      setError(
        code === 4001
          ? "Wallet connection or signature was cancelled."
          : err instanceof Error
            ? err.message
            : "Could not connect your wallet. Please try again."
      );
      setActiveAddress("");
      return null;
    } finally {
      pending.current = false;
      setConnecting(false);
    }
  }, [persistWallet]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccounts = accounts as string[];
      resetBlockchainCache();
      if (!activeAddress) return;
      setActiveAddress("");
      setError(nextAccounts?.[0] ? "MetaMask account changed. Reconnect the new wallet." : "Wallet disconnected.");
    };

    const handleChainChanged = () => {
      resetBlockchainCache();
      setActiveAddress("");
      setError("Network changed. Reconnect MetaMask to PLEDGR on BOT Chain.");
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [activeAddress]);

  const value = useMemo(() => ({ address: activeAddress, connecting, error, connectWallet }), [activeAddress, connecting, error, connectWallet]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside DashboardProviders.");
  return context;
}
