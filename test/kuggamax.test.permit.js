const { ethers } = require("hardhat")
const { expect } = require("chai")
const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

const {
  buildDomain,
  hasEnoughAllowance,
  giveAllowance,
  hasEnoughTokens,
  getRandItemHash
} = require("../scripts/utils");

const deploymentParams = require("../tasks/deployment-params");
const hre = require("hardhat");
const {sha256, randomBytes} = require("ethers/lib/utils");
const {BigNumber} = require("ethers");

const version = "1"


const revertMsg = {
  token20PermitExpiredDeadline: 'expired deadline',
  permitInvalidSignature: 'invalid signature',
  noEnoughAllowanceForDeposit: 'insufficient allowance', //revert msg from ERC20
  noEnoughBalanceForDeposit: 'transfer amount exceeds balance', // revert msg from ERC20
  invalidLabId: 'invalid labId',
  notMemberOfLab: 'not a member of the lab',
  invalidItemId: 'invalid item id',
  notOwnerOfItem: 'not item owner',
  invalidMintAmount: 'invalid amount',
  itemTokenExisting: 'token existing',

};

const deployKuggmaxToken20 = async () => {

  console.log('Deploying a new Kuggamax to localhost ')
  console.log(
    'Deployment parameters:\n',
    '  labDeposit:', deploymentParams.LAB_DEPOSIT, '\n',
    '  itemDeposit:', deploymentParams.ITEM_DEPOSIT, '\n',
    '  mintDeposit:', deploymentParams.MINT_DEPOSIT, '\n',
  )

  const supply = hre.ethers.utils.parseEther(deploymentParams.INITIAL_KMC_SUPLY)

  const Token = await hre.ethers.getContractFactory("Token20")
  const kmcToken = await Token.deploy(supply)
  expect( kmcToken !== undefined )

  console.log("Token address:", kmcToken.address)
  console.log("Token supply:", await kmcToken.totalSupply())

  const Kuggamax = await hre.ethers.getContractFactory("Kuggamax")

  console.log("Deploying...")
  const kuggamax = await Kuggamax.deploy(
    kmcToken.address,
    deploymentParams.LAB_DEPOSIT,
    deploymentParams.ITEM_DEPOSIT,
    deploymentParams.MINT_DEPOSIT,
  )

  expect( kuggamax !== undefined )

  console.log('')
  console.log('Kuggamax deployed. Address:', kuggamax.address)
  console.log("KMC in Kuggamax:", hre.ethers.utils.formatEther(await kmcToken.balanceOf(kuggamax.address)))
  console.log('')

  const accounts = await hre.ethers.getSigners()
  const chainId = await kuggamax.signer.getChainId()

  //Create a lab, and a item for test
  await createLabItem(kuggamax, kmcToken, accounts)

  return { kuggamax, kmcToken, accounts, chainId }

}

const createLabItem = async (kuggamax, kmcToken, accounts) => {
  const caller = accounts[0]
  const owner = accounts[1]

  let deposit = BigNumber.from(deploymentParams.LAB_DEPOSIT).add(deploymentParams.ITEM_DEPOSIT ).add(deploymentParams.MINT_DEPOSIT).toString()
  console.log('total deposit:', deposit)
  if (!await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
    await giveAllowance(kmcToken, owner, kuggamax, deposit)
  }
  if (!await hasEnoughTokens(kmcToken, owner.address, deposit)) {
    kmcToken.connect(caller).transfer(owner.address, deposit)
  }

  const labAssocId = Number(await kuggamax.getLabCount()) + 1
  console.log('labAssocId:', labAssocId)

  const title = 'Lab-1'
  const description = 'Description of ' + title
  await kuggamax.connect(owner).createLab(labAssocId, title, description)

  const labId = await kuggamax.getLabCount() - 1
  expect(labId).to.be.gt(0)

  console.log('Lab created, labId:', labId)

  const hash = sha256(randomBytes(32))
  await kuggamax.connect(owner).createItem(labId, hash)
  const itemId = await kuggamax.getItemCount() - 1
  expect(itemId).to.be.gte(0)

  console.log('Item created, itemId:', labId)
}

const getSigners = (accounts) => {
  let caller, owner, otherOne
  caller = accounts[0] //admin
  owner = accounts[1]
  otherOne = accounts[2]

  return {caller, owner, otherOne}
}

