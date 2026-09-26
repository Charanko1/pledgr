const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;vm.runInNewContext(source,{module,exports:module.exports,Error,console,require:id=>id in mocks?mocks[id]:id.startsWith('@/')?load(id.slice(2)+'.ts',mocks):require(id)});return module.exports;}
const {policyForCreator,proposalApproved}=load('lib/approval-policy.ts');
test('creator role determines required approvals',()=>{
 for(const [role,count,admin,validator] of [['Admin',1,false,true],['Admin',2,false,true],['Validator',1,true,false],['Validator',2,true,true],['Member',1,true,true],['Member',2,true,true]]){
  const p=policyForCreator(role,count);assert.equal(p.requireAdmin,admin);assert.equal(p.requireValidator,validator);
  assert.equal(proposalApproved(p,{adminReviewStatus:admin?'Pending':'Approved',validationStatus:validator?'Pending':'Approved'}),false);
 }
});
function evaluate(expr,row){
 if(typeof expr==='string'&&expr.startsWith('$'))return row[expr.slice(1)];
 if(!expr||typeof expr!=='object'||expr instanceof Date)return expr;
 if('$literal'in expr)return expr.$literal;
 if('$eq'in expr)return evaluate(expr.$eq[0],row)===evaluate(expr.$eq[1],row);
 if('$and'in expr)return expr.$and.every(e=>evaluate(e,row));
 if('$cond'in expr)return evaluate(expr.$cond[0],row)?evaluate(expr.$cond[1],row):evaluate(expr.$cond[2],row);
 return expr;
}
function fixture(creatorRole='Member',count=2){
 const row={_id:'proposal',groupId:'group',creatorId:'creator',recipientWallet:'0x0000000000000000000000000000000000000001',approvalPolicy:policyForCreator(creatorRole,count),status:'Pending',validationStatus:'Pending',adminReviewStatus:'Pending',blockchainStatus:'PENDING'};
 const users={creator:{_id:'creator',name:'creator',walletVerifiedAt:true,walletAddress:row.recipientWallet},admin:{_id:'admin',name:'admin',walletVerifiedAt:true,walletAddress:'0x0000000000000000000000000000000000000002'},validator:{_id:'validator',name:'validator',walletVerifiedAt:true,walletAddress:'0x0000000000000000000000000000000000000003'}};
 const mocks={'@/models/Proposal':{findOneAndUpdate:async(filter,pipeline)=>{
   if(!filter.status.$in.includes(row.status))return null;
   for(const field of ['validationStatus','adminReviewStatus'])if(filter[field]&&filter[field]!==row[field])return null;
   for(const stage of pipeline){const next={};for(const [key,value]of Object.entries(stage.$set))next[key]=evaluate(value,row);Object.assign(row,next);}
   return {...row};
 }},'@/models/History':{create:async()=>{}},'@/models/GroupMember':{},'@/lib/authorization':{getGroupAccess:async(_group,id)=>({allowed:true,isGroupAdmin:id==='admin',isValidator:id==='validator',group:{organizationId:'org'}})}};
 const {reviewProposal}=load('lib/proposal-approval.ts',mocks);
 return {row,review:(role,action='approve',user=role)=>reviewProposal({...row},users[user],role,action,'')};
}
test('admin creator completes after validator approval alone',async()=>{const f=fixture('Admin');await f.review('validator');assert.equal(f.row.status,'Approved');assert.equal(f.row.adminReviewStatus,'Pending');});
test('member proposal can collect admin first or validator first',async()=>{for(const order of [['admin','validator'],['validator','admin']]){const f=fixture();await f.review(order[0]);assert.equal(f.row.status,'Pending');await f.review(order[1]);assert.equal(f.row.status,'Approved');}});
test('sole validator creator needs only admin; second validator adds its review',async()=>{const f=fixture('Validator',1);await f.review('admin');assert.equal(f.row.status,'Approved');const g=fixture('Validator',2);await g.review('admin');assert.equal(g.row.status,'Pending');await g.review('validator');assert.equal(g.row.status,'Approved');});
test('self approval and unnecessary admin approval are rejected',async()=>{const f=fixture('Admin');await assert.rejects(f.review('admin','approve','creator'),/created this proposal/);await assert.rejects(f.review('admin'),/does not require/);assert.equal(f.row.status,'Pending');});
test('concurrent independent approvals are retained; rejection is terminal',async()=>{const f=fixture();await Promise.all([f.review('admin'),f.review('validator')]);assert.equal(f.row.status,'Approved');const g=fixture();await g.review('admin','reject');await assert.rejects(g.review('validator'),/no longer awaiting/);assert.equal(g.row.status,'Rejected');});
