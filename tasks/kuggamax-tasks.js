
const {
  getDeployedKuggamax,
  hasEnoughTokens,
  hasEnoughAllowance,
  giveAllowance,
} = require('../scripts/utils')
const deploymentParams = require("./deployment-params")

const Confirm = require("prompt-confirm")
const {sha256, randomBytes} = require("ethers/lib/utils")
const {expect} = require("chai")


task('kuggamax-deploy', 'Deploys a new instance of kuggamax')
  .setAction(async (_, hre) => {

    /* This deploy task has the same function as './scripts/deploy-kuggamax.js' */
    const [deployer] = await hre.ethers.getSigners()

    console.log("Deploying contracts with the account:", deployer.address)
    console.log("Deployer balance:", (await deployer.getBalance()).toString())

    await run('compile')

    console.log('Deploying a new Kuggamax to the network ' + hre.network.name)
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

    const supply = hre.ethers.utils.parseEther(deploymentParams.INITIAL_KMC_SUPLY)
    const Token = await hre.ethers.getContractFactory("Token20")
    const token = await Token.deploy(supply)

    console.log("Token address:", token.address)
    console.log("Token supply:", await token.totalSupply())

    const Kuggamax = await hre.ethers.getContractFactory("Kuggamax")

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
    console.log('KMC in Kuggamax:', hre.ethers.utils.formatEther(await token.balanceOf(kuggamax.address)))
    console.log('Deployed Kuggamax to network:' + hre.network.name + ' succeed !!!')

  })

task('kuggamax-deploy-task', 'Deploys a new instance of kuggamax for tasks')
  .setAction(async (_, hre) => {
    /* This deploy task is used for test tasks, so half of initial KMCs are kept by deployer account for subsequent test task  */

    // Make sure everything is compiled
    await run('compile')

    console.log('Deploying a new Kuggamax for tasks to the network ' + hre.network.name)
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

    const accounts = await hre.ethers.getSigners()
    const supply = hre.ethers.utils.parseEther(deploymentParams.INITIAL_KMC_SUPLY)

    const Token = await hre.ethers.getContractFactory("Token20")
    const token = await Token.deploy(supply)

    console.log("Token address:", token.address)
    console.log("Token supply:", await token.totalSupply())

    const Kuggamax = await hre.ethers.getContractFactory("Kuggamax")

    console.log("Deploying...")
    const kuggamax = await Kuggamax.deploy(
      token.address,
      deploymentParams.LAB_DEPOSIT,
      deploymentParams.ITEM_DEPOSIT,
      deploymentParams.MINT_DEPOSIT,
    )

    // const admin = accounts[0] //kuggamax Admin
    // const user1 = accounts[1] //test user1
    // const user2 = accounts[2] //test user2
    // await token.transfer(user1.address, hre.ethers.utils.parseEther('1000'))
    // await token.transfer(user2.address, hre.ethers.utils.parseEther('1000'))
    await token.transfer(kuggamax.address, supply.div(2))

    console.log('')
    console.log('Kuggamax deployed. Address:', kuggamax.address)
    console.log("KMC in Kuggamax:", hre.ethers.utils.formatEther(await token.balanceOf(kuggamax.address)))
    console.log("Set this address in hardhat.config.js's networks section to use the other tasks")
  })

task('create-lab', 'Create a new lab')
  .addParam('title', 'The lab title')
  .setAction(async ({ title }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.LAB_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(kmcToken, sender.address, kuggamax, deploymentParams.LAB_DEPOSIT)) {
      await giveAllowance(kmcToken, sender, kuggamax, deploymentParams.LAB_DEPOSIT)
    }

    const labAssocId = Number(await kuggamax.getLabCount()) + 10
    console.log('labAssocId:', labAssocId)

    const description = 'Description of lab ' + title
    await kuggamax.createLab(labAssocId, title, description)

    console.log('Lab created')
  })

task('create-item', 'Create a new item')
  .addParam('lab', 'The ID of the lab')
  .addParam('hash', 'The Hash value of the item', undefined, types.Bytes, true)
  .setAction(async ({ lab, hash }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    if (!hash) {
      hash = sha256(randomBytes(32))
    }

    if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.ITEM_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(kmcToken, sender.address, kuggamax, deploymentParams.ITEM_DEPOSIT)) {
      await giveAllowance(kmcToken, sender, kuggamax, deploymentParams.ITEM_DEPOSIT)
    }

    await kuggamax.createItem(lab, hash)

    console.log('Item created')
  })


