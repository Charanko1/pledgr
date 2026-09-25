"use client";
import Modal from "@/components/ui/Modal";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (group: {
    name: string;
    description: string;
  }) => Promise<void>;
}

export default function CreateGroupModal({
  open,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!open) return null;

  const handleCreate = async () => {
    if (saving || !name.trim()) return;
    setSaving(true); setError("");
    try { await onCreate({ name, description }); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Create group" onClose={onClose}>
      <div className="bg-white rounded-none w-full max-w-lg p-6 space-y-5 border-2 border-foreground shadow-brutal">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <h2 className="text-2xl font-bold">
            Create Group
          </h2>

          <button aria-label="Close dialog" type="button" onClick={onClose}>
            <X />
          </button>
        </div>

        <div>
          <label htmlFor="creategroupmodal-1" className="text-sm font-medium">
            Group Name
          </label>

          <input id="creategroupmodal-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Event Division"
            className="w-full mt-2 border rounded-none p-3 outline-none focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="creategroupmodal-2" className="text-sm font-medium">
            Description
          </label>

          <textarea id="creategroupmodal-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Manage all event proposals"
            className="w-full mt-2 border rounded-none p-3 h-28 outline-none focus:border-primary"
          />
        </div>

        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button
          disabled={saving}
          onClick={handleCreate}
          className="w-full bg-primary text-white py-3 rounded-none hover:bg-primary-hover border-2 border-foreground shadow-brutal"
        >
          {saving ? "Saving…" : "Create Group"}
        </button>
      </div>
    </Modal>
  );
}