describe('Kuggamax Contract', () => {
  let name
  // let kuggamax, kmcToken, accounts, chainId
  // let caller, owner, spender, otherOne

  before('deploy contracts', async () => {

  })

  describe("permit-approve-revert", async () => {
    const ONE_DAY_IN_SECS = 24 * 60 * 60
    console.log('permit approve ----------')

    it("Require fail - Deadline shall be later than block.timestamp", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      const spender = kuggamax //spender is kuggamax

      console.log('owner:', owner.address)
      console.log('spender:', spender.address)

      const value = 10
      const deadline = (await time.latest()) - ONE_DAY_IN_SECS //deadline < block.timestamp

      const v = Number(28)
      const r = '0x2710cfc11cd7e17ef5dab6a4f61d0f04128d63c6aa829dfecef7ace665ea5b34'
      const s = '0x64bea4435039cedaf1350199bfc90fda6a78e490be2cbed6e9898da00e2d1619'

      // assert that the deadline is correct
      await expect(kmcToken.connect(caller).permit(owner.address, spender.address, value, deadline, v, r, s))
        .to.be.revertedWith(revertMsg.token20PermitExpiredDeadline)
    })

    it("Require fail - the owner shall be the signature signer", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      const spender = kuggamax //spender is kuggamax
      name = await kmcToken.name()
      const value = 10
      const deadline = (await time.latest()) + ONE_DAY_IN_SECS //deadline > block.timestamp

      const nonce = await kmcToken.nonces(owner.address)
      console.log('nonce=', nonce)

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
        value: value,
        nonce: nonce,
        deadline: deadline
      }

      const signature = await owner._signTypedData(domain, types, data)
      const {v, r, s} = ethers.utils.splitSignature(signature)
      console.log('v,r,s:', v, r, s)

      // const receipt = await kmcToken.connect(caller).permit(otherOne.address, spender.address, value, deadline, v, r, s)
      // console.log(receipt)

      await expect(kmcToken.connect(caller).permit(otherOne.address, spender.address, value, deadline, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })
  })

  describe('permit-create-lab-revert', async () => {
    console.log('create lab -------')
    const types = {
      PermitCreateLab: [  //PermitCreateLab(string title,string description,address owner,uint256 nonce)
        {name: 'title', type: 'string'},
        {name: 'description', type: 'string'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }

    it("Require fail - the owner shall be the create lab signature signer", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      name = "Kuggamax"
      const domain = buildDomain(name, version, chainId, kuggamax.address)

      const title = "Test Lab 1"
      const desc = 'Description of ' + title
      const nonce = await kuggamax.nonces(owner.address)
      console.log('nonce=', nonce)
      console.log('param:', title, desc)

      const data = {
        title: title,
        description: desc,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature)

      const balance = await kmcToken.balanceOf(caller.address)
      console.log('balance:', balance)

      //assert the owner is the signature signer
      const labAssocId = Number(await kuggamax.getLabCount()) + 10
      console.log('labAssocId:', labAssocId)
      await expect(kuggamax.connect(caller).permitCreateLab(labAssocId, title, desc, otherOne.address, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })

    it("Require fail - owner shall has enough kmc allowance for permitCreateLab", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      name = "Kuggamax"
      const domain = buildDomain(name, version, chainId, kuggamax.address)

      const title = "Test Lab 1"
      const desc = 'Description of ' + title
      const nonce = await kuggamax.nonces(owner.address)
      console.log('nonce=', nonce)
      console.log('param:', title, desc)

      const data = {
        title: title,
        description: desc,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature)

      //clear the allowance of create lab deposit
      const deposit = deploymentParams.LAB_DEPOSIT
      if (await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
        await giveAllowance(kmcToken, owner.address, kuggamax, 0)
      }
      //assert the owner has enough kmc for create lab
      const labAssocId = Number(await kuggamax.getLabCount()) + 10
      console.log('labAssocId:', labAssocId)
      await expect(kuggamax.connect(caller).permitCreateLab(labAssocId, title, desc, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.noEnoughAllowanceForDeposit)
    })

    it("Require fail - owner shall has enough kmc balance for permitCreateLab", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      name = "Kuggamax"
      const domain = buildDomain(name, version, chainId, kuggamax.address)

      const title = "Test Lab 1"
      const desc = 'Description of ' + title
      const nonce = await kuggamax.nonces(owner.address)
      console.log('nonce=', nonce)
      console.log('param:', title, desc)

      const data = {
        title: title,
        description: desc,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature)

      const labAssocId = Number(await kuggamax.getLabCount()) + 10
      console.log('labAssocId:', labAssocId)

      //if has no enough allowance, approve it
      const deposit = deploymentParams.LAB_DEPOSIT
      if (!await hasEnoughAllowance(kmcToken, owner.address, kuggamax, deposit)) {
        await giveAllowance(kmcToken, owner, kuggamax, deposit)
      }
      //clear owner's kmc balance for test
      if (await hasEnoughTokens(kmcToken, owner.address, deposit)) {
        console.log('do clear kmc balance')
        kmcToken.connect(owner).transfer(caller.address, 0)
      }

      //assert the owner has enough kmc for create lab
      await expect(kuggamax.connect(caller).permitCreateLab(labAssocId, title, desc, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.noEnoughBalanceForDeposit)
    })
  })

  describe('permit-create-item-revert', async () => {
    const types = {
      PermitCreateItem: [  //PermitCreateItem(uint64 labId,bytes32 hash,address owner,uint256 nonce)
        {name: 'labId', type: 'uint64'},
        {name: 'hash', type: 'bytes32'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }

    it("Require fail - the owner shall be the create item signature signer", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      const labId = await kuggamax.getLabCount() - 1
      const itemHash = getRandItemHash(labId)

      const name = "Kuggamax"
      const nonce = await kuggamax.nonces(owner.address)
      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        labId: labId,
        hash: itemHash,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)

      await expect(kuggamax.connect(caller).permitCreateItem(labId, itemHash, otherOne.address, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })

    it("Require fail - labId shall be valid", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      const labId = await kuggamax.getLabCount()
      const itemHash = getRandItemHash(labId)

      const name = "Kuggamax"
      const nonce = await kuggamax.nonces(owner.address)
      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        labId: labId,
        hash: itemHash,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)

      await expect(kuggamax.connect(caller).permitCreateItem(labId, itemHash, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.invalidLabId)
    })

    it("Require fail - owner must be member of lab", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      let {caller, owner, otherOne} = getSigners(accounts)

      const labId = await kuggamax.getLabCount() - 1
      const itemHash = getRandItemHash(labId)

      expect(labId >= 0)

      //switch value of owner and otherOne
      let t = owner
      owner = otherOne
      otherOne = t

      const name = "Kuggamax"
      const nonce = await kuggamax.nonces(owner.address)
      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        labId: labId,
        hash: itemHash,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature) //fromRpcSig(signature)

      await expect(kuggamax.connect(caller).permitCreateItem(labId, itemHash, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.notMemberOfLab)
    })

  })

  describe('permit-mint-revert', async () => {
    const types = {
      PermitMint: [  //PermitMint(uint64 itemId,uint256 amount,address owner,uint256 nonce)
        {name: 'itemId', type: 'uint64'},
        {name: 'amount', type: 'uint256'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }

    it("Require fail - the owner shall be the item mint signature signer", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = "Kuggamax"

      const itemId = await kuggamax.getItemCount() - 1
      const itemAmount = 1
      const nonce = await kuggamax.nonces(owner.address)

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, otherOne.address, v, r, s))
        .to.be.revertedWith(revertMsg.permitInvalidSignature)
    })

    it("Require fail - the itemId shall be smaller than item count", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = "Kuggamax"

      const itemId = await kuggamax.getItemCount() //invalid itemId
      const itemAmount = 1
      const nonce = await kuggamax.nonces(owner.address)

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.invalidItemId)
    })

    it("Require fail - the owner shall be the item owner", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      let {caller, owner, otherOne} = getSigners(accounts)

      const name = "Kuggamax"

      const itemId = await kuggamax.getItemCount() - 1
      const itemAmount = 1
      const nonce = await kuggamax.nonces(owner.address)

      expect(itemId >= 0)

      //switch value of owner and otherOne
      let t = owner
      owner = otherOne
      otherOne = t

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.notOwnerOfItem)
    })

    it("Require fail - the amount shall be greater than 0", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = "Kuggamax"

      const itemId = await kuggamax.getItemCount() - 1
      const itemAmount = 0
      const nonce = await kuggamax.nonces(owner.address)

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      const data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.invalidMintAmount)
    })

    it("Require fail - the item Token1155 shall not be exist", async () => {
      console.log('-------------------------------------------------------------------')

      const {kuggamax, kmcToken, accounts, chainId} = await loadFixture(deployKuggmaxToken20)
      const {caller, owner, otherOne} = getSigners(accounts)

      const name = "Kuggamax"

      const itemId = await kuggamax.getItemCount() - 1
      const itemAmount = 1
      const nonce = await kuggamax.nonces(owner.address)

      expect(itemId >= 0)

      const domain = buildDomain(name, version, chainId, kuggamax.address)
      let data = {
        owner: owner.address,
        itemId: itemId,
        amount: itemAmount,
        nonce: nonce,
      }

      const token1155 = await hre.ethers.getContractAt('Token1155', await kuggamax.kugga1155())
      if (!await token1155.exists(itemId)) {
        const signature = await owner._signTypedData(domain, types, data)
        const { v, r, s } = hre.ethers.utils.splitSignature(signature)
        //mint 1155 for test
        await kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s)
        console.log('mint for itemId,amount:', itemId, itemAmount)

        expect(await token1155.exists(itemId)).to.be.true

        //get next nonce
        data.nonce = await kuggamax.nonces(owner.address)
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature)

      await expect(kuggamax.connect(caller).permitMint(itemId, itemAmount, owner.address, v, r, s))
        .to.be.revertedWith(revertMsg.itemTokenExisting)
    })

  })

})

