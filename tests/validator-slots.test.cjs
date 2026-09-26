const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
function fixture(roles=['Member','Member','Member']) {
  const rows=roles.map((role,index)=>({_id:String(index),groupId:'group',role,status:'ACTIVE',validatorSlot:null}));
  const model={init:async()=>{},collection:{createIndex:async()=>{}},
    find:()=>({sort:async()=>rows.filter(r=>r.role==='Validator').map(r=>({...r}))}),
    findById:async id=>rows.find(r=>r._id===id),
    findOneAndUpdate:async(filter,update)=>{
      const row=rows.find(r=>r._id===filter._id&&r.status==='ACTIVE'&&r.role!=='Admin'&&r.validatorSlot===null);
      if(!row)return null;
      if(rows.some(r=>r.status==='ACTIVE'&&r.role==='Validator'&&r.validatorSlot===update.$set.validatorSlot))throw Object.assign(new Error('duplicate slot'),{code:11000});
      Object.assign(row,update.$set);return {...row};
    },
  };
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/validator-slots.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require:()=>model,Error});
  return {rows,appoint:id=>module.exports.appointValidator('group',id)};
}
test('three concurrent appointments can occupy only two unique slots',async()=>{
  const f=fixture();const results=await Promise.allSettled(['0','1','2'].map(f.appoint));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
  assert.equal(f.rows.filter(r=>r.role==='Validator').length,2);
  assert.equal(new Set(f.rows.filter(r=>r.role==='Validator').map(r=>r.validatorSlot)).size,2);
});
test('legacy validators are assigned slots before a new appointment',async()=>{
  const f=fixture(['Validator','Validator','Member']);await assert.rejects(f.appoint('2'),/two validators/);
  assert.ok(f.rows[0].validatorSlot);assert.ok(f.rows[1].validatorSlot);assert.equal(f.rows[2].role,'Member');
});
test('reappointing a validator is idempotent; a removed slot can be reused',async()=>{
  const f=fixture();await f.appoint('0');await f.appoint('0');await f.appoint('1');
  f.rows[0].status='REMOVED';f.rows[0].role='Member';f.rows[0].validatorSlot=null;
  await f.appoint('2');assert.equal(f.rows.filter(r=>r.role==='Validator').length,2);
});
test('groups already over limit are not silently demoted',async()=>{
  const f=fixture(['Validator','Validator','Validator']);await assert.rejects(f.appoint('2'),/more than two/);assert.equal(f.rows.filter(r=>r.role==='Validator').length,3);
});
