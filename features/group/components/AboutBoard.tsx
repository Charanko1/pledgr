import { GroupData } from "@/types/group";

export default function AboutBoard({
  group,
}:{group:GroupData}){

  return(
    <div className="bg-white border rounded-none p-6 space-y-4 shadow-brutal">

      <h2 className="text-xl font-bold">
        About Group
      </h2>

      <p className="text-gray-600">
        {group.description}
      </p>

      <div className="border-t pt-4 space-y-3">

        <div className="flex flex-wrap gap-3 justify-between">
          <span className="text-gray-500">
            Leader
          </span>
          <span>{group.leader}</span>
        </div>

        <div className="flex flex-wrap gap-3 justify-between">
          <span className="text-gray-500">
            Members
          </span>
          <span>{group.members}</span>
        </div>

        <div className="flex flex-wrap gap-3 justify-between">
          <span className="text-gray-500">
            Organization
          </span>
          <span>{group.organizationName}</span>
        </div>

        <div className="flex flex-wrap gap-3 justify-between">
          <span className="text-gray-500">
            Total Proposal
          </span>
          <span>{group.totalProposal}</span>
        </div>

      </div>
    </div>
  );
}