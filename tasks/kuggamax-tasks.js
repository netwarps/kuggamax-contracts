
const {
  getDeployedKuggamax,
  getFirstAccount,
  getKuggaToken,
  hasEnoughTokens,
  hasEnoughAllowance,
  giveAllowance,
  getKuggamaxAddress, getKuggaToken1155
} = require('../scripts/utils')
const deploymentParams = require("./deployment-params");
const Confirm = require("prompt-confirm");

task('kuggamax-deploy', 'Deploys a new instance of the kuggamax')
  .setAction(async (_, hre) => {
    // Make sure everything is compiled
    await run('compile')

    console.log('Deploying a new Kuggamax to the network ' + hre.network.name)
    console.log(
      'Deployment parameters:\n',
      '  labDeposit:', deploymentParams.LAB_DEPOSIT, '\n',
      '  itemDeposit:', deploymentParams.ITEM_DEPOSIT, '\n',
    )

    const Confirm = require('prompt-confirm')
    const prompt = new Confirm('Please confirm that the deployment parameters are correct')
    const confirmation = await prompt.run()

    if (!confirmation) {
      return
    }

    const [owner] = await hre.ethers.getSigners()

    const Token = await hre.ethers.getContractFactory("Token");
    const token = await Token.deploy('1000000000000000000000000');

    console.log("Token address:", token.address);
    console.log("Token supply:", await token.totalSupply());

    const Kuggamax = await hre.ethers.getContractFactory("Kuggamax");

    console.log("Deploying...")
    const kuggamax = await Kuggamax.deploy(
      token.address,
      deploymentParams.LAB_DEPOSIT,
      deploymentParams.ITEM_DEPOSIT
    )

    console.log('')
    console.log('Kuggamax deployed. Address:', kuggamax.address)
    console.log("Set this address in hardhat.config.js's networks section to use the other tasks")
  })

task('create-lab', 'Create a new lab')
  .addParam('description', 'The description of the lab')
  .setAction(async ({ description }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const kuggamax = await getDeployedKuggamax(hre)
    if (kuggamax === undefined) {
      return
    }

    const token = await getKuggaToken(hre)
    if (token === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners();

    if (!await hasEnoughTokens(token, sender.address, deploymentParams.LAB_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(token, sender.address, kuggamax, deploymentParams.LAB_DEPOSIT)) {
      await giveAllowance(token, sender.address, kuggamax, deploymentParams.LAB_DEPOSIT)
    }

    await kuggamax.createLab(description)

    console.log('Lab created')
  })

task('create-item', 'Create a new item')
  .addParam('lab', 'The ID of the lab')
  .addParam('title', 'The title of the item')
  .setAction(async ({ lab, title }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const kuggamax = await getDeployedKuggamax(hre)
    if (kuggamax === undefined) {
      return
    }

    const token = await getKuggaToken(hre)
    if (token === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners();

    if (!await hasEnoughTokens(token, sender.address, deploymentParams.ITEM_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(token, sender.address, kuggamax, deploymentParams.ITEM_DEPOSIT)) {
      await giveAllowance(token, sender.address, kuggamax, deploymentParams.ITEM_DEPOSIT)
    }

    await kuggamax.createItem(lab, title)

    console.log('Item created')
  })


task('mint', 'Mint an ERC1155 token for the item')
  .addParam('item', 'The ID of the item')
  .setAction(async ({ item }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const kuggamax = await getDeployedKuggamax(hre)
    if (kuggamax === undefined) {
      return
    }
    const token = await getKuggaToken(hre)
    if (token === undefined) {
      return
    }

    await kuggamax.mint(item, 100, { value : 1000000000000 })

    console.log('Item minted')
  })

task('add-member', 'Adds a member to the specified lab')
  .addParam('member', "The member's address")
  .setAction(async ({ member }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const kuggamax = await getDeployedKuggamax(hre)
    if (kuggamax === undefined) {
      return
    }

    await kuggamax.addMembers([member])
    console.log('Member added')
  })

task('remove-member', 'Removes a member from the specified lab')
  .addParam('member', "The member's address")
  .setAction(async ({ member }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const kuggamax = await getDeployedKuggamax(hre)
    if (kuggamax === undefined) {
      return
    }

    await kuggamax.removeKeepers([member])
    console.log('Member removed')
  })

task('deposit', 'Deposit native tokens to get some KMC back')
  .addParam('amount', "The amount of native token to deposit")
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const kuggamax = await getDeployedKuggamax(hre)
    if (kuggamax === undefined) {
      return
    }
    const token = await getKuggaToken(hre)
    if (token === undefined) {
      return
    }

    await kuggamax.deposit({ value : amount })

    const [sender] = await hre.ethers.getSigners();
    console.log('amount deposited, balance: ', (await token.balanceOf(sender.address)).toString())
  })


task('withdraw', 'Withdraw native tokens by transferring some KMC')
  .addParam('amount', "The amount of native token to withdraw")
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const kuggamax = await getDeployedKuggamax(hre)
    if (kuggamax === undefined) {
      return
    }
    const token = await getKuggaToken(hre)
    if (token === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners();

    await token.approve(kuggamax.address, amount)
    await kuggamax.withdraw(amount)

    console.log('amount withdrawn, balance: ', (await token.balanceOf(sender.address)).toString())
  })


task('debug', 'Shows debug info')
  .setAction(async (_, hre) => {

    const kuggamax = await getDeployedKuggamax(hre)
    if (kuggamax === undefined) {
      return
    }
    const token = await getKuggaToken(hre)
    if (token === undefined) {
      return
    }
    const t1155 = await getKuggaToken1155(hre)
    if (t1155 === undefined) {
      return
    }

    // const guildAddress = await kuggamax.guildBank()

    const labCount = await kuggamax.getLabCount()
    const itemCount = await kuggamax.getItemCount()

    for (let i = 0; i < labCount; i++) {
      const lab = await kuggamax.getLab(i)
      console.log('lab', i, lab)
    }
    for (let i = 0; i < itemCount; i++) {
      const item = await kuggamax.getItem(i)
      console.log('item', i, item)
    }

    // console.log('_nextItemIndex', (await kuggamax._nextItemIndex()))

    const [sender, sender1] = await hre.ethers.getSigners();

    console.log("Token address:", token.address);
    console.log("Token supply:", await token.totalSupply());

    const k0 = await sender.getBalance()
    console.log('native balance of sender', k0.toString())

    const k1 = await sender.provider.getBalance(kuggamax.address)
    console.log('native balance of kuggamax', k1.toString())

    console.log('balance0 1155', (await t1155.balanceOf(sender.address, 1)).toString())


    console.log('balance0', (await token.balanceOf(sender.address)).toString())
    console.log('balance1', (await token.balanceOf(sender1.address)).toString())

    console.log('balance of Kuggamax', (await token.balanceOf(kuggamax.address)).toString())
    // console.log('balance of Guild', (await token.balanceOf(guildAddress)).toString())
  })
