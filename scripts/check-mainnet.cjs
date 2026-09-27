const {loadEnvConfig}=require('@next/env');
const {JsonRpcProvider,Contract,isAddress}=require('ethers');
loadEnvConfig(process.cwd());
async function main(){
  if(Number(process.env.NEXT_PUBLIC_BOT_CHAIN_ID||677)!==677 || Number(process.env.BOT_CHAIN_ID||677)!==677) throw Error('Both browser and server must use mainnet chain ID 677.');
  const urls=new Set([process.env.NEXT_PUBLIC_BOT_RPC_URL||'https://rpc.botchain.ai',process.env.BOT_RPC_URL||process.env.NEXT_PUBLIC_BOT_RPC_URL||'https://rpc.botchain.ai']);
  const address=process.env.NEXT_PUBLIC_PLEDGR_V2_ADDRESS||'';
  if(!isAddress(address))throw Error('Deploy V2 first and set NEXT_PUBLIC_PLEDGR_V2_ADDRESS to its mainnet address.');
  for(const url of urls){
    const provider=new JsonRpcProvider(url);
    try{
      if(BigInt(await provider.send('eth_chainId',[]))!==677n)throw Error('Configured RPC is not BOT mainnet.');
      if(await provider.getCode(address)==='0x')throw Error('No contract code at the configured mainnet address.');
      const contract=new Contract(address,['function approvalPolicyVersion() view returns(uint256)','function campaignLifecycleVersion() view returns(uint256)'],provider);
      if(await contract.approvalPolicyVersion()!==1n || await contract.campaignLifecycleVersion()!==1n)throw Error('Contract does not expose the required V2 approval and ending features.');
    }finally{provider.destroy();}
  }
  console.log('Mainnet chain and required V2 interfaces confirmed at '+address+'. This is not a source-code audit.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
