// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Token20V2 is ERC20PermitUpgradeable, OwnableUpgradeable {
    //constructor(uint256 supply) ERC20("Kuggamax Token", "KMC") ERC20Permit("Kuggamax Token") {
    function initialize(uint256 supply) public initializer {
        string memory name = "Kuggamax Token";
        string memory symbol = "KMC";
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __Ownable_init();

        _mint(msg.sender, supply);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function setVersion(string calldata newVersion) external onlyOwner {
        version = newVersion;
    }

    string public version;
    uint256[49] private __gap;
}
