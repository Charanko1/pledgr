const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),ethers=require('ethers');
const root=path.resolve(__dirname,'..');
function load(file,mocks={},globals={}){
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,console,Error,process,...globals,require:id=>{
    if(id in mocks)return mocks[id];
    if(id.startsWith('@/'))return id.endsWith('.json')?JSON.parse(fs.readFileSync(path.join(root,id.slice(2)),'utf8')):load(id.slice(2)+'.ts',mocks,globals);
    return require(id);
  }});return module.exports;
}
const oldWallet='0x0000000000000000000000000000000000000001',nextWallet='0x0000000000000000000000000000000000000002';
function profileFixture({duplicate=false}={}){
  let saves=0,membershipName='';const user={_id:'user',name:'Old name',email:'old@example.com',role:'member',walletAddress:oldWallet,save:async()=>{saves++;}};
  const route=load('app/api/profile/route.ts',{
    'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
    '@/lib/mongodb':{connectDB:async()=>{}},
    '@/lib/server-auth':{getAuthenticatedUser:async()=>user,AuthenticationError:class extends Error{}},
    '@/models/User':{findById:()=>({select:()=>({lean:async()=>({password:'hash'})})}),exists:async()=>duplicate},
    '@/models/Membership':{updateMany:async(filter,update)=>{assert.equal(filter.userId,'user');membershipName=update.name;}},
    bcryptjs:{compare:async value=>value==='correct'},
  });
  return {user,state:()=>({saves,membershipName}),patch:body=>route.PATCH({json:async()=>body})};
}
test('profile name is trimmed and synchronized; client role/wallet fields cannot change permissions',async()=>{
  const f=profileFixture();const r=await f.patch({name:'  New name  ',email:'old@example.com',role:'admin',walletAddress:nextWallet});
  assert.equal(r.status,200);assert.equal(f.user.name,'New name');assert.equal(f.user.role,'member');assert.equal(f.user.walletAddress,oldWallet);assert.equal(f.state().membershipName,'New name');
});
test('email editing requires current password and normalizes the new login address',async()=>{
  const f=profileFixture();for(const currentPassword of ['', 'wrong'])assert.equal((await f.patch({name:'Name',email:'new@example.com',currentPassword})).status,403);
  assert.equal(f.state().saves,0);
  assert.equal((await f.patch({name:'Name',email:' NEW@EXAMPLE.COM ',currentPassword:'correct'})).status,200);assert.equal(f.user.email,'new@example.com');
});
test('invalid profile values and duplicate email are rejected without saving',async()=>{
  const f=profileFixture();for(const body of [{name:''},{name:'a'.repeat(101)},{name:'Name',email:'bad'}])assert.equal((await f.patch(body)).status,400);
  assert.equal(f.state().saves,0);
  const g=profileFixture({duplicate:true});assert.equal((await g.patch({name:'Name',email:'used@example.com',currentPassword:'correct'})).status,409);assert.equal(g.state().saves,0);
});
function walletGuard(proposals,chain){
  let filter;
  const {assertWalletCanChange}=load('lib/wallet-change.ts',{
    '@/models/Membership':{find:()=>({select:()=>({lean:async()=>[]})})},'@/models/GroupMember':{},
    '@/models/Proposal':{find:f=>{filter=f;return {lean:async()=>proposals};}},
    '@/lib/v2/server':{chainSnapshot:async()=>{if(chain instanceof Error)throw chain;return chain;}},
  });return {run:()=>assertWalletCanChange({_id:'user',walletAddress:oldWallet},nextWallet),filter:()=>filter};
}
test('wallet changes protect creators and both pinned reviewer roles',async()=>{
  const f=walletGuard([{status:'Funding',contractVersion:2,blockchainStatus:'APPROVED'}],{ended:false,available:'1'});
  await assert.rejects(f.run(),/still needed/);
  const filter=f.filter();assert.ok(filter.$or.some(x=>x['registration.reviewerAdmin']));assert.ok(filter.$or.some(x=>x['registration.validator']));assert.ok(filter.$or.some(x=>x.creatorId));
});
test('ended balances stay protected; settled campaigns allow wallet change and RPC failure fails closed',async()=>{
  const p={status:'Ended',contractVersion:2,blockchainStatus:'APPROVED'};
  await assert.rejects(walletGuard([p],{ended:true,available:'1'}).run(),/still needed/);
  await walletGuard([p],{ended:true,available:'0'}).run();
  await assert.rejects(walletGuard([p],new Error('RPC unavailable')).run(),/RPC unavailable/);
  await walletGuard([{status:'Ended',blockchainStatus:'PENDING'}],null).run();
});
test('finished filtering does not mistake reached targets or partial claims for a closed campaign',()=>{
  const {isFinishedProposal}=load('lib/proposal-state.ts');
  for(const status of ['Ended','Cancelled','Rejected','Released'])assert.equal(isFinishedProposal({status}),true);
  for(const status of ['Pending','Funding','Release Approved'])assert.equal(isFinishedProposal({status,fundedAmountAtomic:'999',targetAmountAtomic:'1'}),false);
});
test('back links are deterministic and work after opening a detail URL directly',()=>{
  const {backDestination}=load('components/ui/BackButton.tsx',{'next/navigation':{},'next/link':{}});
  assert.equal(backDestination('/organization/org/groups/group/proposal/proposal').href,'/organization/org/groups/group');
  assert.equal(backDestination('/organization/org/groups/group').href,'/organization/org');
  assert.equal(backDestination('/profile').href,'/dashboard');
});

