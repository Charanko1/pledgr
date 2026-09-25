"use client";

import { Wallet, Calendar, User } from "lucide-react";

interface Props {
  proposal: {
    title: string;
    creator: string;
    deadline: string;
    status: string;
  };
}

export default function ProposalHero({ proposal }: Props) {
  return (
    <div className="pledgr-hero rounded-none p-8 text-foreground">
      <h1 className="text-3xl font-bold">{proposal.title}</h1>
      <p className="text-inherit mt-2">
        Organization Fundraising Proposal
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
        <div>
          <div className="flex items-center gap-2">
            <User size={18} />
            <span className="text-sm">Creator</span>
          </div>
          <h3 className="font-semibold mt-2">{proposal.creator}</h3>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Calendar size={18} />
            <span className="text-sm">Deadline</span>
          </div>
          <h3 className="font-semibold mt-2">
            {new Date(proposal.deadline).toLocaleDateString()}
          </h3>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Wallet size={18} />
            <span className="text-sm">Status</span>
          </div>

          <span className="inline-block mt-2 bg-white text-foreground border-2 border-foreground px-3 py-1 rounded-full text-sm">
            {proposal.status}
          </span>
        </div>
      </div>
    </div>
  );
}