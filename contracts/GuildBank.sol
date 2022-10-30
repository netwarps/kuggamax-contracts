// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract GuildBank is Ownable {
    using SafeMath for uint256;

    IERC20Metadata public approvedToken; // approved token contract reference

    event Withdrawal(address indexed receiver, uint256 amount);

    constructor(address approvedTokenAddress) {
        approvedToken = IERC20Metadata(approvedTokenAddress);
    }

    function withdraw(address receiver, uint256 shares, uint256 totalShares) public onlyOwner returns (bool) {
        uint256 amount = approvedToken.balanceOf(address(this)).mul(shares).div(totalShares);
        emit Withdrawal(receiver, amount);
        return approvedToken.transfer(receiver, amount);
    }
}
