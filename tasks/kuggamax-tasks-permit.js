
const { expect } = require('chai')
//const {run} = require("hardhat")
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs")

const {
  getDeployedKuggamax,
  hasEnoughAllowance,
  hasEnoughTokens,
  buildDomain,
  getRandItemHash,
  permitApproveKmc
} = require('../scripts/utils')
const deploymentParams = require("./deployment-params")
const {randomBytes, sha256} = require("ethers/lib/utils")

const version = "1"


task('permit-approve', 'Permit someone to execute the KMC Approve operation instead by verifying signature')
  .addParam('amount', 'The amount of KMC will be approved to spender')
  .setAction(async ({ amount }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const { kuggamax, kmcToken } = await getDeployedKuggamax(hre)
    expect( kmcToken !== undefined )

    const name = await kmcToken.name() //"Kuggamax Token"
    console.log('token name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0] //token20.permit() caller
    const owner = accounts[1]   //lab creator
    const chainId = await owner.getChainId()

    const maxDeadline = hre.ethers.constants.MaxUint256

    const nonce = await kmcToken.nonces(owner.address)
    console.log('nonce=', nonce)

    const spender = kuggamax.address
    console.log('spenderAddr:', spender)
    console.log('kmcAmount:', amount)
    let kmcAmount = hre.ethers.utils.parseEther(amount)
    if (kmcAmount <= 0) {
      kmcAmount = 10
    }

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

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
      spender: spender,
      value: kmcAmount,
      nonce: nonce,
      deadline: maxDeadline
    }
    // console.log('domain:', domain)
    // console.log('types:', types)
    // console.log('data:', data)

    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    //console.log('v, r, s:', v, r, s)

    //test method and get receipt
    const receipt = await kmcToken.connect(caller).permit(owner.address, spender, kmcAmount, maxDeadline, v, r, s)
    await receipt.wait()
    console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await kmcToken.nonces(owner.address)).to.be.equal(nonce.add(1))
    console.log('kmcAmount:', kmcAmount)
    expect(await kmcToken.allowance(owner.address, spender)).to.be.equal(kmcAmount)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-approve PASSED !!!!')
  })