function walletContext({revokeUnsupported=false,denyChange=false}={}){
  const store=new Map(),calls=[],cells=[];let cursor=0,selected=oldWallet;
  const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
  const react={createContext:()=>({Provider:'provider'}),useCallback:fn=>fn,useMemo:fn=>fn(),useEffect:()=>{},useState:initial=>{const i=cursor++;if(!(i in cells))cells[i]=initial;return [cells[i],value=>{cells[i]=value}];},useRef:initial=>{const i=cursor++;if(!(i in cells))cells[i]={current:initial};return cells[i];}};
  const ethereum={request:async({method})=>{calls.push(method);if(method==='wallet_requestPermissions')selected=nextWallet;if(method==='wallet_revokePermissions'&&revokeUnsupported)throw Error('unsupported');return [selected];}};
  const {WalletProvider}=load('context/WalletContext.tsx',{
    react,'@tanstack/react-query':{useQueryClient:()=>({setQueryData:()=>{}})},'@/features/profile/hooks/useProfile':{profileKey:['profile']},
    '@/lib/api-client':{apiClient:async(url)=>{if(denyChange&&selected===nextWallet)throw Error('Wallet still needed');return url.endsWith('challenge')?{message:'verify'}:{_id:'user',walletAddress:selected};}},
    '@/lib/blockchain':{resetBlockchainCache:()=>{},ensureChain:async()=>{}},
    ethers:{BrowserProvider:class{async getSigner(){return {getAddress:async()=>selected,signMessage:async()=> 'signature'};}}},
  },{window:{ethereum},localStorage:storage});
  return {render:()=>{cursor=0;return WalletProvider({children:null}).props.value;},store,calls,storage};
}
test('change wallet prompts account selection and verifies the selected address',async()=>{
  const f=walletContext();await f.render().connectWallet();assert.equal(f.render().address,oldWallet);
  assert.equal(await f.render().changeWallet(),nextWallet);assert.equal(f.render().address,nextWallet);assert.ok(f.calls.includes('wallet_requestPermissions'));
});
test('disconnect clears browser state even when revocation is unsupported; reconnect is explicit',async()=>{
  const f=walletContext({revokeUnsupported:true});await f.render().connectWallet();await f.render().disconnectWallet();
  assert.equal(f.render().address,'');assert.equal(f.store.get('pledgr:wallet-disconnected'),'true');assert.ok(f.calls.includes('wallet_revokePermissions'));
  const {getProvider}=load('lib/blockchain.ts',{}, {localStorage:f.storage,window:{}});await assert.rejects(getProvider(),/disconnected/);
  await f.render().connectWallet();assert.equal(f.store.has('pledgr:wallet-disconnected'),false);
});
test('rejected wallet changes never show the unverified address as connected',async()=>{
  const f=walletContext({denyChange:true});await f.render().connectWallet();assert.equal(await f.render().changeWallet(),null);assert.equal(f.render().address,'');assert.match(f.render().error,/still needed/);
});
