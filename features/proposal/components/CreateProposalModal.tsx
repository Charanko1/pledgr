"use client";

import Modal from "@/components/ui/Modal";
import { useState } from "react";
import { X } from "lucide-react";

interface ProposalForm {
  title: string;
  description: string;
  target: string;
  deadline: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (proposal: ProposalForm) => Promise<void>;
  recipientWallet?: string;
}

export default function CreateProposalModal({ open, onClose, onCreate, recipientWallet = "" }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit() {
    if (saving) return;
    setError("");
    if (!title.trim()) return setError("Proposal title is required.");
    if (!description.trim()) return setError("Description is required.");
    if (!target.trim() || !/^\d+(\.\d{1,18})?$/.test(target.trim()) || Number(target) <= 0) return setError("Enter a valid BOT target with up to 18 decimals.");
    if (!deadline || new Date(deadline).getTime() <= Date.now()) return setError("Choose a future deadline.");

    setSaving(true);
    try {
      await onCreate({ title: title.trim(), description: description.trim(), target: target.trim(), deadline });
      setTitle(""); setDescription(""); setTarget(""); setDeadline("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create proposal" onClose={onClose}>
      <div className="bg-white w-full max-w-xl rounded-none p-6 space-y-4 border-2 border-foreground shadow-brutal">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <h2 className="text-2xl font-bold">New Proposal</h2>
          <button aria-label="Close dialog" type="button" onClick={onClose}><X /></button>
        </div>

        <div>
          <label htmlFor="createproposalmodal-1" className="text-sm font-medium">Proposal Title</label>
          <input id="createproposalmodal-1" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-none p-3 mt-2 shadow-brutal" placeholder="Community Workshop" />
        </div>

        <div>
          <label htmlFor="createproposalmodal-2" className="text-sm font-medium">Description</label>
          <textarea id="createproposalmodal-2" maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-none p-3 mt-2 h-28 shadow-brutal" placeholder="Describe the fundraising purpose..." />
        </div>

        <div className="border-2 border-foreground bg-gray-50 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Fundraiser wallet</p>
          <p className="mt-1 text-sm font-semibold break-all">{recipientWallet || "Connect MetaMask before submitting."}</p>
          <p className="text-xs text-gray-500 mt-1">Released campaign funds are sent by the smart contract to this verified wallet.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="createproposalmodal-3" className="text-sm font-medium">Target (BOT)</label>
            <input id="createproposalmodal-3" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))} className="w-full border rounded-none p-3 mt-2 shadow-brutal" placeholder="300" />
          </div>
          <div>
            <label htmlFor="createproposalmodal-4" className="text-sm font-medium">Deadline</label>
            <input id="createproposalmodal-4" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full border rounded-none p-3 mt-2 shadow-brutal" />
          </div>
        </div>

        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button disabled={saving || !recipientWallet} onClick={() => void handleSubmit()} className="w-full bg-primary disabled:bg-gray-400 text-white py-3 rounded-none hover:bg-primary-hover border-2 border-foreground shadow-brutal">
          {saving ? "Saving…" : "Submit Proposal"}
        </button>
      </div>
    </Modal>
  );
}
