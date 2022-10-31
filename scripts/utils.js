
// These functions are meant to be run from tasks, so the
// RuntimeEnvironment is available in the global scope.


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
  const kmcToken = await hre.ethers.getContractAt('IERC20', erc20Address)
  const erc1155Address = await kuggamax.kugga1155()
  const itemToken = await hre.ethers.getContractAt('Token1155', erc1155Address)
  return { kuggamax, kmcToken, itemToken }
}


async function giveAllowance (tokenContract, allowanceGiver, receiverContract, amount) {
  return tokenContract.approve(receiverContract.address, amount, { from: allowanceGiver })
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


module.exports = {
  getDeployedKuggamax,
  getKuggamaxAddress,
  giveAllowance,
  hasEnoughAllowance,
  hasEnoughTokens,
  getFirstAccount,
}