task('mint', 'Mint an ERC1155 token for the item')
  .addParam('item', 'The ID of the item')
  .addParam('amount', 'The amount of the token', 100, types.int)
  .setAction(async ({ item, amount }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.MINT_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(kmcToken, sender.address, kuggamax, deploymentParams.MINT_DEPOSIT)) {
      await giveAllowance(kmcToken, sender, kuggamax, deploymentParams.MINT_DEPOSIT)
    }

    await kuggamax.mint(item, amount)

    console.log('Item minted')
  })

task('add-member', 'Adds a member to the specified lab')
  .addParam('lab', "The lab id")
  .addParam('member', "The member's address")
  .setAction(async ({ lab,member }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    await kuggamax.addMembers(lab,[member])
    console.log('Member added')
  })

task('remove-member', 'Removes a member from the specified lab')
 .addParam('lab', "The lab id")
  .addParam('member', "The member's address")
  .setAction(async ({lab, member }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    await kuggamax.removeMembers(lab,[member])
    console.log('Member removed')
  })

task('deposit', 'Deposit native tokens to get some KMC back')
  .addParam('amount', "The amount of native token to deposit, in ETH")
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    let depositEvent = new Promise((resolve, reject) => {
      kuggamax.on('Deposit', (sender, amount) => {

        resolve({
          sender: sender,
          amount: amount
        })
      })

      setTimeout(() => {
        reject(new Error('timeout'))
      }, 60000)
    })

    await kuggamax.deposit({ value : hre.ethers.utils.parseEther(amount) })

    let event = await depositEvent
    console.log('deposit... done!', event)

    const [sender] = await hre.ethers.getSigners()
    console.log('amount deposited, balance: ', hre.ethers.utils.formatEther(await kmcToken.balanceOf(sender.address)))
    console.log('native balance: ', hre.ethers.utils.formatEther(await sender.getBalance()))
  })


task('withdraw', 'Withdraw native tokens by transferring some KMC')
  .addParam('amount', "The amount of native token to withdraw, in KMC")
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    const kmcAmount = hre.ethers.utils.parseEther(amount)
    await kmcToken.approve(kuggamax.address, kmcAmount)
    await kuggamax.withdraw(kmcAmount)

    console.log('amount withdrawn, balance: ', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender.address))))
    console.log('native balance: ', hre.ethers.utils.formatEther(await sender.getBalance()))
  })


task('adminWithdraw', 'Administrator withdraw native tokens from Kuggamax')
  .addParam('amount', "The amount of native tokens to withdraw")
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners()

    const ethAmount = hre.ethers.utils.parseEther(amount)
    const kmBalance = await sender.provider.getBalance(kuggamax.address)

    console.log('Kuggamax native balance1: ', kmBalance)
    const tx = {
      to: kuggamax.address,
      value: ethAmount
    }
    await sender.sendTransaction(tx)

    console.log('Kuggamax native balance : ', await sender.provider.getBalance(kuggamax.address))
    expect(await sender.provider.getBalance(kuggamax.address)).to.be.equals(kmBalance + ethAmount)

    await kuggamax.adminWithdraw(ethAmount)

    const kmBalance2 = await sender.provider.getBalance(kuggamax.address)
    console.log('Kuggamax native balance2: ', kmBalance2)
    expect(kmBalance).to.be.equal(kmBalance2)

  })

task('debug', 'Shows debug info')
  .setAction(async (_, hre) => {

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
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

    const [sender, sender1] = await hre.ethers.getSigners()

    console.log("Token address:", kmcToken.address)
    console.log("Token supply:", hre.ethers.utils.formatEther(await kmcToken.totalSupply()))

    const k0 = await sender.getBalance()
    console.log('native balance of sender', hre.ethers.utils.formatEther(k0))

    const k1 = await sender.provider.getBalance(kuggamax.address)
    console.log('native balance of kuggamax', hre.ethers.utils.formatEther(k1))

    console.log('balance0 1155', (await itemToken.balanceOf(sender.address, 1)).toString())


    console.log('KMC balance0', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender.address))))
    console.log('KMC balance1', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender1.address))))
    console.log('KMC balance of Kuggamax', hre.ethers.utils.formatEther((await kmcToken.balanceOf(kuggamax.address))))
    // console.log('balance of Guild', hre.ethers.utils.formatEther((await kmcToken.balanceOf(guildAddress))))
  })
