import { Users, Trash2 } from "lucide-react";

interface Member { _id: string; name: string; walletAddress: string; role: "Admin" | "Member" | "Validator"; }
interface Props { members: Member[]; myRole: string; onRemove: (id: string) => void; }

export default function MemberList({ members, myRole, onRemove }: Props) {
  return (
    <div className="bg-white rounded-none border min-w-0 p-4 sm:p-6 shadow-brutal">
      <h2 className="text-xl font-bold mb-4">Organization Members</h2>
      <p className="text-sm text-gray-500 mb-4">Validator roles are managed inside each group.</p>
      <div className="space-y-3">
        {members.map((member) => (
          <div key={member._id} className="border rounded-none p-3 sm:p-4 flex flex-wrap sm:flex-nowrap gap-3 items-start justify-between shadow-brutal">
            <div className="flex flex-1 min-w-0 gap-3 items-center">
              <div className="w-11 h-11 shrink-0 rounded-full bg-accent-soft flex items-center justify-center"><Users className="text-primary" /></div>
              <div className="min-w-0 flex-1"><h3 className="font-semibold break-words">{member.name}</h3><p className="text-xs text-gray-500 font-mono break-all">{member.walletAddress || "Wallet not connected"}</p></div>
            </div>
            <div className="flex shrink-0 gap-2 items-center">
              {member.role === "Admin" ? <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm">Admin</span> : myRole === "Admin" ? <button onClick={() => { if (window.confirm(`Remove ${member.name} from the organization?`)) onRemove(member._id); }} className="text-red-500" aria-label={`Remove ${member.name}`}><Trash2 size={18} /></button> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
