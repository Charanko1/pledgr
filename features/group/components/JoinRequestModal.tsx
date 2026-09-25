"use client";
import Modal from "@/components/ui/Modal";

import { X, User, Check, XCircle } from "lucide-react";

interface JoinRequest {
  _id: string;
  membershipId: string;
  groupId: string;
  groupName: string;
  memberName: string;
  walletAddress?: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  requests: JoinRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function JoinRequestModal({
  open,
  onClose,
  requests,
  onApprove,
  onReject,
}: Props) {
  if (!open) return null;

  return (
    <Modal title="Join requests" onClose={onClose}>
      <div className="w-full max-w-2xl rounded-none bg-white p-6 shadow-xl border-2 border-foreground shadow-brutal">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Join Requests</h2>
            <p className="text-sm text-gray-500">
              Approve members before they can access group dashboard.
            </p>
          </div>

          <button aria-label="Close dialog" type="button" onClick={onClose}
            className="rounded-none p-2 hover:bg-gray-100"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[420px] space-y-3 overflow-y-auto">
          {requests.length === 0 ? (
            <div className="rounded-none border border-dashed py-12 text-center text-gray-500 shadow-brutal">
              No pending join requests.
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req._id}
                className="flex items-center justify-between rounded-none border p-4 shadow-brutal"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-primary">
                    <User size={22} />
                  </div>

                  <div>
                    <h3 className="font-semibold">{req.memberName}</h3>

                    <p className="text-sm text-gray-500">
                      {req.groupName}
                    </p>

                    <p className="text-xs text-gray-400">
                      {req.walletAddress || "Wallet not connected"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onApprove(req._id)}
                    className="flex items-center gap-1 rounded-none bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                  >
                    <Check size={16} />
                    Approve
                  </button>

                  <button
                    onClick={() => onReject(req._id)}
                    className="flex items-center gap-1 rounded-none border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 shadow-brutal"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}