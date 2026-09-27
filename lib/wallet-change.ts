import { getAddress, isAddress } from "ethers";
import Proposal from "@/models/Proposal";
import Membership from "@/models/Membership";
import GroupMember from "@/models/GroupMember";
import { ACTIVE_PROPOSAL_STATUSES } from "@/lib/proposal-state";
import { chainSnapshot } from "@/lib/v2/server";

export async function assertWalletCanChange(user: any, nextAddress: string) {
  if (!user.walletAddress || !isAddress(user.walletAddress) || getAddress(user.walletAddress) === getAddress(nextAddress)) return;
  const memberships = await Membership.find({userId:String(user._id)}).select("_id").lean();
  const validators = memberships.length ? await GroupMember.find({membershipId:{$in:memberships.map(item=>item._id)},status:"ACTIVE",role:"Validator"}).select("groupId").lean() : [];
  const wallet = {$regex:new RegExp(`^${getAddress(user.walletAddress)}$`,"i")};
  const proposals = await Proposal.find({status:{$in:[...ACTIVE_PROPOSAL_STATUSES,"Ended"]},$or:[
    {creatorId:user._id},{validatedBy:user._id},{adminReviewedBy:user._id},
    {"registration.validator":wallet},{"registration.reviewerAdmin":wallet},
    ...(validators.length ? [{groupId:{$in:validators.map(item=>item.groupId)}}] : []),
  ]}).lean();
  for (const proposal of proposals) {
    if (proposal.status === "Ended" && proposal.blockchainStatus === "PENDING") continue;
    if (proposal.contractVersion === 2 && proposal.blockchainStatus !== "PENDING") {
      // Check the chain rather than trusting a possibly stale displayed balance.
      const chain = await chainSnapshot(proposal);
      if (chain?.cancelled || (chain?.ended && BigInt(chain.available) === 0n)) continue;
    }
    throw new Error("Your current wallet is still needed by a proposal you created or review. Complete its funding and remaining claims before changing wallets. You can disconnect this browser at any time.");
  }
}
