"use client";
import Modal from "@/components/ui/Modal";

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateOrgModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim()) return;

    setLoading(true);

    try {
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-");

      await apiClient("/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          slug,
          description: description.trim(),
        }),
      });

      setName("");
      setDescription("");
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error
        ? err.message
        : "Failed to create organization";
      console.error(err);
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Create organization" onClose={onClose}>
      <div className="w-full max-w-lg rounded-none bg-white p-6 space-y-5 border-2 border-foreground shadow-brutal">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Create Organization
          </h2>

          <button aria-label="Close dialog" type="button" onClick={onClose}
            className="text-xl text-gray-500 hover:text-black"
          >
            ✕
          </button>
        </div>

        <div>
          <label htmlFor="createorgmodal-1" className="text-sm font-medium">
            Organization Name
          </label>

          <input id="createorgmodal-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="HIMA Informatika"
            className="mt-2 w-full rounded-none border p-3 outline-none focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="createorgmodal-2" className="text-sm font-medium">
            Description
          </label>

          <textarea id="createorgmodal-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Student organization..."
            className="mt-2 h-28 w-full resize-none rounded-none border p-3 outline-none focus:border-primary"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full rounded-none bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50 border-2 border-foreground shadow-brutal"
        >
          {loading
            ? "Creating..."
            : "Create Organization"}
        </button>
      </div>
    </Modal>
  );
}