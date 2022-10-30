const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Token contract", function() {
  it("Deployment should assign the total supply of tokens to the owner", async function() {
    const [owner] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");

    const hardhatToken = await Token.deploy(1000000);

	console.log("Token address:", hardhatToken.address);

    const ownerBalance = await hardhatToken.balanceOf(owner.address);
    expect(await hardhatToken.totalSupply()).to.equal(ownerBalance);

	console.log('tested')
  });
});
