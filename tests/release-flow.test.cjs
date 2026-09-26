const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ethers = require('ethers');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts', mocks, globals);
    return require(id);
  }, console, Error, ...globals }, { filename: file });
  return module.exports;
}
const admin = '0x0000000000000000000000000000000000000001';
const recipient = '0x0000000000000000000000000000000000000002';
const hash = '0x' + 'a'.repeat(64);
function fixture(options = {}) {
  let proposal = { _id: 'proposal', groupId: 'group', title: 'Test', status: 'Validator Release Approved', withdrawalStatus: 'ValidatorApproved', blockchainStatus: 'APPROVED', recipientWallet: recipient, transactions: [], ...options.proposal };
  let ledger = options.ledger || null;
  let historyCount = 0, writes = 0;
  const campaign = { approved: true, cancelled: false, released: false, withdrawalRequested: true, validatorReleaseApproved: true, adminReleaseApproved: true, totalRaised: ethers.parseEther('1'), targetAmount: ethers.parseEther('0.1'), deadline: Math.floor(Date.now()/1000)+3600, ...options.campaign };
  const chain = value => ({ lean: async () => structuredClone(value), select() { return this; } });
  const mocks = {
    ethers: { ...ethers, Contract: class { async admin(){return admin;} async getCampaign(){return campaign;} async isCampaignValidator(){return true;} } },
    '@/models/Proposal': {
      findById: () => chain(proposal),
      findOneAndUpdate: (filter, update) => ({ lean: async () => {
        if (filter.withdrawalStatus && filter.withdrawalStatus !== proposal.withdrawalStatus) return null;
        Object.assign(proposal, update.$set); writes++;
        if (update.$push) for (const [key,value] of Object.entries(update.$push)) proposal[key].push(value);
        return options.race ? null : structuredClone(proposal);
      } }),
      updateOne: async () => {},
    },
    '@/models/Group': { findById: () => chain({ _id: 'group', organizationId: 'org' }) },
    '@/models/Membership': { findOne: () => chain({ _id: 'membership' }) },
    '@/models/User': { findOne: () => chain({ _id: 'validator' }) },
    '@/models/GroupMember': { exists: async () => true },
    '@/models/History': { exists: async () => historyCount > 0, create: async () => {historyCount++;} },
    '@/models/BlockchainTransaction': { findOne: () => chain(ledger), create: async value => {ledger=value;} },
    '@/lib/blockchain-server': { SERVER_CONTRACT_ADDRESS: admin, getServerProvider: () => ({}), verifyContractEvent: async () => {
      if (options.invalidReceipt) throw new Error('Invalid receipt');
      return { tx: { from: admin, value: ethers.parseEther('1') }, receipt: { blockNumber: 10 }, parsedEvent: { args: { admin, validator: admin, donor: admin, recipient, amount: ethers.parseEther('1') } } };
    } },
    '@/lib/abi/TrustKasTreasury.json': [],
  };
  const { syncVerifiedBlockchainEvent } = load('lib/blockchain-sync.ts', mocks);
  return { sync: (type='AdminReleaseApproved', extra={}) => syncVerifiedBlockchainEvent({ proposalId:'proposal',txHash:hash,eventType:type,...extra }), state: () => ({proposal,ledger,historyCount,writes}) };
}
test('overfunded campaign can sync final approval then full 1 BOT release', async () => {
  const approval=fixture(); await approval.sync(); assert.equal(approval.state().proposal.status,'Release Approved');
  const release=fixture({proposal:{withdrawalStatus:'AdminApproved',status:'Release Approved'},campaign:{released:true,totalRaised:0n}});
  await release.sync('FundReleased');
  assert.equal(release.state().proposal.releasedAmountAtomic,ethers.parseEther('1').toString());
  assert.equal(release.state().proposal.status,'Released');
});
test('exact and above-target validator approvals are accepted before deadline', async () => {
  for (const amount of ['0.1','1']) {
    const f=fixture({proposal:{withdrawalStatus:'Requested'},campaign:{totalRaised:ethers.parseEther(amount)}});
    await f.sync('ValidatorReleaseApproved'); assert.equal(f.state().proposal.withdrawalStatus,'ValidatorApproved');
  }
});
test('below-target withdrawal before deadline is rejected', async () => {
  const f=fixture({proposal:{withdrawalStatus:'Requested'},campaign:{totalRaised:ethers.parseEther('0.01')}});
  await assert.rejects(f.sync('ValidatorReleaseApproved'),/not finished/); assert.equal(f.state().writes,0);
});
test('partial proposal write repairs missing ledger and history without repeating transition', async () => {
  const f=fixture({proposal:{status:'Release Approved',withdrawalStatus:'AdminApproved',adminReleaseApprovalTxHash:hash}});
  await f.sync(); await f.sync(); assert.equal(f.state().writes,0); assert.equal(f.state().historyCount,1); assert.ok(f.state().ledger);
});
test('concurrent same-receipt approval update is accepted',async()=>{
  const f=fixture({race:true}); await f.sync(); assert.equal(f.state().historyCount,1);
});
test('receipt and sender verification still run on replay',async()=>{
  const f=fixture({proposal:{adminReleaseApprovalTxHash:hash},invalidReceipt:true});
  await assert.rejects(f.sync(),/Invalid receipt/);
  const g=fixture({proposal:{adminReleaseApprovalTxHash:hash}});
  await assert.rejects(g.sync('AdminReleaseApproved',{expectedTxFrom:recipient}),/different wallet/);
});
test('admin reset verifies the cleared post-transaction approval flag',async()=>{
  const f=fixture({campaign:{validatorReleaseApproved:false,adminReleaseApproved:false}});
  await f.sync('ValidatorReleaseApprovalReset'); assert.equal(f.state().proposal.withdrawalStatus,'Rejected');
});
test('late donation synchronization preserves release review status',async()=>{
  const f=fixture(); await f.sync('Donated'); assert.equal(f.state().proposal.status,'Validator Release Approved');
});
test('release without application approvals is rejected',async()=>{
  const f=fixture({campaign:{released:true,totalRaised:0n}});
  await assert.rejects(f.sync('FundReleased'),/both validator and admin/);
});
test('frontend retries successful approval synchronization without sending twice',async()=>{
  const storage=new Map();let sends=0, syncs=0;
  const {releaseTransaction}=load('lib/release-transaction.ts',{'@/lib/blockchain':{
    BOT_CHAIN_ID:'0x3c8',CONTRACT_ADDRESS:admin,getWalletAddress:async()=>admin,
    getReadProvider:()=>({waitForTransaction:async()=>({status:1})}),
    getContract:async()=>({admin:async()=>admin,getCampaign:async()=>({adminReleaseApproved:false}),approveAdminRelease:async()=>{sends++;return {hash};}}),
  }},{window:{localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}}});
  const sync=async()=>{if(++syncs===1)throw new Error('API offline');};
  await assert.rejects(releaseTransaction('proposal','approveAdminRelease',sync),/API offline/);
  await releaseTransaction('proposal','approveAdminRelease',sync);
  assert.equal(sends,1);assert.equal(syncs,2);assert.equal(storage.size,0);
});
test('wrong contract-admin wallet never sends an approval',async()=>{
  const {releaseTransaction}=load('lib/release-transaction.ts',{'@/lib/blockchain':{
    BOT_CHAIN_ID:'0x3c8',CONTRACT_ADDRESS:admin,getWalletAddress:async()=>recipient,
    getContract:async()=>({admin:async()=>admin}),
  }},{window:{localStorage:{getItem:()=>null}}});
  await assert.rejects(releaseTransaction('proposal','approveAdminRelease',async()=>{}),/wallet that deployed/);
});
