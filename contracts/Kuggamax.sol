// SPDX-License-Identifier: MIT
// Kuggamax.sol

pragma solidity ^0.8.3;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./GuildBank.sol";
import "./Token1155.sol";

contract Kuggamax {
    using SafeMath for uint256;

    event LabCreated (
        uint256 LabId
    );

    event ItemCreated (
        address indexed applicant,
        uint256 indexed labId,
        uint256 itemId
    );

    event Deposit (
        address sender,
        uint256 amount
    );

    event Withdraw (
        address sender,
        uint256 amount
    );

    event KeeperWithdraw (
        address donor,
        uint256 sharesBurned,
        address keeper
    );

    event MemberAdded (
        address owner,
        uint256 labId,
        address[] members
    );

    event MemberRemoved (
        address owner,
        uint256 labId,
        address[] members
    );

    event ItemMinted (
        uint256 sharesToMint,
        address recipient,
        uint256 totalKuggamaxShares
    );

    event SharesBurned (
        uint256 sharesToBurn,
        address recipient,
        uint256 totalKuggamaxShares
    );

    uint256 private _labDeposit; // default = 1 Token
    uint256 private _itemDeposit; // default = 0.01 Token

    IERC20 private _kuggaToken; // approved token contract reference

    Token1155 private _kugga1155; // ERC1155 token contract reference
    GuildBank private _guildBank; // guild bank contract reference

    bool locked; // prevent re-entrancy

//    uint256 constant MAX_NUMBER_OF_SHARES = 10**30; // maximum number of shares that can be minted

    struct LabEntry {
        address owner; // who created the lab
        string description; // the lab description - plaintext
    }
    struct Lab {
        LabEntry entry;
        mapping (address => bool) members; // the lab members
    }
    struct ItemEntry {
        address owner; // who created the item
        string title; // the item title - plaintext
    }


    Lab[] public _labArray;
    ItemEntry[] private _itemArray;

    /********
    MODIFIERS
    ********/
    modifier noReentrancy() {
        require(!locked, "Kuggamax: Reentrant call");
        locked = true;
        _;
        locked = false;
    }
//    modifier onlyMember {
//        require(members[msg.sender].shares > 0, "Moloch::onlyMember - not a member");
//        _;
//    }

    constructor(address erc20, uint256 labDeposit_, uint256 itemDeposit_) {
        require(erc20 != address(0), "Kuggamax::constructor - kuggaToken cannot be 0");
        require(labDeposit_ > 0, "Kuggamax::constructor - labDeposit cannot be 0");

        _kuggaToken = IERC20(erc20);
        _kugga1155 = new Token1155();
        _guildBank = new GuildBank(erc20);

        _labDeposit = labDeposit_;
        _itemDeposit = itemDeposit_;

        _labArray.push();
        _itemArray.push();
    }

    function activate(uint256 initialTokens, uint256 initialKuggamaxShares) public noReentrancy {
//        require(totalKuggamaxShares == 0, "Kuggamax: Already active");
//
//        require(
//            _kuggaToken.transferFrom(msg.sender, address(this), initialTokens),
//            "Kuggamax: Initial tokens transfer failed"
//        );
//        _mintSharesForAddress(initialKuggamaxShares, msg.sender);
    }

    function kuggaToken() public view returns (address) {
        return address(_kuggaToken);
    }
    function kugga1155() public view returns (address) {
        return address(_kugga1155);
    }
    function labDeposit() public view returns (uint256) {
        return _labDeposit;
    }
    function itemDeposit() public view returns (uint256) {
        return _itemDeposit;
    }

    function getLab(uint256 labId) public view returns (LabEntry memory) {
        require(labId < _labArray.length, "Kuggamax::getLab - invalid labId");

        Lab storage lab = _labArray[labId];
        return lab.entry;
    }
    function getLabCount() public view returns (uint256) {
        return _labArray.length;
    }
    function getItem(uint256 itemId) public view returns (ItemEntry memory) {
        require(itemId < _itemArray.length, "Kuggamax::getItem - invalid itemId");

        ItemEntry memory item = _itemArray[itemId];
        return item;
    }
    function getItemCount() public view returns (uint256) {
        return _itemArray.length;
    }

    function createLab(string memory description) public noReentrancy {
        // collect deposit from sender and store it
        require(_kuggaToken.transferFrom(msg.sender, address(this), _labDeposit), "Kuggamax::createLab - deposit token transfer failed");

        Lab storage lab = _labArray.push();
        lab.entry.owner = msg.sender;
        lab.entry.description = description;
        lab.members[msg.sender] = true;

        uint256 labIndex = _labArray.length.sub(1);
        emit LabCreated(labIndex);
    }

    function createItem(uint256 labId, string memory title) public noReentrancy {
        // collect deposit from sender and store it
        if (_itemDeposit > 0) {
            require(_kuggaToken.transferFrom(msg.sender, address(this), _itemDeposit), "Kuggamax::createItem - deposit token transfer failed");
        }
        require(labId < _labArray.length, "Kuggamax::createItem - invalid labId");
        require(_labArray[labId].members[msg.sender], "Kuggamax::createItem - not a member of the lab");

        ItemEntry storage item = _itemArray.push();
        item.owner = msg.sender;
        item.title = title;

        uint256 itemIndex = _itemArray.length.sub(1);
        emit ItemCreated(msg.sender, labId, itemIndex);
    }

    function addMembers(uint256 labId, address[] calldata newMembers) external noReentrancy {
        require(labId < _labArray.length, "Kuggamax::addMembers - invalid labId");
        require(_labArray[labId].entry.owner == msg.sender, "Kuggamax::addMembers - not the owner of the lab");

        Lab storage lab = _labArray[labId];
        for (uint256 i = 0; i < newMembers.length; i++) {
            lab.members[newMembers[i]] = true;
        }

        emit MemberAdded(lab.entry.owner, labId, newMembers);
    }

    function removeMembers(uint256 labId, address[] calldata membersToRemove) external noReentrancy {
        require(labId < _labArray.length, "Kuggamax::removeMembers - invalid labId");
        require(_labArray[labId].entry.owner == msg.sender, "Kuggamax::addMembers - not the owner of the lab");

        Lab storage lab = _labArray[labId];
        for (uint256 i = 0; i < membersToRemove.length; i++) {
            lab.members[membersToRemove[i]] = false;
        }

        emit MemberRemoved(lab.entry.owner, labId, membersToRemove);
    }

    function mint(uint256 itemId, uint256 amount) public noReentrancy payable {
        require(itemId < _itemArray.length, "Kuggamax::mint - invalid item id");
        require(msg.sender == _itemArray[itemId].owner, "Kuggamax::mint - not item owner");
        require(!_kugga1155.exists(itemId), "Kuggamax::mint - token existing");
        require(msg.value >= 1000000000000, "Kuggamax::mint - paid too low");
//        // collect deposit from sender and store it
//        if (_itemDeposit > 0) {
//            require(_kuggaToken.transferFrom(msg.sender, address(this), _itemDeposit), "Kuggamax::createItem - deposit token transfer failed");
//        }

        _kugga1155.mint(_itemArray[itemId].owner, itemId, amount, new bytes(itemId));
    }


    // transfer native tokens to the contract, get some ERC20 back
    function deposit() public noReentrancy payable {
        require(msg.value >= 1000000000000, "Kuggamax::deposit - deposit too little");

        uint256 amount = msg.value;

        require(
            _kuggaToken.transfer(msg.sender, amount),
            "Kuggamax: Deposit transfer failed"
        );

        emit Deposit(
            msg.sender,
            amount
        );
    }

    // transfer ERC20 to proportionally withdraw native tokens
    function withdraw(uint256 amount) public noReentrancy {
        // collect token from sender and store it
        require(_kuggaToken.transferFrom(msg.sender, address(this), amount), "Kuggamax::withdraw - withdraw token transfer failed");

        payable(msg.sender).transfer(amount);

        emit Withdraw(
            msg.sender,
            amount
        );
    }
//
//    // keeper burns shares to withdraw on behalf of the donor
//    function keeperWithdraw(uint256 sharesToBurn, address recipient) public noReentrancy {
//        require(
//            donors[recipient].keepers[msg.sender],
//            "Kuggamax: Sender is not a keeper"
//        );
//
//        _withdraw(recipient, sharesToBurn);
//
//        emit KeeperWithdraw(
//            recipient,
//            sharesToBurn,
//            msg.sender
//        );
//    }
//
//    function _mintSharesForAddress(uint256 sharesToMint, address recipient) internal {
//        totalKuggamaxShares = totalKuggamaxShares.add(sharesToMint);
//        donors[recipient].shares = donors[recipient].shares.add(sharesToMint);
//
//        require(
//            totalKuggamaxShares <= MAX_NUMBER_OF_SHARES,
//            "Kuggamax: Max number of shares exceeded"
//        );
//
//        emit SharesMinted(
//            sharesToMint,
//            recipient,
//            totalKuggamaxShares
//        );
//    }
//
//    function _withdraw(address recipient, uint256 sharesToBurn) internal {
//        Donor storage donor = donors[recipient];
//
//        require(
//            donor.shares >= sharesToBurn,
//            "Kuggamax: Not enough shares to burn"
//        );
//
//        uint256 tokensToWithdraw = _kuggaToken.balanceOf(address(this)).mul(sharesToBurn).div(totalKuggamaxShares);
//
//        totalKuggamaxShares = totalKuggamaxShares.sub(sharesToBurn);
//        donor.shares = donor.shares.sub(sharesToBurn);
//
//        require(
//            _kuggaToken.transfer(recipient, tokensToWithdraw),
//            "Kuggamax: Withdrawal transfer failed"
//        );
//
//        emit SharesBurned(
//            sharesToBurn,
//            recipient,
//            totalKuggamaxShares
//        );
//    }

}
