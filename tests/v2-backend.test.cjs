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
function evaluate(expr,row){
  if(typeof expr==='string'&&expr.startsWith('$'))return row[expr.slice(1)];
  if(!expr||typeof expr!=='object')return expr;
  if('$literal'in expr)return expr.$literal;
  if('$ne'in expr)return evaluate(expr.$ne[0],row)!==evaluate(expr.$ne[1],row);
  if('$and'in expr)return expr.$and.every(e=>evaluate(e,row));
  if('$cond'in expr)return evaluate(expr.$cond[0],row)?evaluate(expr.$cond[1],row):evaluate(expr.$cond[2],row);
  return expr;
}
function fixture(options={}){
  const p={_id:'abc',groupId:'group',creatorId:'creator',recipientWallet:creator.address,contractVersion:2,chainId:968,contractAddress:address,registration:{validator:validator.address,reviewerAdmin:admin.address},...options.proposal};
  let w=options.withdrawal||null,allow=options.allow!==false,writes=0;
  const chain={creator:creator.address,validator:validator.address,reviewerAdmin:admin.address,target:ethers.parseEther('0.1'),deadline:BigInt(now+3600),totalRaised:ethers.parseEther('1'),totalWithdrawn:ethers.parseEther('0.4'),totalRefunded:0n,nonce:0n,unlocked:true,cancelled:false,...options.chain};
  const model={
    init:async()=>{},findOne:async()=>w,
    create:async values=>{if(w)throw new Error('duplicate nonce');w={_id:'request',...values};writes++;return w;},
    findOneAndUpdate:async(filter,update)=>{if(filter.requestId!==w.requestId)return null;w={...w,...update.$set};writes++;return w;},
    updateOne:async(filter,update,options)=>{
      assert.equal(options.updatePipeline,true);
      if(filter.requestId!==w.requestId||!filter.status.$in.includes(w.status))return {matchedCount:0};
      for(const field of ['validatorSignature','adminSignature'])if(field in filter&&filter[field]!==w[field])return {matchedCount:0};
      for(const stage of update){const next={};for(const [key,value]of Object.entries(stage.$set))next[key]=evaluate(value,w);Object.assign(w,next);}
      writes++;return {matchedCount:1};
    },
  };
  const mocks={
    ethers:{...ethers,Contract:class{async exists(){return options.exists!==false;}async getCampaign(){return chain;}async approvalPolicyVersion(){return options.capability===false?0n:1n;}}},
    '@/lib/blockchain-server':{BOT_CHAIN_ID:968,getServerProvider:()=>({getBlock:async()=>({number:100,timestamp:now})})},
    '@/lib/authorization':{getGroupAccess:async(group,user)=>({allowed:allow,isValidator:user==='validator',isGroupAdmin:user==='admin'})},
    '@/models/Proposal':{findById:async()=>p,updateOne:async(filter,update)=>{Object.assign(p,update.$set);return {matchedCount:1};}},
    '@/models/User':{findById:async id=>users[id]},'@/models/History':{},'@/models/WithdrawalRequest':model,
    '@/lib/proposal-approval':{ensureApprovalPolicy:async p=>p,readApprovalPolicy:async p=>p.approvalPolicy},
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
test('cannot create another active request; admin may approve first',async()=>{
  const f=fixture();await f.server.requestWithdrawal(f.p,1n);
  await assert.rejects(f.server.requestWithdrawal(f.p,2n),/already awaiting/);
  await f.review('admin');assert.equal(f.state().w.status,'AdminApproved');
  await f.review('validator');assert.equal(f.state().w.status,'Approved');
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

test('single required signer completes admin-created and sole-validator-created withdrawals',async()=>{
  for(const role of ['validator','admin']){
    const reviewers={validator:role==='validator'?validator.address:ethers.ZeroAddress,reviewerAdmin:role==='admin'?admin.address:ethers.ZeroAddress};
    const f=fixture({proposal:{registration:reviewers},chain:reviewers});await f.server.requestWithdrawal(f.p,1n);
    await assert.rejects(f.review(role==='validator'?'admin':'validator'),/does not require/);
    await f.review(role);assert.equal(f.state().w.status,'Approved');
  }
});

test('concurrent signatures are retained and rejection prevents later approval',async()=>{
  const f=fixture();await f.server.requestWithdrawal(f.p,1n);await Promise.all([f.review('admin'),f.review('validator')]);
  assert.equal(f.state().w.status,'Approved');assert.ok(f.state().w.adminSignature&&f.state().w.validatorSignature);
  const g=fixture();await g.server.requestWithdrawal(g.p,1n);await g.review('admin',{},true);
  await assert.rejects(g.review('validator'),/not awaiting/);assert.equal(g.state().w.status,'Rejected');
});

test('registration selects only required reviewers and verifies their typed signatures',async()=>{
  for(const role of ['Admin','Validator','Member']){
    const policy={version:1,creatorRole:role,requireValidator:role!=='Validator',requireAdmin:role!=='Admin'};
    const f=fixture({exists:false,proposal:{approvalPolicy:policy,status:'Approved',blockchainStatus:'PENDING',validatedBy:'validator',adminReviewedBy:'admin',validationStatus:policy.requireValidator?'Approved':'Pending',adminReviewStatus:policy.requireAdmin?'Approved':'Pending',targetAmountAtomic:'1',unlimited:true}});
    await f.server.prepareRegistration(f.p);
    assert.equal(f.p.registration.validator,policy.requireValidator?validator.address:ethers.ZeroAddress);
    assert.equal(f.p.registration.reviewerAdmin,policy.requireAdmin?admin.address:ethers.ZeroAddress);
    for(const [name,wallet,required]of [['admin',admin,policy.requireAdmin],['validator',validator,policy.requireValidator]]){
      const signature=await wallet.signTypedData(f.server.domainFor(f.p),f.types.registrationTypes,f.server.registrationMessage(f.p));
      if(required)await f.server.signRegistration(f.p,f.users[name],name,signature);
      else await assert.rejects(f.server.signRegistration(f.p,f.users[name],name,signature),/does not require/);
    }
  }
});

test('missing required proposal review and old single-reviewer bytecode block registration',async()=>{
  const policy={version:1,creatorRole:'Admin',requireValidator:true,requireAdmin:false};
  const proposal={approvalPolicy:policy,status:'Pending',blockchainStatus:'PENDING',validationStatus:'Pending',adminReviewStatus:'Pending'};
  const f=fixture({exists:false,proposal});await assert.rejects(f.server.prepareRegistration(f.p),/required proposal reviews/);
  const previous=process.env.NEXT_PUBLIC_PLEDGR_V2_ADDRESS;process.env.NEXT_PUBLIC_PLEDGR_V2_ADDRESS=address;
  try {
    const g=fixture({exists:false,capability:false,proposal:{...proposal,status:'Approved',validationStatus:'Approved'}});
    await assert.rejects(g.server.prepareRegistration(g.p),/Deploy the revised/);
  }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_PLEDGR_V2_ADDRESS;else process.env.NEXT_PUBLIC_PLEDGR_V2_ADDRESS=previous;}
});

test('withdrawal API restricts requests to the verified proposal creator, regardless of role',async()=>{
  const proposal={_id:'p',contractVersion:2,creatorId:'creator',recipientWallet:creator.address,groupId:'group'};
  const actor={_id:'admin',walletVerifiedAt:true,walletAddress:admin.address};let requests=0;
  const mocks={
    'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
    '@/lib/mongodb':{connectDB:async()=>{}},
    '@/lib/server-auth':{getAuthenticatedUser:async()=>actor,AuthenticationError:class extends Error{}},
    '@/lib/authorization':{getGroupAccess:async()=>({allowed:true,isGroupAdmin:true})},
    '@/models/Proposal':{findById:async()=>proposal},'@/models/WithdrawalRequest':{},
    '@/lib/proposal-approval':{},'@/lib/v2/server':{requestWithdrawal:async()=>{requests++;}},
  };
  const route=load('app/api/proposals/[id]/v2/route.ts',mocks);
  const call=()=>route.POST({json:async()=>({action:'requestWithdrawal',amount:'0.1'})},{params:Promise.resolve({id:'p'})});
  assert.equal((await call()).status,409);assert.equal(requests,0);
  actor._id='creator';assert.equal((await call()).status,409);assert.equal(requests,0);
  actor.walletAddress=creator.address;assert.equal((await call()).status,200);assert.equal(requests,1);
  actor.walletVerifiedAt=null;assert.equal((await call()).status,409);assert.equal(requests,1);
});
