const deploymentParams = require('./deployment-params')

const {
  getDeployedMoloch,
  getFirstAccount,
  getApprovedToken,
  hasEnoughTokens,
  hasEnoughAllowance,
  giveAllowance
} = require('../scripts/utils')
const {BigNumber} = require("ethers");

task('moloch-deploy', 'Deploys a new instance of the Moloch DAO')
  .setAction(async (taskArgs, hre) => {
    if (deploymentParams.SUMMONER === '' || deploymentParams.TOKEN === '') {
      console.error('Please set the deployment parameters in deployment-params.js')
      return
    }

    // console.log(hre.network, network)

    // Make sure everything is compiled
    await run('compile')

    console.log('Deploying a new DAO to the network ' + hre.network.name)
    console.log(
      'Deployment parameters:\n',
      '  summoner:', deploymentParams.SUMMONER, '\n',
      '  token:', deploymentParams.TOKEN, '\n',
      '  periodSeconds:', deploymentParams.PERIOD_DURATION_IN_SECONDS, '\n',
      '  votingPeriods:', deploymentParams.VOTING_DURATON_IN_PERIODS, '\n',
      '  gracePeriods:', deploymentParams.GRACE_DURATON_IN_PERIODS, '\n',
      '  abortPeriods:', deploymentParams.ABORT_WINDOW_IN_PERIODS, '\n',
      '  proposalDeposit:', deploymentParams.PROPOSAL_DEPOSIT, '\n',
      '  dilutionBound:', deploymentParams.DILUTION_BOUND, '\n',
      '  processingReward:', deploymentParams.PROCESSING_REWARD, '\n'
    )

    const Confirm = require('prompt-confirm')
    const prompt = new Confirm('Please confirm that the deployment parameters are correct')
    const confirmation = await prompt.run()

    if (!confirmation) {
      return
    }

    const [owner] = await hre.ethers.getSigners();

    const Token = await hre.ethers.getContractFactory("Token");
    const token = await Token.deploy('1000000000000000000000000');

    console.log("Token address:", token.address);
    console.log("Token supply:", await token.totalSupply());

    const Moloch = await hre.ethers.getContractFactory("Moloch");

    console.log("Deploying...")
    const moloch = await Moloch.deploy(
      // deploymentParams.SUMMONER,
      owner.address,
      token.address,
      deploymentParams.PERIOD_DURATION_IN_SECONDS,
      deploymentParams.VOTING_DURATON_IN_PERIODS,
      deploymentParams.GRACE_DURATON_IN_PERIODS,
      deploymentParams.ABORT_WINDOW_IN_PERIODS,
      deploymentParams.PROPOSAL_DEPOSIT,
      deploymentParams.DILUTION_BOUND,
      deploymentParams.PROCESSING_REWARD
    )

    console.log('')
    console.log('Moloch DAO deployed. Address:', moloch.address)
    console.log("Set this address in hardhat.config.js's networks section to use the other tasks")
  })

task('moloch-submit-proposal', 'Submits a proposal')
  .addParam('applicant', 'The address of the applicant')
  .addParam('tribute', "The number of token's wei offered as tribute")
  .addParam('shares', 'The number of shares requested')
  .addParam('details', "The proposal's details")
  .setAction(async ({ applicant, tribute, shares, details }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const moloch = await getDeployedMoloch(hre)
    if (moloch === undefined) {
      return
    }

    const token = await getApprovedToken(hre)
    if (token === undefined) {
      return
    }

    const proposalDeposit = await moloch.proposalDeposit()
    console.log('proposalDeposit', proposalDeposit)
    // const sender = await getFirstAccount()
    const [sender] = await hre.ethers.getSigners();

    if (!await hasEnoughTokens(token, sender.address, proposalDeposit)) {
      console.error("You don't have enough tokens to pay the deposit")
      return
    }

    if (!await hasEnoughAllowance(token, sender.address, moloch, proposalDeposit)) {
      await giveAllowance(token, sender.address, moloch, proposalDeposit)
    }

    if (BigNumber.from(tribute).gt(0)) {
      if (!await hasEnoughTokens(token, applicant, tribute)) {
        console.error("The applicant doesn't have enough tokens to pay the tribute")
        return
      }

      if (!await hasEnoughAllowance(token, applicant, moloch, tribute)) {
        console.error('The applicant must give allowance to the DAO before being proposed')
        return
      }
    }

    console.log(applicant, tribute, shares, details)

    const receipt = await moloch.submitProposal(applicant, tribute, shares, details)
    console.log('Submitted proposal number', receipt)
  })


task('moloch-list-proposal', 'List all proposals')
  .setAction(async (_, hre) => {

    const moloch = await getDeployedMoloch(hre)
    if (moloch === undefined) {
      return
    }

    const token = await getApprovedToken(hre)
    if (token === undefined) {
      return
    }
    const proposalCount = await moloch.getProposalQueueLength()
    const period = await moloch.getCurrentPeriod()
    console.log('listing proposals...', proposalCount, period)

    for (var i = 0; i < proposalCount; i++) {
      const proposals = await moloch.proposalQueue(i)
      console.log('proposals', i, proposals)
    }
  })

task('moloch-submit-vote', 'Submits a vote')
  .addParam('proposal', 'The proposal number', undefined, types.int)
  .addParam('vote', 'The vote (yes/no)')
  .setAction(async ({ proposal, vote }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const moloch = await getDeployedMoloch(hre)
    if (moloch === undefined) {
      return
    }

    if (vote.toLowerCase() !== 'yes' && vote.toLowerCase() !== 'no') {
      console.error('Invalid vote. It must be "yes" or "no".')
      return
    }

    const voteNumber = vote.toLowerCase() === 'yes' ? 1 : 2

    await moloch.submitVote(proposal, voteNumber)
    console.log('Vote submitted')
  })

task('moloch-process-proposal', 'Processes a proposal')
  .addParam('proposal', 'The proposal number', undefined, types.int)
  .setAction(async ({ proposal }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const moloch = await getDeployedMoloch(hre)
    if (moloch === undefined) {
      return
    }

    await moloch.processProposal(proposal)
    console.log('Proposal processed')
  })

task('moloch-ragequit', 'Ragequits, burning some shares and getting tokens back')
  .addParam('shares', 'The amount of shares to burn')
  .setAction(async ({ shares }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const moloch = await getDeployedMoloch(hre)
    if (moloch === undefined) {
      return
    }

    await moloch.ragequit(shares)
    console.log(`Burn ${shares} shares`)
  })

task('moloch-update-delegate', 'Updates your delegate')
  .addParam('delegate', "The new delegate's address")
  .setAction(async ({ delegate }, hre) => {
    // Make sure everything is compiled
    await run('compile')

    const moloch = await getDeployedMoloch(hre)
    if (moloch === undefined) {
      return
    }

    await moloch.updateDelegateKey(delegate)
    console.log(`Delegate updated`)
  })
