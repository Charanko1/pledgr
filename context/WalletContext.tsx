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
import { resetBlockchainCache, ensureChain } from "@/lib/blockchain";
import type { Profile } from "@/types/profile";
import { BrowserProvider } from "ethers";

type WalletContextType = {
  address: string;
  connecting: boolean;
  error: string;
  connectWallet: () => Promise<string | null>;
  changeWallet: () => Promise<string | null>;
  disconnectWallet: () => Promise<void>;
};

const WalletContext = createContext<WalletContextType | null>(null);

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

  const connect = useCallback(async (chooseAccount = false): Promise<string | null> => {
    if (pending.current) return null;
    if (!window.ethereum) {
      setError("Install MetaMask to connect your wallet.");
      return null;
    }

    pending.current = true;
    setConnecting(true);
    setError("");

    try {
      if (chooseAccount) await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const walletAddress = accounts[0];
      if (!walletAddress) throw new Error("No wallet account was selected.");

      await ensureChain();
      const provider = new BrowserProvider(window.ethereum);
      await persistWallet(walletAddress, provider);
      const signer = await provider.getSigner();
      const confirmedAddress = await signer.getAddress();
      if (confirmedAddress.toLowerCase() !== walletAddress.toLowerCase()) throw new Error("Selected account changed during verification. Connect again.");
      localStorage.removeItem("pledgr:wallet-disconnected");
      resetBlockchainCache();
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

  const connectWallet = useCallback(() => connect(false), [connect]);
  const changeWallet = useCallback(() => connect(true), [connect]);
  const disconnectWallet = useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setConnecting(true); setError("");
    localStorage.setItem("pledgr:wallet-disconnected", "true");
    setActiveAddress(""); resetBlockchainCache();
    try {
      await window.ethereum?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    } catch {
      // Some providers do not expose permission revocation. The app remains
      // disconnected and explicit reconnection is required before signing.
    } finally { pending.current = false; setConnecting(false); }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      if (pending.current) return;
      const nextAccounts = accounts as string[];
      resetBlockchainCache();
      if (!activeAddress) return;
      setActiveAddress("");
      setError(nextAccounts?.[0] ? "MetaMask account changed. Reconnect the new wallet." : "Wallet disconnected.");
    };

    const handleChainChanged = () => {
      if (pending.current) return;
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

  const value = useMemo(() => ({ address: activeAddress, connecting, error, connectWallet, changeWallet, disconnectWallet }), [activeAddress, connecting, error, connectWallet, changeWallet, disconnectWallet]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside DashboardProviders.");
  return context;
}
