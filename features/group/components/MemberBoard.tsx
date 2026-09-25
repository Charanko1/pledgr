"use client";

import { ShieldCheck, ShieldOff, UserMinus } from "lucide-react";
import type { GroupRole, Member } from "@/types/group";

interface Props {
  members: Member[];
  currentRole: GroupRole;
  onSetValidator: (memberId: string) => void;
  onRemoveValidator: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
}

export default function MemberBoard({ members, currentRole, onSetValidator, onRemoveValidator, onRemoveMember }: Props) {
  const canManage = currentRole === "Admin";
  if (!members.length) return <div className="bg-white border p-8 text-center shadow-brutal">No active members.</div>;

  return (
    <div className="space-y-4">
      {members.map((member) => (
        <div key={member.membershipId} className="bg-white border p-4 flex flex-wrap gap-4 justify-between items-center shadow-brutal">
          <div className="flex gap-4 items-center min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-full bg-primary text-white flex items-center justify-center font-bold">
              {(member.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{member.name}</h3>
              <p className="text-sm text-gray-500">{member.role}</p>
              {member.walletAddress && <p className="text-xs text-gray-400 truncate max-w-[24rem]">{member.walletAddress}</p>}
            </div>
          </div>
          {canManage && member.role !== "Admin" && (
            <div className="flex gap-2 flex-wrap">
              {member.role === "Validator" ? (
                <button onClick={() => onRemoveValidator(member.membershipId)} className="inline-flex items-center gap-2 border-2 border-foreground px-3 py-2 bg-white hover:bg-gray-100 shadow-brutal">
                  <ShieldOff size={16} /> Remove Validator
                </button>
              ) : (
                <button onClick={() => onSetValidator(member.membershipId)} className="inline-flex items-center gap-2 border-2 border-foreground px-3 py-2 bg-primary text-white hover:bg-primary-hover shadow-brutal">
                  <ShieldCheck size={16} /> Make Validator
                </button>
              )}
              <button onClick={() => { if (window.confirm(`Remove ${member.name} from this group?`)) onRemoveMember(member.membershipId); }} className="inline-flex items-center gap-2 border-2 border-foreground px-3 py-2 bg-red-600 text-white hover:bg-red-700 shadow-brutal">
                <UserMinus size={16} /> Remove Member
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
