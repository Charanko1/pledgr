const fs=require('node:fs');
const path=require('node:path');
const solc=require('solc');
function compile(){
  const source=fs.readFileSync(path.join(__dirname,'PledgrTreasuryV2.sol'),'utf8');
  const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'PledgrTreasuryV2.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}}),{import:name=>{
    try{return {contents:fs.readFileSync(require.resolve(name),'utf8')};}catch{return {error:`Missing dependency ${name}`};}
  }}));
  const errors=(output.errors||[]).filter(e=>e.severity==='error');
  if(errors.length)throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
  return output.contracts['PledgrTreasuryV2.sol'].PledgrTreasuryV2;
}
if(require.main===module){
  const artifact=compile();
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'artifacts/PledgrTreasuryV2.json'),JSON.stringify(artifact,null,2));
  fs.writeFileSync(path.join(__dirname,'../lib/abi/PledgrTreasuryV2.json'),JSON.stringify(artifact.abi,null,2));
  console.log('Compiled PledgrTreasuryV2; generated ABI and deployment artifact.');
}
module.exports={compile};
