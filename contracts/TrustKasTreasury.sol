// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PLEDGR Treasury
/// @notice Escrows native BOT donations for PLEDGR fundraising proposals.
///         Application approval happens off-chain; campaign creation, funding,
///         withdrawal approvals, cancellation, refunds and release are enforced
///         by this contract.
contract TrustKasTreasury {
    address public immutable admin;

    struct Donation {
        address donor;
        uint256 amount;
        string proposalId;
        uint256 timestamp;
    }

    struct Campaign {
        string proposalId;
        address creator;
        address payable recipient;
        uint256 targetAmount;
        uint256 totalRaised;
        uint256 deadline;
        bool approved;
        bool released;
        bool cancelled;
        bool withdrawalRequested;
        bool validatorReleaseApproved;
        bool adminReleaseApproved;
    }

    mapping(bytes32 => Campaign) private campaigns;
    mapping(bytes32 => bool) public campaignExists;
    mapping(bytes32 => mapping(address => uint256)) private refundableByDonor;
    mapping(bytes32 => mapping(address => bool)) private validatorAssignments;
    mapping(bytes32 => address[]) private campaignValidators;
    string[] private campaignIds;
    Donation[] public donations;

    event CampaignCreated(
        string indexed proposalId,
        address indexed creator,
        address indexed recipient,
        uint256 targetAmount,
        uint256 deadline,
        address[] validators
    );
    event CampaignApproved(string indexed proposalId, address indexed admin);
    event WithdrawalRequested(string indexed proposalId, address indexed recipient);
    event ValidatorReleaseApproved(string indexed proposalId, address indexed validator);
    event ValidatorReleaseApprovalReset(string indexed proposalId, address indexed admin);
    event AdminReleaseApproved(string indexed proposalId, address indexed admin);
    event Donated(address indexed donor, uint256 amount, string proposalId);
    event CampaignCancelled(string indexed proposalId, address indexed actor);
    event RefundClaimed(string indexed proposalId, address indexed donor, uint256 amount);
    event FundReleased(string indexed proposalId, address indexed recipient, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function _campaignKey(string memory proposalId) internal pure returns (bytes32) {
        return keccak256(bytes(proposalId));
    }

    function _getCampaign(string memory proposalId) internal view returns (Campaign storage campaign) {
        bytes32 key = _campaignKey(proposalId);
        require(campaignExists[key], "Campaign not found");
        campaign = campaigns[key];
    }

    function _finished(Campaign storage campaign) internal view returns (bool) {
        return campaign.totalRaised >= campaign.targetAmount || block.timestamp >= campaign.deadline;
    }

    function createCampaign(
        string calldata proposalId,
        uint256 targetAmount,
        uint256 deadline,
        address payable recipient,
        address[] calldata validators
    ) external onlyAdmin {
        bytes32 key = _campaignKey(proposalId);
        require(bytes(proposalId).length > 0, "Proposal ID is required");
        require(!campaignExists[key], "Campaign already exists");
        require(targetAmount > 0, "Target must be greater than zero");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(recipient != address(0), "Recipient is required");
        require(validators.length > 0, "At least one validator is required");

        campaigns[key] = Campaign({
            proposalId: proposalId,
            creator: recipient,
            recipient: recipient,
            targetAmount: targetAmount,
            totalRaised: 0,
            deadline: deadline,
            approved: false,
            released: false,
            cancelled: false,
            withdrawalRequested: false,
            validatorReleaseApproved: false,
            adminReleaseApproved: false
        });
        campaignExists[key] = true;
        campaignIds.push(proposalId);

        for (uint256 i = 0; i < validators.length; i++) {
            address validator = validators[i];
            require(validator != address(0), "Invalid validator");
            require(!validatorAssignments[key][validator], "Duplicate validator");
            validatorAssignments[key][validator] = true;
            campaignValidators[key].push(validator);
        }

        emit CampaignCreated(proposalId, recipient, recipient, targetAmount, deadline, campaignValidators[key]);
    }

    function approveCampaign(string calldata proposalId) external onlyAdmin {
        Campaign storage campaign = _getCampaign(proposalId);
        require(!campaign.released, "Campaign already released");
        require(!campaign.cancelled, "Campaign is cancelled");
        require(!campaign.approved, "Campaign already approved");
        require(block.timestamp < campaign.deadline, "Campaign deadline passed");
        campaign.approved = true;
        emit CampaignApproved(proposalId, msg.sender);
    }

    function donate(string calldata proposalId) external payable {
        Campaign storage campaign = _getCampaign(proposalId);
        require(campaign.approved, "Campaign not approved");
        require(!campaign.released, "Campaign already released");
        require(!campaign.cancelled, "Campaign is cancelled");
        require(block.timestamp < campaign.deadline, "Campaign deadline passed");
        require(msg.value > 0, "Amount must be greater than zero");

        bytes32 key = _campaignKey(proposalId);
        campaign.totalRaised += msg.value;
        refundableByDonor[key][msg.sender] += msg.value;
        donations.push(Donation({ donor: msg.sender, amount: msg.value, proposalId: proposalId, timestamp: block.timestamp }));
        emit Donated(msg.sender, msg.value, proposalId);
    }

    /// @notice Records the first eligible withdrawal request on-chain.
    ///         A later retry after a rejected review is kept off-chain and
    ///         reuses this request state while resetting validator approval.
    function requestWithdrawal(string calldata proposalId) external {
        Campaign storage campaign = _getCampaign(proposalId);
        require(msg.sender == campaign.recipient, "Only fundraiser");
        require(campaign.approved, "Campaign not approved");
        require(!campaign.cancelled, "Campaign is cancelled");
        require(!campaign.released, "Funds already released");
        require(campaign.totalRaised > 0, "No funds available");
        require(_finished(campaign), "Campaign has not finished");
        require(!campaign.withdrawalRequested, "Withdrawal already requested");

        campaign.withdrawalRequested = true;
        campaign.validatorReleaseApproved = false;
        campaign.adminReleaseApproved = false;
        emit WithdrawalRequested(proposalId, campaign.recipient);
    }

    function approveValidatorRelease(string calldata proposalId) external {
        Campaign storage campaign = _getCampaign(proposalId);
        bytes32 key = _campaignKey(proposalId);
        require(validatorAssignments[key][msg.sender], "Only an assigned validator");
        require(campaign.approved, "Campaign not approved");
        require(!campaign.cancelled, "Campaign is cancelled");
        require(!campaign.released, "Funds already released");
        require(campaign.withdrawalRequested, "Withdrawal not requested");
        require(campaign.totalRaised > 0, "No funds available");
        require(_finished(campaign), "Campaign has not finished");
        require(!campaign.validatorReleaseApproved, "Validator approval already recorded");
        require(!campaign.adminReleaseApproved, "Admin release approval already recorded");
        campaign.validatorReleaseApproved = true;
        emit ValidatorReleaseApproved(proposalId, msg.sender);
    }

    function resetValidatorReleaseApproval(string calldata proposalId) external onlyAdmin {
        Campaign storage campaign = _getCampaign(proposalId);
        require(campaign.approved, "Campaign not approved");
        require(!campaign.cancelled, "Campaign is cancelled");
        require(!campaign.released, "Funds already released");
        require(campaign.withdrawalRequested, "Withdrawal not requested");
        require(campaign.validatorReleaseApproved, "Validator approval is not recorded");
        require(!campaign.adminReleaseApproved, "Admin release approval already recorded");
        campaign.validatorReleaseApproved = false;
        emit ValidatorReleaseApprovalReset(proposalId, msg.sender);
    }

    function approveAdminRelease(string calldata proposalId) external onlyAdmin {
        Campaign storage campaign = _getCampaign(proposalId);
        require(campaign.approved, "Campaign not approved");
        require(!campaign.cancelled, "Campaign is cancelled");
        require(!campaign.released, "Funds already released");
        require(campaign.withdrawalRequested, "Withdrawal not requested");
        require(campaign.totalRaised > 0, "No funds available");
        require(_finished(campaign), "Campaign has not finished");
        require(campaign.validatorReleaseApproved, "Validator approval required");
        require(!campaign.adminReleaseApproved, "Admin approval already recorded");
        campaign.adminReleaseApproved = true;
        emit AdminReleaseApproved(proposalId, msg.sender);
    }

    function cancelCampaign(string calldata proposalId) external {
        Campaign storage campaign = _getCampaign(proposalId);
        require(!campaign.released, "Campaign already released");
        require(!campaign.cancelled, "Campaign already cancelled");
        require(msg.sender == admin || msg.sender == campaign.creator, "Only admin or fundraiser");
        require(!campaign.withdrawalRequested, "Withdrawal review is in progress");
        require(!campaign.validatorReleaseApproved && !campaign.adminReleaseApproved, "Release review is in progress");
        campaign.cancelled = true;
        campaign.approved = false;
        emit CampaignCancelled(proposalId, msg.sender);
    }

    function getRefundableAmount(string calldata proposalId, address donor) external view returns (uint256) {
        bytes32 key = _campaignKey(proposalId);
        require(campaignExists[key], "Campaign not found");
        return refundableByDonor[key][donor];
    }

    function claimRefund(string calldata proposalId) external {
        Campaign storage campaign = _getCampaign(proposalId);
        require(campaign.cancelled, "Campaign is not cancelled");
        require(!campaign.released, "Campaign already released");

        bytes32 key = _campaignKey(proposalId);
        uint256 amount = refundableByDonor[key][msg.sender];
        require(amount > 0, "No refundable funds");
        refundableByDonor[key][msg.sender] = 0;
        campaign.totalRaised -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund transfer failed");
        emit RefundClaimed(proposalId, msg.sender, amount);
    }

    function releaseFund(string calldata proposalId) external onlyAdmin {
        Campaign storage campaign = _getCampaign(proposalId);
        require(campaign.approved, "Campaign not approved");
        require(!campaign.cancelled, "Campaign is cancelled");
        require(!campaign.released, "Funds already released");
        require(campaign.withdrawalRequested, "Withdrawal not requested");
        require(campaign.totalRaised > 0, "No funds available");
        require(_finished(campaign), "Campaign has not finished");
        require(campaign.validatorReleaseApproved, "Validator approval required");
        require(campaign.adminReleaseApproved, "Admin approval required");

        uint256 amount = campaign.totalRaised;
        address payable recipient = campaign.recipient;
        campaign.released = true;
        campaign.totalRaised = 0;

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Fund transfer failed");
        emit FundReleased(proposalId, recipient, amount);
    }

    function isCampaignValidator(string calldata proposalId, address validator) external view returns (bool) {
        return validatorAssignments[_campaignKey(proposalId)][validator];
    }

    function getCampaignValidators(string calldata proposalId) external view returns (address[] memory) {
        bytes32 key = _campaignKey(proposalId);
        require(campaignExists[key], "Campaign not found");
        return campaignValidators[key];
    }

    function getCampaign(string calldata proposalId)
        external
        view
        returns (
            string memory storedProposalId,
            address creator,
            address recipient,
            uint256 targetAmount,
            uint256 totalRaised,
            uint256 deadline,
            bool approved,
            bool released,
            bool cancelled,
            bool withdrawalRequested,
            bool validatorReleaseApproved,
            bool adminReleaseApproved
        )
    {
        Campaign storage campaign = _getCampaign(proposalId);
        return (
            campaign.proposalId,
            campaign.creator,
            campaign.recipient,
            campaign.targetAmount,
            campaign.totalRaised,
            campaign.deadline,
            campaign.approved,
            campaign.released,
            campaign.cancelled,
            campaign.withdrawalRequested,
            campaign.validatorReleaseApproved,
            campaign.adminReleaseApproved
        );
    }

    function getBalance() external view returns (uint256) { return address(this).balance; }
    function getDonationCount() external view returns (uint256) { return donations.length; }
    function getDonation(uint256 index) external view returns (address donor, uint256 amount, string memory proposalId, uint256 timestamp) {
        Donation memory donation = donations[index];
        return (donation.donor, donation.amount, donation.proposalId, donation.timestamp);
    }
    function getCampaignCount() external view returns (uint256) { return campaignIds.length; }

    receive() external payable { revert("Use donate with a proposal ID"); }
    fallback() external payable { revert("Invalid treasury call"); }
}
