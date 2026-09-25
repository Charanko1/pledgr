import Link from "next/link";
import { Users, Plus } from "lucide-react";

interface Props {
  groups: any[];
  org: any;
  myRole: string;
  requests: any[];
  onOpenCreate: () => void;
  onOpenRequests: () => void;
  onJoin: (id: string) => void;
}

export default function GroupList({
  groups,
  org,
  myRole,
  requests,
  onOpenCreate,
  onOpenRequests,
  onJoin,
}: Props) {
  return (
    <div className="bg-white rounded-none border p-6 shadow-brutal">
      <div className="flex flex-wrap gap-3 justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold">Organization Groups</h2>
          <p className="text-gray-500">
            Every member can view groups.
          </p>
        </div>

        {myRole === "Admin" && (
          <div className="flex gap-3">
            <button
              onClick={onOpenRequests}
              className="border px-4 py-2 rounded-none shadow-brutal"
            >
              Join Requests ({requests.length})
            </button>

            <button
              onClick={onOpenCreate}
              className="bg-primary text-white px-4 py-2 rounded-none flex gap-2 border-2 border-foreground shadow-brutal"
            >
              <Plus size={18} />
              Create
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {groups.map((group) => (
          <div
            key={group._id}
            className="border rounded-none p-5 shadow-brutal"
          >
            <div className="flex flex-wrap gap-3 justify-between">
              <div>
                <h3 className="font-bold text-lg">{group.name}</h3>
                <p className="text-sm text-gray-500">
                  Leader: {group.leader}
                </p>
              </div>

              <Users className="text-primary" />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 justify-between text-sm">
              <span>Members</span>
              <span className="font-semibold">{group.members}</span>
            </div>

            <div className="mt-4">
              {myRole === "Admin" || group.joined ? (
                <Link href={`/organization/${org.slug}/groups/${group._id}`} className="w-full bg-primary text-white py-2 rounded-none border-2 border-foreground shadow-brutal block text-center">
                    Open Group
                  </Link>
              ) : group.pending ? (
                <button
                  disabled
                  className="w-full bg-yellow-100 text-yellow-700 py-2 rounded-none"
                >
                  Waiting Approval
                </button>
              ) : (
                <button
                  onClick={() => onJoin(group._id)}
                  className="w-full border border-primary text-primary py-2 rounded-none shadow-brutal"
                >
                  Request Join
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}