task('permit-create-lab', 'Permit someone to execute new lab creation operation instead by verifying signature')
  .addParam('title', 'The lab title')
  .setAction(async ({ title }, hre) => {
    await run('compile')

    const { kuggamax, kmcToken } = await getDeployedKuggamax(hre)
    expect( kuggamax !== undefined )
    expect( kmcToken !== undefined )

    const name = "Kuggamax" //await kuggamax.name()
    console.log('contract name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0]
    const owner = accounts[1]
    const chainId = await owner.getChainId()

    //if owner has no enough allowance for create lab, approve it by permit
    const deposit = deploymentParams.LAB_DEPOSIT
    if (!await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
      console.log('has not enough allowance')
      await permitApproveKmc(kmcToken, owner, kuggamax, deposit, hre)
    }
    //Just for test!!! if owner has enough kmc balance for create lab, transfer it from accounts[0]
    if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
      console.log('transfer to owner:', deposit)
      kmcToken.connect(caller).transfer(owner.address, deposit)
    }

    const nonce = await kuggamax.nonces(owner.address)
    console.log('nonce=', nonce)

    console.log('param:', title)

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

    const domain = buildDomain(name, version, chainId, kuggamax.address)
    const types = {
      PermitCreateLab: [  //PermitCreateLab(string title,string description,address owner,uint256 nonce)
        {name: 'title', type: 'string'},
        {name: 'description', type: 'string'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }
    const desc = 'Description of Lab ' + title
    const data = {
      title: title,
      description: desc,
      owner: owner.address,
      nonce: nonce,
    }
    // console.log('domain:', domain)
    // console.log('types:', types)
    // console.log('data:', data)

    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    console.log('v, r, s:', v, r, s)

    //test method and Event with argument
    const labAssocId = Number(await kuggamax.getLabCount()) + 10
    console.log('labAssocId:', labAssocId)
    const newLabId = await kuggamax.getLabCount()
    console.log('newLabId:', newLabId)
    await expect(kuggamax.connect(caller).permitCreateLab(labAssocId, title, desc, owner.address, v, r, s))
      .to.emit(kuggamax, "LabCreated").withArgs(newLabId, labAssocId)

    // //test method and get receipt
    // const receipt = await kuggamax.connect(caller).permitCreateLab(description, owner.address, v, r, s))
    // await receipt.wait()
    // console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await kuggamax.nonces(owner.address)).to.be.equal(nonce.add(1))
    const ownerKmc = balanceOfOwner.sub(deploymentParams.LAB_DEPOSIT)
    console.log('owner KMC:', ownerKmc)
    //expect(await kmcToken.balanceOf(owner.address)).to.be.equal(ownerKmc)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('native owner balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-create-lab PASSED !!!!')
  })


task('permit-create-item', 'Permit someone to execute new item creation operation instead by verifying signature')
  .addParam('labid', 'The lab Id which the item will be created')
  .setAction(async ({ labid }, hre) => {
    await run('compile')

    const { kuggamax, kmcToken } = await getDeployedKuggamax(hre)
    expect( kuggamax !== undefined )
    expect( kmcToken !== undefined )

    const name = "Kuggamax" //await kuggamax.name()
    console.log('contract name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0]
    const owner = accounts[1]
    const chainId = await owner.getChainId()

    //if owner has no enough allowance for create item, approve it by permit
    const deposit = deploymentParams.ITEM_DEPOSIT
    if (!await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
      await permitApproveKmc(kmcToken, owner, kuggamax, deposit, hre)
    }
    //Just for test!!! if owner has enough kmc balance for create item, transfer it from accounts[0]
    if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
      kmcToken.connect(caller).transfer(owner.address, deposit)
    }

    const nonce = await kuggamax.nonces(owner.address)
    console.log('nonce=', nonce)

    console.log('param:', labid)

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

    const labId = Number(labid)
    const itemHash = getRandItemHash(labId)
    console.log('labId:', labId)
    console.log('itemHash:', itemHash, typeof(itemHash))

    const domain = buildDomain(name, version, chainId, kuggamax.address)
    const types = {
      PermitCreateItem: [  //PermitCreateItem(uint64 labId,bytes32 hash,address owner,uint256 nonce)
        {name: 'labId', type: 'uint64'},
        {name: 'hash', type: 'bytes32'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }
    const data = {
      labId: labId,
      hash: itemHash,
      owner: owner.address,
      nonce: nonce,
    }
    // console.log('domain:', domain)
    // console.log('types:', types)
    // console.log('data:', data)

    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    // console.log('v, r, s:', v, r, s)

    console.log('Lab count:', await kuggamax.getLabCount())
    //test method and Event with argument
    const newItemId = await kuggamax.getItemCount()
    console.log('newItemId:', newItemId)
    await expect(kuggamax.connect(caller).permitCreateItem(labId, itemHash, owner.address, v, r, s))
      .to.emit(kuggamax, "ItemCreated")
      .withArgs(owner.address, labId, newItemId, anyValue)


    // //test method and get receipt
    // const receipt = await kuggamax.connect(caller).permitCreateItem(labId, itemHash, owner.address, v, r, s))
    // await receipt.wait()
    // console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await kuggamax.nonces(owner.address)).to.be.equal(nonce.add(1))
    const ownerKmc = balanceOfOwner.sub(deploymentParams.ITEM_DEPOSIT)
    console.log('owner KMC:', ownerKmc)
    //expect(await kmcToken.balanceOf(owner.address)).to.be.equal(ownerKmc)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('native owner balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-create-item PASSED !!!!')
  })



task('permit-mint', 'Permit someone to execute item mint operation instead by verifying signature')
  .addParam('itemid', 'The item Id will be minted')
  .addParam('amount', 'The amount of item will be minted')
  .setAction(async ({ itemid, amount }, hre) => {
    await run('compile')

    const { kuggamax, kmcToken } = await getDeployedKuggamax(hre)
    expect( kuggamax !== undefined )
    expect( kmcToken !== undefined )

    const name = "Kuggamax" //await kuggamax.name()
    console.log('contract name:', name)

    const accounts = await hre.ethers.getSigners()
    const caller = accounts[0]
    const owner = accounts[1]
    const chainId = await owner.getChainId()

    //if owner has no enough allowance for mint, approve it by permit
    const deposit = deploymentParams.MINT_DEPOSIT
    if (!await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
      await permitApproveKmc(kmcToken, owner, kuggamax, deposit, hre)
    }
    //Just for test!!! if owner has enough kmc balance for mint, transfer it from accounts[0]
    if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
      kmcToken.connect(caller).transfer(owner.address, deposit)
    }

    const nonce = await kuggamax.nonces(owner.address)
    console.log('nonce=', nonce)

    console.log('param:', itemid, amount)

    const balanceOfOwner = await kmcToken.balanceOf(owner.address)
    console.log('owner KMC balance:', balanceOfOwner.toString())

    const nativeBalance = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('owner native balance: ', nativeBalance)

    const itemId = Number(itemid)
    const itemAmount = Number(amount)
    console.log('itemId:', itemId)
    console.log('itemAmount:', itemAmount)

    const domain = buildDomain(name, version, chainId, kuggamax.address)
    const types = {
      PermitMint: [  //PermitMint(uint64 itemId,uint256 amount,address owner,uint256 nonce)
        {name: 'itemId', type: 'uint64'},
        {name: 'amount', type: 'uint256'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }
    const data = {
      owner: owner.address,
      itemId: itemId,
      amount: itemAmount,
      nonce: nonce,
    }
    // console.log('domain:', domain)
    // console.log('types:', types)
     console.log('data:', data)

    const signature = await owner._signTypedData(domain, types, data)
    //console.log('signature:', signature)
    const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)
    console.log('v, r, s:', v, r, s)

    //test method and Event with argument
    await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
      .to.emit(kuggamax, "ItemMinted")
      .withArgs(owner.address, itemId, itemAmount)


    // //test method and get receipt
    // const receipt = await kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
    // await receipt.wait()
    // console.log('receipt:', receipt)

    console.log('')
    console.log('call permit succeed ...')

    expect(await kuggamax.nonces(owner.address)).to.be.equal(nonce.add(1))
    const ownerKmc = balanceOfOwner.sub(deploymentParams.MINT_DEPOSIT)
    console.log('owner KMC:', ownerKmc)
    //expect(await kmcToken.balanceOf(owner.address)).to.be.equal(ownerKmc)

    const nativeBalance2 = hre.ethers.utils.formatEther(await owner.getBalance())
    console.log('native owner balance: ', nativeBalance, nativeBalance2)
    expect(nativeBalance2).to.be.equal(nativeBalance)

    console.log('Test permit-mint PASSED !!!!')
  })