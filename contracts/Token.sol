// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
  constructor(uint256 supply) ERC20("Kugga Token", "KMC") {
    _mint(msg.sender, supply);
  }
}
