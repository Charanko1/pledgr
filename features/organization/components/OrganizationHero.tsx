import { Wallet, Users, FolderKanban } from "lucide-react";

interface Props {
  org: {
    name: string;
    description: string;
    treasury: number;
    members: number;
  };
  groups: any[];
}

export default function OrganizationHero({ org, groups }: Props) {
  return (
    <div className="pledgr-hero rounded-none p-6 md:p-8 text-foreground">
      <h1 className="text-3xl font-bold">{org.name}</h1>
      <p className="text-inherit mt-2">{org.description}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
        <div>
          <div className="flex items-center gap-2 text-inherit">
            <Wallet size={18} />
            <span className="text-sm">Treasury</span>
          </div>
          <h2 className="text-2xl font-bold mt-2">{org.treasury} BOT</h2>
        </div>

        <div>
          <div className="flex items-center gap-2 text-inherit">
            <Users size={18} />
            <span className="text-sm">Members</span>
          </div>
          <h2 className="text-2xl font-bold mt-2">{org.members}</h2>
        </div>

        <div>
          <div className="flex items-center gap-2 text-inherit">
            <FolderKanban size={18} />
            <span className="text-sm">Groups</span>
          </div>
          <h2 className="text-2xl font-bold mt-2">{groups.length}</h2>
        </div>
      </div>
    </div>
  );
}