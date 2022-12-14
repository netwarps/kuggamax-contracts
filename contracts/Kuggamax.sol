// SPDX-License-Identifier: MIT
// Kuggamax.sol

pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./GuildBank.sol";
import "./Token1155.sol";
import "hardhat/console.sol";
//import "@nomiclabs/buidler/console.sol";


contract Kuggamax is EIP712 {

    using Counters for Counters.Counter;

    mapping(address => Counters.Counter) private _nonces;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 private constant _PERMIT_TYPE_HASH_CREATE_LAB =
        keccak256("PermitCreateLab(string title,string description,address owner,uint256 nonce)");

    bytes32 private constant _PERMIT_TYPE_HASH_CREATE_ITEM =
        keccak256("PermitCreateItem(uint64 labId,bytes32 hash,address owner,uint256 nonce)");

    bytes32 private constant _PERMIT_TYPE_HASH_MINT =
        keccak256("PermitMint(uint64 itemId,uint256 amount,address owner,uint256 nonce)");

    event LabCreated (
        uint64 LabId,
        uint64 LabAssocId
    );

    event ItemCreated (
        address indexed creator,
        uint64 indexed labId,
        uint64 itemId,
        bytes32 itemHash
    );

    event Deposit (
        address sender,
        uint256 amount
    );

    event Withdraw (
        address sender,
        uint256 amount
    );

    event MemberAdded (
        address owner,
        uint64 labId,
        address[] members
    );

    event MemberRemoved (
        address owner,
        uint64 labId,
        address[] members
    );

    event ItemMinted (
        address owner,
        uint64 tokenId,
        uint256 amount
    );

    uint256 private _labDeposit; // default = 1 Token
    uint256 private _itemDeposit; // default = 0.01 Token
    uint256 private _mintDeposit; // default = 0.1 Token

    IERC20 private _kuggaToken; // approved token contract reference

    Token1155 private _kugga1155; // ERC1155 token contract reference
    GuildBank private _guildBank; // guild bank contract reference

    bool locked; // prevent re-entrancy

//    uint256 constant MAX_NUMBER_OF_SHARES = 10**30; // maximum number of shares that can be minted

    struct LabEntry {
        address owner; // who created the lab
        string title;  // the lab title - plaintext
        string description; // the lab description - plaintext
    }
    struct Lab {
        LabEntry entry;
        mapping (address => bool) members; // the lab members
    }
    struct ItemEntry {
        address owner; // who created the item
        bytes32 hash;   // the hash of the item, unique
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

    constructor(address erc20, uint256 labDeposit_, uint256 itemDeposit_, uint256 mintDeposit_) EIP712("Kuggamax", "1") {
        require(erc20 != address(0), "Kuggamax::constructor - kuggaToken cannot be 0");
        require(labDeposit_ > 0, "Kuggamax::constructor - labDeposit cannot be 0");

        _kuggaToken = IERC20(erc20);
        _kugga1155 = new Token1155();
        _guildBank = new GuildBank(erc20);

        _labDeposit = labDeposit_;
        _itemDeposit = itemDeposit_;
        _mintDeposit = mintDeposit_;

        _labArray.push();
        _itemArray.push();
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
    function mintDeposit() public view returns (uint256) {
        return _mintDeposit;
    }

    function getLab(uint64 labId) public view returns (LabEntry memory) {
        require(labId < _labArray.length, "Kuggamax::getLab - invalid labId");

        Lab storage lab = _labArray[labId];
        return lab.entry;
    }
    function getLabCount() public view returns (uint64) {
        return uint64(_labArray.length);
    }
    function getItem(uint64 itemId) public view returns (ItemEntry memory) {
        require(itemId < _itemArray.length, "Kuggamax::getItem - invalid itemId");

        ItemEntry memory item = _itemArray[itemId];
        return item;
    }
    function getItemCount() public view returns (uint256) {
        return _itemArray.length;
    }

    function _createLab(uint64 labAssocId, string memory title, string memory description, address owner) private {
        // collect deposit from sender and store it
        if (_labDeposit > 0) {
            require(_kuggaToken.transferFrom(owner, address(this), _labDeposit), "Kuggamax::createLab - deposit token transfer failed");
        }

        Lab storage lab = _labArray.push();
        lab.entry.owner = owner;
        lab.entry.title = title;
        lab.entry.description = description;
        lab.members[owner] = true;

        uint256 labIndex = _labArray.length - 1;
        emit LabCreated(uint64(labIndex), labAssocId);
    }

    function createLab(uint64 labAssocId, string memory title, string memory description) public noReentrancy {
        _createLab(labAssocId, title, description, msg.sender);
    }

    function permitCreateLab(
        uint64 labAssocId,
        string memory title,
        string memory description,
        address owner,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public noReentrancy {

        bytes memory encode = abi.encode(_PERMIT_TYPE_HASH_CREATE_LAB, keccak256(bytes(title)), keccak256(bytes(description)), owner, _useNonce(owner));
        address signer = _recoverSigner(encode, v, r, s);
        require(signer == owner, "Kuggamax::permitCreateLab - invalid signature");

        _createLab(labAssocId, title, description, owner);
    }

    function _createItem(uint64 labId, bytes32 hash, address owner) private {
        require(labId < _labArray.length, "Kuggamax::createItem - invalid labId");
        require(_labArray[labId].members[owner], "Kuggamax::createItem - not a member of the lab");

        // collect deposit from sender and store it
        if (_itemDeposit > 0) {
            require(_kuggaToken.transferFrom(owner, address(this), _itemDeposit), "Kuggamax::createItem - deposit token transfer failed");
        }

        ItemEntry storage item = _itemArray.push();
        item.owner = owner;
        item.hash = hash;

        uint256 itemIndex = _itemArray.length - 1;
        emit ItemCreated(owner, labId, uint64(itemIndex), hash);
    }

    function createItem(uint64 labId, bytes32 hash) public noReentrancy {
        _createItem(labId, hash, msg.sender);
    }

    function permitCreateItem(
        uint64 labId,
        bytes32 hash,
        address owner,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public noReentrancy {

        bytes memory encode = abi.encode(_PERMIT_TYPE_HASH_CREATE_ITEM, labId, hash, owner, _useNonce(owner));
        address signer = _recoverSigner(encode, v, r, s);
        require(signer == owner, "Kuggamax::permitCreateItem - invalid signature");

        _createItem(labId, hash, owner);
    }

    function addMembers(uint64 labId, address[] calldata newMembers) external noReentrancy {
        require(labId < _labArray.length, "Kuggamax::addMembers - invalid labId");
        require(_labArray[labId].entry.owner == msg.sender, "Kuggamax::addMembers - not the owner of the lab");

        Lab storage lab = _labArray[labId];
        for (uint256 i = 0; i < newMembers.length; i++) {
            lab.members[newMembers[i]] = true;
        }

        emit MemberAdded(lab.entry.owner, labId, newMembers);
    }

    function removeMembers(uint64 labId, address[] calldata membersToRemove) external noReentrancy {
        require(labId < _labArray.length, "Kuggamax::removeMembers - invalid labId");
        require(_labArray[labId].entry.owner == msg.sender, "Kuggamax::removeMembers - not the owner of the lab");

        Lab storage lab = _labArray[labId];
        for (uint256 i = 0; i < membersToRemove.length; i++) {
            lab.members[membersToRemove[i]] = false;
        }

        emit MemberRemoved(lab.entry.owner, labId, membersToRemove);
    }

    function _mint(uint64 itemId, uint256 amount, address operator) private {

        require(itemId < _itemArray.length, "Kuggamax::mint - invalid item id");
        require(operator == _itemArray[itemId].owner, "Kuggamax::mint - not item owner");
        require(!_kugga1155.exists(itemId), "Kuggamax::mint - token existing");
        require(amount > 0, "Kuggamax::mint - amount is 0");

        // collect deposit from sender and store it
        if (_mintDeposit > 0) {
            require(_kuggaToken.transferFrom(operator, address(this), _mintDeposit), "Kuggamax::mint - mint token transfer failed");
        }

        _kugga1155.mint(operator, itemId, amount, new bytes(itemId));

        emit ItemMinted(operator, itemId, amount);
    }

    function mint(uint64 itemId, uint256 amount) public noReentrancy {
       _mint(itemId, amount, msg.sender);
    }

    function permitMint(
        uint64 itemId,
        uint256 amount,
        address owner,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public noReentrancy {

        bytes memory encode = abi.encode(_PERMIT_TYPE_HASH_MINT, itemId, amount, owner, _useNonce(owner));
        address signer = _recoverSigner(encode, v, r, s);
        require(signer == owner, "Kuggamax::permitMint - invalid signature");

        _mint(itemId, amount, owner);
    }

    // transfer native tokens to the contract, get some ERC20 back
    function deposit() public noReentrancy payable {
        require(msg.value >= 1000000000000, "Kuggamax::deposit - deposit too little");

        uint256 amount = msg.value;

        require(
            _kuggaToken.transfer(msg.sender, amount * 1000),
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

        payable(msg.sender).transfer(amount / 1000);

        emit Withdraw(
            msg.sender,
            amount
        );
    }

    //Permit related methods similar with ERC20Permit
    function nonces(address owner) public view returns (uint256) {
        return _nonces[owner].current();
    }

    function _useNonce(address owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[owner];
        current = nonce.current();
        nonce.increment();
    }

    function _recoverSigner(
        bytes memory abiEncode,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) private returns(address) {

        bytes32 structHash = keccak256(abiEncode);

        bytes32 hash = _hashTypedDataV4(structHash);

        return ECDSA.recover(hash, v, r, s);
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
