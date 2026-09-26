import { AbiCoder, keccak256 } from "ethers";

export const registrationTypes = { Registration: [
  { name: "campaignId", type: "bytes32" }, { name: "creator", type: "address" },
  { name: "validator", type: "address" }, { name: "reviewerAdmin", type: "address" },
  { name: "target", type: "uint256" }, { name: "deadline", type: "uint256" }, { name: "validUntil", type: "uint256" },
] };
export const withdrawalTypes = { Withdrawal: [
  { name: "campaignId", type: "bytes32" }, { name: "requestId", type: "bytes32" },
  { name: "creator", type: "address" }, { name: "amount", type: "uint256" },
  { name: "nonce", type: "uint256" }, { name: "validUntil", type: "uint256" },
] };
export function campaignKey(creator: string, proposalId: string) {
  return keccak256(AbiCoder.defaultAbiCoder().encode(["address", "string"], [creator, proposalId]));
}
export function signingDomain(chainId: number, contract: string) {
  return { name: "PledgrTreasury", version: "2", chainId, verifyingContract: contract };
}
