// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Native BOT escrow. Reviewer identities are public and immutable per
/// campaign; Pledgr verifies their group roles before collecting signatures.
/// There is no deployer/owner privilege to register or withdraw campaign funds.
contract PledgrTreasuryV2 is EIP712, ReentrancyGuard {
    struct Registration {
        bytes32 campaignId;
        address creator;
        address validator;
        address reviewerAdmin;
        uint256 target;
        uint256 deadline;
        uint256 validUntil;
    }
    struct Withdrawal {
        bytes32 campaignId;
        bytes32 requestId;
        address creator;
        uint256 amount;
        uint256 nonce;
        uint256 validUntil;
    }
    struct Campaign {
        address creator;
        address validator;
        address reviewerAdmin;
        uint256 target;
        uint256 deadline; // Zero means unlimited; never blocks donations.
        uint256 totalRaised;
        uint256 totalWithdrawn;
        uint256 totalRefunded;
        uint256 nonce;
        bool unlocked;
        bool cancelled;
    }
    bytes32 private constant REGISTRATION_TYPEHASH = keccak256("Registration(bytes32 campaignId,address creator,address validator,address reviewerAdmin,uint256 target,uint256 deadline,uint256 validUntil)");
    bytes32 private constant WITHDRAWAL_TYPEHASH = keccak256("Withdrawal(bytes32 campaignId,bytes32 requestId,address creator,uint256 amount,uint256 nonce,uint256 validUntil)");
    mapping(bytes32 => Campaign) private campaigns;
    mapping(bytes32 => mapping(address => uint256)) public donations;
    event CampaignRegistered(bytes32 indexed campaignId, address indexed creator);
    event Donated(bytes32 indexed campaignId, address indexed donor, uint256 amount);
    event Claimed(bytes32 indexed campaignId, bytes32 indexed requestId, address indexed creator, uint256 amount, uint256 nonce);
    event TermsUpdated(bytes32 indexed campaignId, uint256 target, uint256 deadline);
    event CampaignCancelled(bytes32 indexed campaignId);
    event Refunded(bytes32 indexed campaignId, address indexed donor, uint256 amount);

    constructor() EIP712("PledgrTreasury", "2") {}

    /// @notice Zero reviewer addresses denote roles exempt under the signed policy.
    function approvalPolicyVersion() external pure returns (uint256) { return 1; }

    function campaignKey(address creator, string calldata proposalId) public pure returns (bytes32) {
        return keccak256(abi.encode(creator, proposalId));
    }

    function registerCampaign(string calldata proposalId, Registration calldata r, bytes calldata validatorSignature, bytes calldata adminSignature) external {
        require(bytes(proposalId).length > 0 && r.campaignId == campaignKey(msg.sender, proposalId), "Invalid campaign ID");
        require(r.creator == msg.sender && campaigns[r.campaignId].creator == address(0), "Creator or campaign invalid");
        require(r.validator != address(0) || r.reviewerAdmin != address(0), "Missing reviewers");
        require(r.validator != r.reviewerAdmin && r.validator != r.creator && r.reviewerAdmin != r.creator, "Distinct reviewers required");
        require(r.target > 0 && (r.deadline == 0 || r.deadline > block.timestamp), "Invalid terms");
        require(block.timestamp <= r.validUntil, "Authorization expired");
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(REGISTRATION_TYPEHASH, r)));
        _verifyReviewers(digest, r.validator, r.reviewerAdmin, validatorSignature, adminSignature);
        campaigns[r.campaignId] = Campaign(r.creator, r.validator, r.reviewerAdmin, r.target, r.deadline, 0, 0, 0, 0, false, false);
        emit CampaignRegistered(r.campaignId, msg.sender);
    }

    function exists(bytes32 id) external view returns (bool) { return campaigns[id].creator != address(0); }
    function getCampaign(bytes32 id) external view returns (Campaign memory) { return _campaign(id); }
    function available(bytes32 id) public view returns (uint256) {
        Campaign storage c = _campaign(id);
        return c.totalRaised - c.totalWithdrawn - c.totalRefunded;
    }
    function withdrawalEligible(bytes32 id) public view returns (bool) {
        Campaign storage c = _campaign(id);
        return !c.cancelled && (c.unlocked || c.totalRaised >= c.target || (c.deadline != 0 && block.timestamp >= c.deadline));
    }
    function donate(bytes32 id) external payable {
        Campaign storage c = _campaign(id);
        require(!c.cancelled && msg.value > 0, "Donation unavailable");
        c.totalRaised += msg.value;
        donations[id][msg.sender] += msg.value;
        _unlock(c);
        emit Donated(id, msg.sender, msg.value);
    }
    function updateTerms(bytes32 id, uint256 target, uint256 deadline) external {
        Campaign storage c = _campaign(id);
        require(msg.sender == c.creator && !c.cancelled, "Only active creator");
        require(target >= c.target, "Target cannot decrease");
        require(deadline == c.deadline || deadline == 0 || (c.deadline != 0 && deadline > c.deadline && deadline > block.timestamp), "Only extend or unlimited");
        _unlock(c); // Eligibility already earned survives increased targets/extensions.
        c.target = target;
        c.deadline = deadline;
        emit TermsUpdated(id, target, deadline);
    }
    function claim(Withdrawal calldata w, bytes calldata validatorSignature, bytes calldata adminSignature) external nonReentrant {
        Campaign storage c = _campaign(w.campaignId);
        require(msg.sender == c.creator && w.creator == c.creator, "Only creator");
        require(withdrawalEligible(w.campaignId), "Withdrawal not eligible");
        require(w.amount > 0 && w.amount <= available(w.campaignId), "Invalid amount");
        require(w.nonce == c.nonce && block.timestamp <= w.validUntil, "Used or expired authorization");
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(WITHDRAWAL_TYPEHASH, w)));
        _verifyReviewers(digest, c.validator, c.reviewerAdmin, validatorSignature, adminSignature);
        c.unlocked = true;
        c.nonce++;
        c.totalWithdrawn += w.amount;
        (bool success,) = payable(c.creator).call{value: w.amount}("");
        require(success, "Transfer failed");
        emit Claimed(w.campaignId, w.requestId, c.creator, w.amount, w.nonce);
    }
    // Full donor refunds remain possible only before the first withdrawal.
    function cancel(bytes32 id) external {
        Campaign storage c = _campaign(id);
        require(msg.sender == c.creator && !c.cancelled && c.totalWithdrawn == 0, "Cannot cancel");
        c.cancelled = true;
        c.nonce++;
        emit CampaignCancelled(id);
    }
    function refund(bytes32 id) external nonReentrant {
        Campaign storage c = _campaign(id);
        uint256 amount = donations[id][msg.sender];
        require(c.cancelled && amount > 0, "No refund available");
        donations[id][msg.sender] = 0;
        c.totalRefunded += amount;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund failed");
        emit Refunded(id, msg.sender, amount);
    }
    function _verifyReviewers(bytes32 digest, address validator, address reviewerAdmin, bytes calldata validatorSignature, bytes calldata adminSignature) private pure {
        if (validator == address(0)) require(validatorSignature.length == 0, "Validator not required");
        else require(ECDSA.recover(digest, validatorSignature) == validator, "Invalid validator signature");
        if (reviewerAdmin == address(0)) require(adminSignature.length == 0, "Admin not required");
        else require(ECDSA.recover(digest, adminSignature) == reviewerAdmin, "Invalid admin signature");
    }
    function _campaign(bytes32 id) private view returns (Campaign storage c) {
        c = campaigns[id];
        require(c.creator != address(0), "Campaign not found");
    }
    function _unlock(Campaign storage c) private {
        if (c.totalRaised >= c.target || (c.deadline != 0 && block.timestamp >= c.deadline)) c.unlocked = true;
    }
}
