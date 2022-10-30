const {getApprovedToken, getMolochAddress} = require("../scripts/utils");
const {BigNumber} = require("ethers");
const { expect } = require("chai");

task('test-task', 'test task system')
  .setAction(async () => {

    // Make sure everything is compiled
    await run('compile')

      const [deployer] = await ethers.getSigners();

      console.log(
          "Deploying contracts with the account:",
          deployer.address
      );

      console.log("Account balance:", (await deployer.getBalance()).toString());


    console.log('testing... done!')
  })


task('recharge', 'transfer some tokens to sender1')
  .addParam('tokens', "The number of token's wei offered as tribute")
  .setAction(async ({ applicant, tokens }, hre) => {

    const token = await getApprovedToken(hre)
    if (token === undefined) {
      return
    }

    let transferEvent = new Promise((resolve, reject) => {
      token.on('Transfer', (from, to, amount) => {

        resolve({
          from: from,
          to: to,
          amount: amount
        });
      });

      setTimeout(() => {
        reject(new Error('timeout'));
      }, 60000)
    });

    const [sender, sender1] = await hre.ethers.getSigners();


    console.log(
      "Transferring from account:",
      sender.address
    );

    console.log("Sender token balance:", (await token.balanceOf(sender.address)).toString());
    console.log("Sender1 token balance:", (await token.balanceOf(sender1.address)).toString());

    await token.transfer(sender1.address, tokens)

    let event = await transferEvent;
    console.log('transfer... done!', event)
    console.log("Sender token balance:", (await token.balanceOf(sender.address)).toString());
    console.log("Sender1 token balance:", (await token.balanceOf(sender1.address)).toString());

    const IERC20 = await hre.ethers.getContractAt('IERC20', token.address, sender1)
    if (IERC20 === undefined) {
      return
    }
    const molochAddress = getMolochAddress()
    if (!molochAddress) {
      console.error(`Please, set the moloch DAO's address in config`)
      return
    }

    // await IERC20.approve(molochAddress, tokens)

    await expect(IERC20.approve(molochAddress, tokens)).to.emit(token, "Approval")

    // const rrr = await new Promise((resolve, reject) => {
    //   token.on('Approval', (owner, spender, amount) => {
    //
    //     resolve({
    //       owner: owner,
    //       spender: spender,
    //       amount: amount
    //     });
    //   });
    //
    //   setTimeout(() => {
    //     reject(new Error('timeout'));
    //   }, 60000)
    // });
    //
    // console.log(rrr)

    token.removeAllListeners()
  })

