const hre = require("hardhat")
const {deployAllByProxy} = require("./utils");


async function main() {

  console.log('Deploying contracts to network [%s] by script:', hre.network.name,)
  const [admin] = await hre.ethers.getSigners()

  console.log("Deploying contracts with the account:", admin.address)
  console.log("Deployer native token balance:", (await admin.getBalance()).toString())

  const {kuggamax, kmcToken, accounts, chainId} = await deployAllByProxy(true, hre)

  await kmcToken.transfer(kuggamax.address, await kmcToken.totalSupply())

  console.log('')
  console.log('Kuggamax deployed. Address:', kuggamax.address)
  console.log('KMC in Kuggamax:', hre.ethers.utils.formatEther(await kmcToken.balanceOf(kuggamax.address)))
  console.log('Deployed Kuggamax to network:%s, chainId[%d] succeed !!!', hre.network.name, chainId)

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
