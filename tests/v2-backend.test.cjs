const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),ethers=require('ethers');
const root=path.resolve(__dirname,'..');
function load(file,mocks){
  const source=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,resolveJsonModule:true}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,console,Error,process,require:id=>{
    if(id in mocks)return mocks[id];
    if(id.startsWith('@/'))return id.endsWith('.json')?JSON.parse(fs.readFileSync(path.join(root,id.slice(2)),'utf8')):load(id.slice(2)+'.ts',mocks);
    if(id==='./typed-data')return load('lib/v2/typed-data.ts',mocks);
    return require(id);
  }});return module.exports;
}
const creator=ethers.Wallet.createRandom(),validator=ethers.Wallet.createRandom(),admin=ethers.Wallet.createRandom(),stranger=ethers.Wallet.createRandom();
const address='0x0000000000000000000000000000000000000001';
const now=Math.floor(Date.now()/1000);
function fixture(options={}){
  const p={_id:'abc',groupId:'group',creatorId:'creator',recipientWallet:creator.address,contractVersion:2,chainId:968,contractAddress:address,registration:{validator:validator.address,reviewerAdmin:admin.address},...options.proposal};
  let w=options.withdrawal||null,allow=options.allow!==false,writes=0;
  const chain={creator:creator.address,validator:validator.address,reviewerAdmin:admin.address,target:ethers.parseEther('0.1'),deadline:BigInt(now+3600),totalRaised:ethers.parseEther('1'),totalWithdrawn:ethers.parseEther('0.4'),totalRefunded:0n,nonce:0n,unlocked:true,cancelled:false,...options.chain};
  const model={
    init:async()=>{},findOne:async()=>w,
    create:async values=>{if(w)throw new Error('duplicate nonce');w={_id:'request',...values};writes++;return w;},
    findOneAndUpdate:async(filter,update)=>{if(filter.requestId!==w.requestId)return null;w={...w,...update.$set};writes++;return w;},
    updateOne:async(filter,update)=>{if(filter.requestId!==w.requestId||filter.status!==w.status)return {matchedCount:0};Object.assign(w,update.$set);writes++;return {matchedCount:1};},
  };
  const mocks={
    ethers:{...ethers,Contract:class{async exists(){return true;}async getCampaign(){return chain;}}},
    '@/lib/blockchain-server':{BOT_CHAIN_ID:968,getServerProvider:()=>({getBlock:async()=>({number:100,timestamp:now})})},
    '@/lib/authorization':{getGroupAccess:async(group,user)=>({allowed:allow,isValidator:user==='validator',isGroupAdmin:user==='admin'})},
    '@/models/Proposal':{},'@/models/User':{},'@/models/History':{},'@/models/WithdrawalRequest':model,
  };
  const server=load('lib/v2/server.ts',mocks),types=load('lib/v2/typed-data.ts',mocks);
  const users={validator:{_id:'validator',walletAddress:validator.address,walletVerifiedAt:new Date()},admin:{_id:'admin',walletAddress:admin.address,walletVerifiedAt:new Date()}};
  async function review(role,overrides={},reject=false){
    const wallet=role==='validator'?validator:admin;
    const message={...server.withdrawalMessage(w),...overrides};
    const signature=await wallet.signTypedData(server.domainFor(p),types.withdrawalTypes,message);
    return server.reviewWithdrawal(p,users[role],w.requestId,role,signature,reject);
  }
  return {p,server,types,users,review,chain,state:()=>({w,writes}),deny:()=>{allow=false;}};
}
test('request is amount-bound; validator then admin signatures produce approved claim data',async()=>{
  const f=fixture();await f.server.requestWithdrawal(f.p,ethers.parseEther('0.3'));
  assert.equal(f.state().w.amount,ethers.parseEther('0.3').toString());
  assert.equal(f.state().w.nonce,'0');
  await f.review('validator');assert.equal(f.state().w.status,'ValidatorApproved');
  await f.review('admin');assert.equal(f.state().w.status,'Approved');
  assert.ok(f.state().w.validatorSignature&&f.state().w.adminSignature);
});
test('zero, overdraft, ineligible and cancelled requests are rejected',async()=>{
  for(const amount of [0n,ethers.parseEther('0.7')]){const f=fixture();await assert.rejects(f.server.requestWithdrawal(f.p,amount));assert.equal(f.state().writes,0);}
  const f=fixture({chain:{unlocked:false,target:ethers.parseEther('2')}});await assert.rejects(f.server.requestWithdrawal(f.p,1n));
  const g=fixture({chain:{cancelled:true}});await assert.rejects(g.server.requestWithdrawal(g.p,1n));
});
test('cannot create another active request for same nonce or approve admin first',async()=>{
  const f=fixture();await f.server.requestWithdrawal(f.p,1n);
  await assert.rejects(f.server.requestWithdrawal(f.p,2n),/already awaiting/);
  await assert.rejects(f.review('admin'),/not awaiting/);
});
test('tampered amount and wrong verified wallet cannot approve',async()=>{
  const f=fixture();await f.server.requestWithdrawal(f.p,1n);
  await assert.rejects(f.review('validator',{amount:'2'}),/Invalid withdrawal signature/);
  f.users.validator.walletAddress=stranger.address;await assert.rejects(f.review('validator'),/verified wallet/);
  assert.equal(f.state().w.status,'Requested');
});
test('removed reviewer cannot approve; rejected request renews with a new request ID',async()=>{
  const f=fixture();await f.server.requestWithdrawal(f.p,1n);f.deny();await assert.rejects(f.review('validator'),/required reviewer role/);
  const g=fixture();await g.server.requestWithdrawal(g.p,1n);const old=g.state().w.requestId;
  await g.review('validator',{},true);assert.equal(g.state().w.status,'Rejected');
  await g.server.requestWithdrawal(g.p,2n);assert.notEqual(g.state().w.requestId,old);assert.equal(g.state().w.validatorSignature,'');
});
test('expired requests cannot be approved and both-signed requests cannot be rejected',async()=>{
  const f=fixture();await f.server.requestWithdrawal(f.p,1n);f.state().w.validUntil=now-1;await assert.rejects(f.review('validator'),/expired/);
  const g=fixture();await g.server.requestWithdrawal(g.p,1n);await g.review('validator');await g.review('admin');await assert.rejects(g.review('admin',{},true),/not awaiting/);
});
test('pinned reviewer and network mismatches fail closed',async()=>{
  const f=fixture({chain:{validator:stranger.address}});await assert.rejects(f.server.chainSnapshot(f.p),/do not match/);
  const g=fixture({proposal:{chainId:1}});await assert.rejects(g.server.chainSnapshot(g.p),/network configuration/);
});
