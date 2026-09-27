const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const moduleValue={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/wallet-errors.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:moduleValue.exports,Set});const {walletErrorMessage:format}=moduleValue.exports;
test('wallet rejection codes, nested providers, signatures and wrapped errors stay concise',()=>{
 for(const e of [{code:4001},{code:'ACTION_REJECTED'},{info:{error:{code:4001,message:'private payload'}}},new Error('user rejected action (action="sendTransaction", payload=secret)')])assert.match(format(e),/^Request cancelled in your wallet/);
});
test('pending transaction guidance and application validation survive formatting',()=>{
 const message='Confirmation pending. Transaction: 0x'+'a'.repeat(64)+'. Use Sync transaction if the wallet shows success.';
 assert.equal(format(new Error(message)),message);assert.equal(format(new Error('Enter a valid BOT amount.')),'Enter a valid BOT amount.');
});
test('provider dumps are hidden and known errors are actionable',()=>{
 assert.match(format({code:'INSUFFICIENT_FUNDS'}),/Not enough BOT/);assert.match(format({code:-32002}),/already open/);assert.match(format({code:'NETWORK_ERROR'}),/network/);
 assert.doesNotMatch(format(new Error('payload=secret '+ 'a'.repeat(600))),/secret/);
 const circular={};circular.cause=circular;assert.match(format(circular),/Something went wrong/);
});
