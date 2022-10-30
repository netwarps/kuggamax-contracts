
// These functions are meant to be run from tasks, so the
// RuntimeEnvironment is available in the global scope.

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
  const Kuggamax = await hre.ethers.getContractAt('Kuggamax', kuggamaxAddress)
  return Kuggamax
}

/**
 * Returns the deployed instance of the Kuggamax's approved token, or
 * undefined if the DAO's address hasn't been set in the config.
 */
async function getKuggaToken (hre) {
  const kuggamax = await getDeployedKuggamax(hre)
  if (kuggamax === undefined) {
    return
  }

  const tokenAddress = await kuggamax.kuggaToken()
  const IERC20 = await hre.ethers.getContractAt('IERC20', tokenAddress)
  return IERC20
}

/**
 * Returns the deployed instance of the Kuggamax's approved token, or
 * undefined if the DAO's address hasn't been set in the config.
 */
async function getKuggaToken1155 (hre) {
  const kuggamax = await getDeployedKuggamax(hre)
  if (kuggamax === undefined) {
    return
  }

  const tokenAddress = await kuggamax.kugga1155()
  const IERC1155 = await hre.ethers.getContractAt('Token1155', tokenAddress)
  return IERC1155
}

/**
 * Returns the address of the Kuggamax as set in the config, or undefined if
 * it hasn't been set.
 */
function getKuggamaxAddress () {
  return config.networks[network.name].deployedContracts.kuggamax
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
  getKuggaToken,
  getKuggaToken1155,
  getKuggamaxAddress,
  giveAllowance,
  hasEnoughAllowance,
  hasEnoughTokens,
  getFirstAccount,
}
