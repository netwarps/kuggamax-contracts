// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

//import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token20 is ERC20Permit, Ownable {
  constructor(uint256 supply) ERC20("Kuggamax Token", "KMC") ERC20Permit("Kuggamax Token") {
    _mint(msg.sender, supply);
  }
  function mint(address to, uint256 amount) public onlyOwner {
    _mint(to, amount);
  }
}
