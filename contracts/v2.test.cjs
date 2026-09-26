const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const ganache=require('ganache');
const {BrowserProvider,ContractFactory,Wallet,parseEther,keccak256,AbiCoder,randomBytes,hexlify}=require('ethers');
const {compile}=require('./compile.cjs');
let chain,provider,accounts,artifact,signers;
const regTypes={Registration:[{name:'campaignId',type:'bytes32'},{name:'creator',type:'address'},{name:'validator',type:'address'},{name:'reviewerAdmin',type:'address'},{name:'target',type:'uint256'},{name:'deadline',type:'uint256'},{name:'validUntil',type:'uint256'}]};
const withdrawalTypes={Withdrawal:[{name:'campaignId',type:'bytes32'},{name:'requestId',type:'bytes32'},{name:'creator',type:'address'},{name:'amount',type:'uint256'},{name:'nonce',type:'uint256'},{name:'validUntil',type:'uint256'}]};
before(async()=>{
  artifact=compile();chain=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:8},chain:{chainId:1337,hardfork:'shanghai'}});
  provider=new BrowserProvider(chain);provider.pollingInterval=10;
  accounts=Object.values(chain.getInitialAccounts()).map(a=>new Wallet(a.secretKey));
  signers=await Promise.all(accounts.map((_,i)=>provider.getSigner(i)));
});
after(async()=>{provider?.destroy();await chain?.disconnect();});
async function fixture({target='0.1',deadlineOffset=3600,unlimited=false}={}){
  const contract=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,signers[0]).deploy();await contract.waitForDeployment();
  const domain={name:'PledgrTreasury',version:'2',chainId:1337,verifyingContract:await contract.getAddress()};
  const now=Number((await provider.getBlock('latest')).timestamp);
  const proposalId=hexlify(randomBytes(12));
  const creator=accounts[1].address;
  const id=keccak256(AbiCoder.defaultAbiCoder().encode(['address','string'],[creator,proposalId]));
  const r={campaignId:id,creator,validator:accounts[2].address,reviewerAdmin:accounts[3].address,target:parseEther(target),deadline:unlimited?0:now+deadlineOffset,validUntil:now+86400};
  const v=await accounts[2].signTypedData(domain,regTypes,r),a=await accounts[3].signTypedData(domain,regTypes,r);
  await (await contract.connect(signers[1]).registerCampaign(proposalId,r,v,a)).wait();
  async function authorize(amount='0.04',overrides={},signDomain=domain){
    const c=await contract.getCampaign(id);
    const w={campaignId:id,requestId:hexlify(randomBytes(32)),creator,amount:parseEther(amount),nonce:c.nonce,validUntil:now+86400,...overrides};
    return {w,v:await accounts[2].signTypedData(signDomain,withdrawalTypes,w),a:await accounts[3].signTypedData(signDomain,withdrawalTypes,w)};
  }
  async function claim(auth){return (await contract.connect(signers[1]).claim(auth.w,auth.v,auth.a)).wait();}
  async function donate(amount='1'){await (await contract.connect(signers[4]).donate(id,{value:parseEther(amount)})).wait();}
  return {contract,domain,id,creator,r,authorize,claim,donate,proposalId,v,a};
}
test('creator registration is independent of deployer; copied permit cannot squat creator ID',async()=>{
  const f=await fixture();assert.equal((await f.contract.getCampaign(f.id)).creator,accounts[1].address);
  await assert.rejects(f.contract.connect(signers[0]).registerCampaign(f.proposalId,f.r,f.v,f.a));
});
test('partial claim transfers exact native BOT and preserves cumulative raised/withdrawn',async()=>{
  const f=await fixture();await f.donate();const auth=await f.authorize('0.4');
  const before=await provider.send('eth_getBalance',[f.creator,'latest']);
  const receipt=await f.claim(auth);const after=await provider.send('eth_getBalance',[f.creator,'latest']);
  assert.equal(BigInt(after)-BigInt(before)+receipt.fee,parseEther('0.4'));
  const c=await f.contract.getCampaign(f.id);assert.equal(c.totalRaised,parseEther('1'));assert.equal(c.totalWithdrawn,parseEther('0.4'));assert.equal(await f.contract.available(f.id),parseEther('0.6'));
  await assert.rejects(f.claim(auth));
  await f.claim(await f.authorize('0.6'));assert.equal(await f.contract.available(f.id),0n);
  await f.donate('0.2');await f.claim(await f.authorize('0.2'));assert.equal((await f.contract.getCampaign(f.id)).totalWithdrawn,parseEther('1.2'));
});
test('single claim requires both valid signatures and the creator caller',async()=>{
  const f=await fixture();await f.donate();const auth=await f.authorize();
  await assert.rejects(f.contract.connect(signers[0]).claim(auth.w,auth.v,auth.a));
  await assert.rejects(f.contract.connect(signers[1]).claim(auth.w,auth.v,'0x'));
  await assert.rejects(f.claim({...auth,a:auth.v}));
  const wrong=await accounts[5].signTypedData(f.domain,withdrawalTypes,auth.w);await assert.rejects(f.claim({...auth,v:wrong}));
  await f.claim(auth);
});
test('amount, recipient, campaign, chain and contract are signature-bound',async()=>{
  const f=await fixture();await f.donate();const auth=await f.authorize();
  for(const overrides of [{amount:parseEther('0.05')},{creator:accounts[5].address},{requestId:hexlify(randomBytes(32))},{campaignId:hexlify(randomBytes(32))},{nonce:2n}])await assert.rejects(f.claim({...auth,w:{...auth.w,...overrides}}));
  await assert.rejects(f.claim(await f.authorize('0.04',{}, {...f.domain,chainId:1338})));
  const other=await fixture();await assert.rejects(f.claim(await f.authorize('0.04',{},other.domain)));
});
test('expired, zero, above-balance and pre-eligibility claims revert',async()=>{
  const f=await fixture({target:'10'});await f.donate();await assert.rejects(f.claim(await f.authorize()));
  await f.donate('10');
  await assert.rejects(f.claim(await f.authorize('0')));
  await assert.rejects(f.claim(await f.authorize('12')));
  await assert.rejects(f.claim(await f.authorize('1',{validUntil:1})));
});
test('donations after deadline and target; extension preserves earned eligibility',async()=>{
  const f=await fixture({target:'100',deadlineOffset:20});
  await chain.request({method:'evm_increaseTime',params:[30]});await chain.request({method:'evm_mine',params:[]});
  await f.donate();assert.equal(await f.contract.withdrawalEligible(f.id),true);
  await (await f.contract.connect(signers[1]).updateTerms(f.id,parseEther('200'),f.r.deadline+5000)).wait();
  assert.equal(await f.contract.withdrawalEligible(f.id),true);await f.claim(await f.authorize());
  await (await f.contract.connect(signers[1]).updateTerms(f.id,parseEther('300'),0)).wait();
  await f.donate();assert.equal((await f.contract.getCampaign(f.id)).deadline,0n);
});
test('unlimited needs target; raising an attained target preserves claims and signatures',async()=>{
  const f=await fixture({unlimited:true,target:'2'});await f.donate();assert.equal(await f.contract.withdrawalEligible(f.id),false);
  await f.donate();const auth=await f.authorize();
  await (await f.contract.connect(signers[1]).updateTerms(f.id,parseEther('5'),0)).wait();
  assert.equal(await f.contract.withdrawalEligible(f.id),true);await f.claim(auth);
  await assert.rejects(f.contract.connect(signers[1]).updateTerms(f.id,parseEther('1'),0));
  await assert.rejects(f.contract.connect(signers[4]).updateTerms(f.id,parseEther('10'),0));
});
test('cancellation invalidates claims, enables refunds; partial payouts cannot be cancelled',async()=>{
  const f=await fixture();await f.donate();const auth=await f.authorize();
  await (await f.contract.connect(signers[1]).cancel(f.id)).wait();await assert.rejects(f.claim(auth));await assert.rejects(f.donate());
  await (await f.contract.connect(signers[4]).refund(f.id)).wait();assert.equal(await f.contract.available(f.id),0n);
  await assert.rejects(f.contract.connect(signers[4]).refund(f.id));
  const g=await fixture();await g.donate();await g.claim(await g.authorize());await assert.rejects(g.contract.connect(signers[1]).cancel(g.id));
});
