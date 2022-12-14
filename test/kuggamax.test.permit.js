const { ethers } = require("hardhat")
const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { expect } = require("chai")

const { buildDomain } = require("../scripts/utils");
const deploymentParams = require("../tasks/deployment-params");
const hre = require("hardhat");

const version = "1"


const revertMsg = {
  token20PermitExpiredDeadline: 'expired deadline',
  PermitInvalidSignature: 'invalid signature',

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

  console.log('')
  console.log('Kuggamax deployed. Address:', kuggamax.address)
  console.log("KMC in Kuggamax:", hre.ethers.utils.formatEther(await kmcToken.balanceOf(kuggamax.address)))
  console.log("Set this address in hardhat.config.js's networks section to use the other tasks")

  const accounts = await hre.ethers.getSigners()
  const chainId = await kuggamax.signer.getChainId()

  return { kuggamax, kmcToken, accounts, chainId }

}

describe('Kuggamax Contract', () => {
  let name
  let kuggamax, kmcToken, accounts, chainId
  let owner, spender, otherOne, caller

  beforeEach('deploy contracts', async () => {
    // kuggamax, kmcToken, accounts, chainId = await deployKuggmaxToken20() //await loadFixture(deployKuggmaxToken20)
    // expect( kmcToken !== undefined )
    //
    // owner = accounts[0]
    // spender = accounts[1]
    // otherOne = accounts[5]
    // caller = accounts[10]
  })

  describe("permit-approve-revert", async () => {
    const ONE_DAY_IN_SECS = 24 * 60 * 60


    it("Require fail - Deadline shall be later than block.timestamp", async () => {
      kuggamax, kmcToken, accounts, chainId = await deployKuggmaxToken20() //await loadFixture(deployKuggmaxToken20)
      expect( kmcToken !== undefined )

      //name = await kmcToken.getName()

      owner = accounts[0]
      spender = accounts[1]
      otherOne = accounts[5]
      caller = accounts[10]

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

      // const v = Number(28)
      // const r = '0x2710cfc11cd7e17ef5dab6a4f61d0f04128d63c6aa829dfecef7ace665ea5b34'
      // const s = '0x64bea4435039cedaf1350199bfc90fda6a78e490be2cbed6e9898da00e2d1619'

      // const receipt = await kmcToken.connect(caller).permit(otherOne.address, spender.address, value, deadline, v, r, s)
      // console.log(receipt)

      await expect(kmcToken.connect(caller).permit(otherOne.address, spender.address, value, deadline, v, r, s))
        .to.be.revertedWith(revertMsg.PermitInvalidSignature)
    })
  })

  describe('permit-create-lab-revert', async () => {
    // const { kuggamax, kmcToken, accounts, chainId } = await loadFixture(deployKuggmaxToken20)
    // expect( kuggamax !== undefined )
    // expect( kmcToken !== undefined )

    const name = "Kuggamax"

    const owner = accounts[0]
    const otherOne = accounts[5]
    const caller = accounts[10]

    const domain = buildDomain(name, version, chainId, kuggamax.address)
    const types = {
      PermitCreateLab: [  //PermitCreateLab(string description,address owner,uint256 nonce)
        {name: 'description', type: 'string'},
        {name: 'owner', type: 'address'},
        {name: 'nonce', type: 'uint256'}
      ]
    }

    it("Require fail - the owner shall be the signature signer", async () => {
      const description = 'Lab 1'
      const nonce = await kuggamax.nonces(owner.address)
      console.log('nonce=', nonce)
      console.log('param:', description)

      const data = {
        description: description,
        owner: owner.address,
        nonce: nonce,
      }

      const signature = await owner._signTypedData(domain, types, data)
      const { v, r, s } = hre.ethers.utils.splitSignature(signature)

      //assert the owner is the signature signer
      await expect(kuggamax.connect(caller).permitCreateLab(description, otherOne.address, v, r, s))
        .to.be.revertedWith(revertMsg.PermitInvalidSignature)
    })
  })

})

