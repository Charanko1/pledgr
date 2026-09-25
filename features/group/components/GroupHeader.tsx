import type { GroupData } from "@/types/group";

export default function GroupHeader({
  group,
}:{group:GroupData}){

  return(
    <div>
      <h1 className="text-3xl font-bold">
        {group.name}
      </h1>

      <p className="text-gray-500">
        {group.organizationName}
      </p>
    </div>
  );
}