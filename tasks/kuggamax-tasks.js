
const {
  getDeployedKuggamax,
  getFirstAccount,
  hasEnoughTokens,
  hasEnoughAllowance,
  giveAllowance,
} = require('../scripts/utils')
const deploymentParams = require("./deployment-params");

const Confirm = require("prompt-confirm");
const {sha256, randomBytes} = require("ethers/lib/utils");

task('kuggamax-deploy', 'Deploys a new instance of the kuggamax')
  .setAction(async (_, hre) => {
    // Make sure everything is compiled
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

    const accounts = await hre.ethers.getSigners()
    const supply = hre.ethers.utils.parseEther(deploymentParams.INITIAL_KMC_SUPLY)

    const Token = await hre.ethers.getContractFactory("Token20");
    const token = await Token.deploy(supply);

    console.log("Token address:", token.address);
    console.log("Token supply:", await token.totalSupply());

    const Kuggamax = await hre.ethers.getContractFactory("Kuggamax");

    console.log("Deploying...")
    const kuggamax = await Kuggamax.deploy(
      token.address,
      deploymentParams.LAB_DEPOSIT,
      deploymentParams.ITEM_DEPOSIT,
      deploymentParams.MINT_DEPOSIT,
    )

    //const admin = accounts[0] //kuggamax Admin
    const user1 = accounts[1] //test user1
    const user2 = accounts[2] //test user2
    await token.transfer(user1.address, hre.ethers.utils.parseEther('1000'))
    await token.transfer(user2.address, hre.ethers.utils.parseEther('1000'))
    await token.transfer(kuggamax.address, supply.div(10))

    console.log('')
    console.log('Kuggamax deployed. Address:', kuggamax.address)
    console.log("KMC in Kuggamax:", hre.ethers.utils.formatEther(await token.balanceOf(kuggamax.address)));
    console.log("Set this address in hardhat.config.js's networks section to use the other tasks")
  })

task('create-lab', 'Create a new lab')
  .addParam('description', 'The description of the lab')
  .setAction(async ({ description }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken, itemToken } = await getDeployedKuggamax(hre)
    if (kuggamax === undefined || kmcToken === undefined || itemToken === undefined) {
      return
    }

    const [sender] = await hre.ethers.getSigners();

    if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.LAB_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(kmcToken, sender.address, kuggamax, deploymentParams.LAB_DEPOSIT)) {
      await giveAllowance(kmcToken, sender.address, kuggamax, deploymentParams.LAB_DEPOSIT)
    }

    await kuggamax.createLab(description)

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

    const [sender] = await hre.ethers.getSigners();

    if (!hash) {
      hash = sha256(randomBytes(32))
    }

    if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.ITEM_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(kmcToken, sender.address, kuggamax, deploymentParams.ITEM_DEPOSIT)) {
      await giveAllowance(kmcToken, sender.address, kuggamax, deploymentParams.ITEM_DEPOSIT)
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

    const [sender] = await hre.ethers.getSigners();

    if (!await hasEnoughTokens(kmcToken, sender.address, deploymentParams.MINT_DEPOSIT)) {
      console.error("You don't have enough KMC tokens")
      return
    }

    if (!await hasEnoughAllowance(kmcToken, sender.address, kuggamax, deploymentParams.MINT_DEPOSIT)) {
      await giveAllowance(kmcToken, sender.address, kuggamax, deploymentParams.MINT_DEPOSIT)
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
        });
      });

      setTimeout(() => {
        reject(new Error('timeout'));
      }, 60000)
    });

    await kuggamax.deposit({ value : hre.ethers.utils.parseEther(amount) })

    let event = await depositEvent;
    console.log('deposit... done!', event)

    const [sender] = await hre.ethers.getSigners();
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

    const [sender] = await hre.ethers.getSigners();

    const kmcAmount = hre.ethers.utils.parseEther(amount)
    await kmcToken.approve(kuggamax.address, kmcAmount)
    await kuggamax.withdraw(kmcAmount)

    console.log('amount withdrawn, balance: ', hre.ethers.utils.formatEther((await kmcToken.balanceOf(sender.address))))
    console.log('native balance: ', hre.ethers.utils.formatEther(await sender.getBalance()))
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

    const [sender, sender1] = await hre.ethers.getSigners();

    console.log("Token address:", kmcToken.address);
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
