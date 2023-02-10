const { ethers } = require("hardhat")

const deploymentParams = require("../tasks/deployment-params")

const Confirm = require("prompt-confirm")


async function main() {

  const [deployer] = await ethers.getSigners()

  console.log("Deploying contracts with the account:", deployer.address)
  console.log("Deployer balance:", (await deployer.getBalance()).toString())

  await run('compile')

  console.log('Deploying a new Kuggamax to the network ' + network.name)
  console.log(
    'Deployment parameters:\n',
    '  labDeposit:', deploymentParams.LAB_DEPOSIT, '\n',
    '  itemDeposit:', deploymentParams.ITEM_DEPOSIT, '\n',
    '  mintDeposit:', deploymentParams.MINT_DEPOSIT, '\n',
  )

  const prompt = new Confirm('Please confirm that the deployment parameters are correct')
  const confirmation = await prompt.run()

  if (!confirmation) {
    return
  }

  const supply = ethers.utils.parseEther(deploymentParams.INITIAL_KMC_SUPLY)
  const Token = await ethers.getContractFactory("Token20")
  const token = await Token.deploy(supply)

  console.log("Token address:", token.address)
  console.log("Token supply:", await token.totalSupply())

  const Kuggamax = await ethers.getContractFactory("Kuggamax")

  console.log("Deploying...")
  const kuggamax = await Kuggamax.deploy(
    token.address,
    deploymentParams.LAB_DEPOSIT,
    deploymentParams.ITEM_DEPOSIT,
    deploymentParams.MINT_DEPOSIT,
  )

  await token.transfer(kuggamax.address, supply)

  console.log('')
  console.log('Kuggamax deployed. Address:', kuggamax.address)
  console.log('KMC in Kuggamax:', ethers.utils.formatEther(await token.balanceOf(kuggamax.address)))
  console.log('Deployed Kuggamax to network:' + network.name + ' succeed !!!')

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
