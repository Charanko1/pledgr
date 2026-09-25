"use client";
import Modal from "@/components/ui/Modal";

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function JoinOrgModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleJoin() {
    if (!code.trim()) return;

    setLoading(true);

    try {
      await apiClient("/api/organizations/join", {
        method: "POST",
        body: JSON.stringify({ code: code.toUpperCase().trim() }),
      });

      setCode("");
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error
        ? err.message
        : "Failed to join organization";
      console.error(err);
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Join organization" onClose={onClose}>
      <div className="w-full max-w-md rounded-none bg-white p-6 space-y-5 border-2 border-foreground shadow-brutal">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Join Organization
          </h2>

          <button aria-label="Close dialog" type="button" onClick={onClose}
            className="text-xl text-gray-500 hover:text-black"
          >
            ✕
          </button>
        </div>

        <div>
          <label htmlFor="joinorgmodal-1" className="text-sm font-medium">
            Invitation Code
          </label>

          <input id="joinorgmodal-1"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase())
            }
            placeholder="INFO-7X92KD"
            className="mt-2 w-full rounded-none border p-3 uppercase outline-none focus:border-primary"
          />
        </div>

        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full rounded-none bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 border-2 border-foreground shadow-brutal"
        >
          {loading ? "Joining..." : "Join Now"}
        </button>
      </div>
    </Modal>
  );
}