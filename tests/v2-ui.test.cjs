const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const wallet='0x0000000000000000000000000000000000000001';
const validator='0x0000000000000000000000000000000000000002';
const admin='0x0000000000000000000000000000000000000003';
const atom='1000000000000000000';
function render(overrides={}){
  const state={domain:{chainId:968,verifyingContract:wallet},registrationTypes:{},withdrawalTypes:{},registration:null,withdrawal:null,wallet,
    permissions:{isCreator:true,isAdmin:false,isValidator:false},serverTime:100,
    chain:{campaignId:'0x'+'a'.repeat(64),creator:wallet,validator,reviewerAdmin:admin,target:atom,deadline:0,totalRaised:atom,totalWithdrawn:'0',totalRefunded:'0',available:atom,nonce:'0',cancelled:false,eligible:true,timestamp:100},...overrides};
  const mocks={
    '@tanstack/react-query':{useQuery:()=>({data:state,isPending:false}),useQueryClient:()=>({})},
    '@/lib/api-client':{},'@/lib/blockchain':{},'@/lib/v2/client':{},'@/components/ui/ContentState':{},
  };
  const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../features/proposal/V2Proposal.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:id=>id in mocks?mocks[id]:require(id),Error,console});
  return renderToStaticMarkup(React.createElement(module.exports.default,{proposal:{_id:'proposal',creator:'Creator',recipientWallet:wallet,title:'Community garden',description:'Fund our garden',contractAddress:wallet,transactions:[]}}));
}
test('creator has partial withdrawal input and donations remain open at target/unlimited',()=>{
  const html=render();assert.match(html,/Amount to withdraw \(BOT\)/);assert.match(html,/Request withdrawal/);assert.match(html,/Donate BOT/);assert.match(html,/Unlimited/);assert.doesNotMatch(html,/>Claim 1/);
});
test('only creator sees exact approved claim amount and cannot edit signed amount',()=>{
  const withdrawal={message:{amount:'300000000000000000',nonce:'0'},status:'Approved',validUntil:1000,requestId:'id',validatorSignature:'signature',adminSignature:'signature'};
  const html=render({withdrawal});assert.match(html,/Claim 0.3 BOT/);assert.doesNotMatch(html,/Amount to withdraw \(BOT\)/);
  const member=render({withdrawal,permissions:{isCreator:false,isAdmin:false,isValidator:false}});assert.doesNotMatch(member,/Claim 0.3 BOT/);
});
test('assigned validator gets gas-free signing; ordinary member cannot sign',()=>{
  const withdrawal={message:{amount:atom},status:'Requested',validUntil:1000,requestId:'id',validatorSignature:'',adminSignature:''};
  const html=render({withdrawal,wallet:validator,permissions:{isCreator:false,isAdmin:false,isValidator:true}});assert.match(html,/Sign approval/);assert.match(html,/Reject request/);
  assert.doesNotMatch(render({withdrawal,permissions:{isCreator:false,isAdmin:false,isValidator:false}}),/Sign approval/);
});
test('expired authorization offers fresh request instead of claim',()=>{
  const html=render({withdrawal:{message:{amount:atom},status:'Approved',validUntil:90,requestId:'id',validatorSignature:'signature',adminSignature:'signature'}});
  assert.match(html,/Expired/);assert.match(html,/Request withdrawal/);assert.doesNotMatch(html,/Claim 1 BOT/);
});
