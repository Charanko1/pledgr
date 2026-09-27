const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('lib/network.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function load(chain){const exports={};vm.runInNewContext(code,{exports,process:{env:{NEXT_PUBLIC_BOT_CHAIN_ID:chain}}});return exports;}
test('mainnet defaults match guidebook',()=>{const n=load().BOT_NETWORK;assert.equal(n.chainId,677);assert.equal(n.rpcUrl,'https://rpc.botchain.ai');assert.equal(n.explorerUrl,'https://scan.botchain.ai');assert.equal(n.label,'MAINNET');});
test('explicit testnet configuration keeps testnet labels and endpoints',()=>{const n=load('968').BOT_NETWORK;assert.equal(n.chainId,968);assert.equal(n.label,'TESTNET');assert.equal(n.rpcUrl,'https://rpc.bohr.life');});
test('invalid network fails instead of silently choosing a chain',()=>{for(const chain of ['1','garbage','0'])assert.throws(()=>load(chain),/Unsupported BOT network/);});
