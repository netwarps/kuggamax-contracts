
const {
  getDeployedMoloch,
  getDeployedPool,
  getFirstAccount,
  getApprovedToken,
  hasEnoughTokens,
  hasEnoughAllowance,
  giveAllowance,
  hasEnoughPoolShares, getMolochAddress
} = require('../scripts/utils')
const deploymentParams = require("./deployment-params");

task('pool-deploy', 'Deploys a new instance of the pool and activates it')
  .addParam('tokens', 'The initial amount of tokens to deposit')
  .addParam('shares', 'The initial amount of shares to mint')
  .setAction(async ({ tokens, shares }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const moloch = await getDeployedMoloch(hre)
    if (moloch === undefined) {
      return
    }

    const token = await getApprovedToken(hre)
    if (token == undefined) {
      return
    }

    console.log('Deploying a new Pool to network ' + network.name)

    console.log(
      'Deployment parameters:\n',
      '  Moloch DAO:', moloch.address, '\n',
      '  initialTokens:', tokens, '\n',
      '  initialPoolShares:', shares, '\n'
    )

    const Confirm = require('prompt-confirm')
    const prompt = new Confirm('Please confirm that the deployment parameters are correct')
    const confirmation = await prompt.run()

    if (!confirmation) {
      return
    }

    const [owner] = await hre.ethers.getSigners();

    const Pool = await hre.ethers.getContractFactory("MolochPool");

    if (!await hasEnoughTokens(token, owner.address, tokens)) {
      console.error("You don't have enough tokens")
      return
    }

    console.log('Deploying...')
    const pool = await Pool.deploy(moloch.address)

    console.log('')
    console.log('Pool deployed. Address:', pool.address)
    console.log("Set this address in hardhat.config.js's networks section to use the other tasks")

    if (!await hasEnoughAllowance(token, owner.address, pool, tokens)) {
      await giveAllowance(token, owner.address, pool, tokens)
    }

    await pool.activate(tokens, shares)

    console.log('The pool is now active')
  })

task('pool-sync', 'Syncs the pool')
  .addParam('proposal', 'The last proposal to sync', undefined, types.int)
  .setAction(async ({ proposal }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const pool = await getDeployedPool(hre)
    if (pool === undefined) {
      return
    }

    await pool.sync(proposal+1)

    const index = await pool.currentProposalIndex()

    if (index.eq(0)) {
      console.log('No proposal is ready to be synced')
      return
    }

    console.log('Pool synced up to', index.sub(1).toString())
  })

task('pool-deposit', 'Donates tokens to the pool')
  .addParam('tokens', 'The amount of tokens to deposit')
  .setAction(async ({ tokens }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const pool = await getDeployedPool(hre)
    if (pool === undefined) {
      return
    }

    const token = await getApprovedToken(hre)
    if (token === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners();

    if (!await hasEnoughTokens(token, sender.address, tokens)) {
      console.error("You don't have enough tokens")
      return
    }

    if (!await hasEnoughAllowance(token, sender.address, pool, tokens)) {
      await giveAllowance(token, sender.address, pool, tokens)
    }

    await pool.deposit(tokens)

    console.log('Tokens deposited')
  })

task('pool-withdraw', 'Withdraw tokens from the pool')
  .addParam('shares', 'The amount of shares to burn')
  .setAction(async ({ shares }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const pool = await getDeployedPool(hre)
    if (pool === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners();
    if (!await hasEnoughPoolShares(pool, sender.address, shares)) {
      console.log("You don't have enough shares")
      return
    }

    await pool.withdraw(shares)
    console.log('Successful withdrawal')
  })

task('pool-keeper-withdraw', "Withdraw other users' tokens from the pool")
  .addParam('shares', 'The amount of shares to burn')
  .addParam('owner', 'The owner of the tokens')
  .setAction(async ({ shares, owner }) => {
    // Make sure everything is compiled
    await run('compile')

    const pool = await getDeployedPool()
    if (pool === undefined) {
      return
    }

    if (!await hasEnoughPoolShares(pool, owner, shares)) {
      console.log("The owner of the tokens doesn't have enough shares")
      return
    }

    try {
      await pool.keeperWithdraw(shares, owner)
      console.log('Withdrawal was successful')
    } catch (error) {
      console.error('Withdrawal failed. Make sure that you are actually a keeper')
      console.error(error)
    }
  })

task('pool-add-keeper', 'Adds a keeper')
  .addParam('keeper', "The keeper's address")
  .setAction(async ({ keeper }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const pool = await getDeployedPool(hre)
    if (pool === undefined) {
      return
    }

    await pool.addKeepers([keeper])
    console.log('Keeper added')
  })

task('pool-remove-keeper', 'Removes a keeper')
  .addParam('keeper', "The keeper's address")
  .setAction(async ({ keeper }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const pool = await getDeployedPool(hre)
    if (pool === undefined) {
      return
    }

    await pool.removeKeepers([keeper])
    console.log('Keeper removed')
  })


task('pool-debug', 'Shows poll debug info')
  .setAction(async (_, hre) => {

    const pool = await getDeployedPool(hre)
    if (pool === undefined) {
      return
    }
    const token = await getApprovedToken(hre)
    if (token === undefined) {
      return
    }
    const moloch = await getDeployedMoloch(hre)
    if (moloch === undefined) {
      return
    }
    const guildAddress = await moloch.guildBank()

    const [sender, sender1] = await hre.ethers.getSigners();
    const shares = await pool.donors(sender.address);
    const balance = await token.balanceOf(sender.address)
    const shares1 = await pool.donors(sender1.address);
    const balance1 = await token.balanceOf(sender1.address)

    const b0 = await sender.getBalance()
    console.log('native balance of Signer', b0.toString())

    console.log("Token address:", token.address);
    console.log("Token supply:", await token.totalSupply());

    console.log('shares0', shares.toString(), 'balance0', balance.toString())
    console.log('shares1', shares1.toString(), 'balance1', balance1.toString())

    console.log('balance of Pool', (await token.balanceOf(pool.address)).toString())
    console.log('balance of Moloch', (await token.balanceOf(moloch.address)).toString())
    console.log('balance of Guild', (await token.balanceOf(guildAddress)).toString())
  })
