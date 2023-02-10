
// These functions are meant to be run from tasks, so the
// RuntimeEnvironment is available in the global scope.

const {ethers, upgrades} = require("hardhat");
const {randomBytes, sha256} = require("ethers/lib/utils");
const {expect} = require("chai");
const {BigNumber} = require("ethers");
const deploymentParams = require("../tasks/deployment-params");

/**
 * Returns the address of the Kuggamax as set in the config, or undefined if
 * it hasn't been set.
 */
function getKuggamaxAddress () {
  return config.networks[network.name].deployedContracts.kuggamax
}

/**
 * Returns the deployed instance of the Kuggamax, or undefined if its
 * address hasn't been set in the config.
 */
async function getDeployedKuggamax (hre) {
  const kuggamaxAddress = getKuggamaxAddress()
  if (!kuggamaxAddress) {
    console.error(`Please, set the kuggamax's address in config`)
    return
  }
  const kuggamax = await hre.ethers.getContractAt('Kuggamax', kuggamaxAddress)
  const erc20Address = await kuggamax.kuggaToken()
  //const kmcToken = await hre.ethers.getContractAt('IERC20', erc20Address)
  const kmcToken = await hre.ethers.getContractAt('Token20', erc20Address)
  const erc1155Address = await kuggamax.kugga1155()
  const itemToken = await hre.ethers.getContractAt('Token1155', erc1155Address)
  return { kuggamax, kmcToken, itemToken }
}


async function giveAllowance (tokenContract, allowanceGiver, receiverContract, amount) {
  //return tokenContract.approve(receiverContract.address, amount, { from: allowanceGiver })
  return tokenContract.connect(allowanceGiver).approve(receiverContract.address, amount)
}

async function hasEnoughAllowance (tokenContract, allowanceGiver, receiverContract, amount) {
  const allowance = await tokenContract.allowance(allowanceGiver, receiverContract.address)
  return allowance.gte(amount)
}

async function hasEnoughTokens (tokenContract, tokensOwner, amount) {
  const balance = await tokenContract.balanceOf(tokensOwner)
  return balance.gte(amount)
}

async function getFirstAccount () {
  const accounts = await web3.eth.getAccounts()
  return accounts[0]
}

function buildDomain(name, version, chainId, verifyingContract) {
  return { name, version, chainId, verifyingContract }
}

const getRandItemHash = (labId) => {
  const itemContent = Buffer.from('itemContent-' + labId + '-' + randomBytes(8), 'utf8')
  return sha256(itemContent)
}

//permit approve kmc to kuggamax contract
const permitApproveKmc = async (kmcToken, owner, spender, amount, hre) => {
  const name = await kmcToken.name()
  const version = "1"

  const accounts = await hre.ethers.getSigners()
  const caller = accounts[0] //token20.permit() caller
  const chainId = await owner.getChainId()

  const maxDeadline = hre.ethers.constants.MaxUint256
  const nonce = await kmcToken.nonces(owner.address)

  let kmcAmount = amount

  const domain = buildDomain(name, version, chainId, kmcToken.address)
  const types = {
    Permit: [ //"Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
      {name: 'owner', type: 'address'},
      {name: 'spender', type: 'address'},
      {name: 'value', type: 'uint256'},
      {name: 'nonce', type: 'uint256'},
      {name: 'deadline', type: 'uint256'}
    ]
  }
  const data = {
    owner: owner.address,
    spender: spender.address,
    value: kmcAmount,
    nonce: nonce,
    deadline: maxDeadline
  }

  const signature = await owner._signTypedData(domain, types, data)
  const { v, r, s } = hre.ethers.utils.splitSignature(signature)
  await kmcToken.connect(caller).permit(owner.address, spender.address, kmcAmount, maxDeadline, v, r, s)

  expect(await kmcToken.allowance(owner.address, spender.address)).to.be.equal(kmcAmount)
}

/*
 *
 */
const deployAllByProxy = async () => {

  console.log('Deploying Kuggamax, Token20, Token1155 by Proxy:')
  console.log(
    'Deployment parameters:\n',
    '  labDeposit:', deploymentParams.LAB_DEPOSIT, '\n',
    '  itemDeposit:', deploymentParams.ITEM_DEPOSIT, '\n',
    '  mintDeposit:', deploymentParams.MINT_DEPOSIT, '\n',
  )

  const supply = ethers.utils.parseEther(deploymentParams.INITIAL_KMC_SUPLY)

  //Token20
  console.log('Start to deploy kmcToken:')
  const Token = await ethers.getContractFactory("Token20")
  const kmcToken = await upgrades.deployProxy(Token, [supply], { initializer: 'initialize' })
  await kmcToken.deployed()

  console.log("KmcToken Proxy address:", kmcToken.address)
  console.log("KmcToken supply:", await kmcToken.totalSupply())

  //Token1155
  console.log('Start to deploy Token1155:')
  const Token1155 = await ethers.getContractFactory("Token1155")
  const token1155 = await upgrades.deployProxy(Token1155, [""])
  await token1155.deployed()

  console.log("Token1155 Proxy address:", token1155.address)

  //kuggamax
  console.log("Start to deploy Kuggamax:")
  const Kuggamax = await ethers.getContractFactory("Kuggamax")
  const kuggamax = await upgrades.deployProxy(Kuggamax, [
    kmcToken.address,
    token1155.address,
    deploymentParams.LAB_DEPOSIT,
    deploymentParams.ITEM_DEPOSIT,
    deploymentParams.MINT_DEPOSIT,
  ])

  await kuggamax.deployed()

  console.log('Kuggamax Proxy Address:', kuggamax.address)
  console.log("KMC in Kuggamax:", ethers.utils.formatEther(await kmcToken.balanceOf(kuggamax.address)))
  console.log('')

  const accounts = await ethers.getSigners()
  const chainId = await kuggamax.signer.getChainId()

  console.log('account0:' + accounts[0].address)
  console.log('account1:' + accounts[1].address)

  //transfer token1155's ownership, from deployer to Kuggamax contract
  await token1155.transferOwnership(kuggamax.address)
  expect(await token1155.owner()).to.be.eq(kuggamax.address)
  console.log('Transfer token1155 ownership to Kuggamax contract succeed')

  //Create a lab, and a item for test
  //await createLabItem(kuggamax, kmcToken, accounts)

  return { kuggamax, kmcToken, accounts, chainId }

}

module.exports = {
  deployAllByProxy,
  getDeployedKuggamax,
  getKuggamaxAddress,
  giveAllowance,
  hasEnoughAllowance,
  hasEnoughTokens,
  getFirstAccount,
  buildDomain,
  getRandItemHash,
  permitApproveKmc
}
