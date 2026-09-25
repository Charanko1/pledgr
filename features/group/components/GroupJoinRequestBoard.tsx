"use client";

import { Check, User, XCircle } from "lucide-react";

export interface GroupJoinRequest {
  _id: string;
  membershipId: string;
  groupId: string;
  memberName: string;
  walletAddress?: string;
  createdAt: string;
}

interface Props {
  requests: GroupJoinRequest[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export default function GroupJoinRequestBoard({ requests, onApprove, onReject }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Join Requests</h2>
        <p className="text-sm text-gray-500">Review requests for this group. Updates appear automatically.</p>
      </div>
      {requests.length === 0 ? (
        <div className="bg-white border p-8 text-center text-gray-500 shadow-brutal">No pending join requests.</div>
      ) : (
        requests.map((request) => (
          <div key={request._id} className="bg-white border p-4 shadow-brutal flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 shrink-0 rounded-full bg-primary text-white flex items-center justify-center font-bold"><User size={18} /></div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{request.memberName}</p>
                <p className="text-xs text-gray-500">Requested {new Date(request.createdAt).toLocaleString()}</p>
                {request.walletAddress && <p className="text-xs text-gray-400 break-all">{request.walletAddress}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onApprove(request._id)} className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-2 border-2 border-foreground shadow-brutal"><Check size={16} />Approve</button>
              <button onClick={() => onReject(request._id)} className="inline-flex items-center gap-2 bg-red-600 text-white px-3 py-2 border-2 border-foreground shadow-brutal"><XCircle size={16} />Reject</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
