// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract AdminAccess is Ownable {
    mapping(address => bool) private admins;
    mapping(address => uint256) private adminIndexPlusOne;
    address[] private adminList;

    event AdminAdded(address indexed admin, address indexed operator);
    event AdminRemoved(address indexed admin, address indexed operator);

    modifier onlyAdmin() {
        require(isAdmin(msg.sender), "Admin only");
        _;
    }

    constructor() {
        _addAdmin(_msgSender(), address(0));
    }

    function isAdmin(address account) public view returns (bool) {
        return admins[account];
    }

    function adminCount() public view returns (uint256) {
        return adminList.length;
    }

    function getAdmins() external view returns (address[] memory) {
        return adminList;
    }

    function addAdmin(address account) external onlyAdmin {
        _addAdmin(account, msg.sender);
    }

    function removeAdmin(address account) external onlyAdmin {
        require(account != owner(), "Owner admin cannot be removed");
        require(admins[account], "Admin does not exist");
        require(adminList.length > 1, "At least one admin required");
        _removeAdmin(account, msg.sender);
    }

    function transferOwnership(address newOwner) public virtual override onlyOwner {
        require(newOwner != address(0), "Invalid admin address");
        address previousOwner = owner();
        super.transferOwnership(newOwner);
        if (!admins[newOwner]) {
            _addAdmin(newOwner, msg.sender);
        }
        if (previousOwner != newOwner && admins[previousOwner] && adminList.length > 1) {
            _removeAdmin(previousOwner, msg.sender);
        }
    }

    function _addAdmin(address account, address operator) internal {
        require(account != address(0), "Invalid admin address");
        require(!admins[account], "Admin already exists");
        admins[account] = true;
        adminList.push(account);
        adminIndexPlusOne[account] = adminList.length;
        emit AdminAdded(account, operator);
    }

    function _removeAdmin(address account, address operator) internal {
        uint256 index = adminIndexPlusOne[account];
        require(index != 0, "Admin does not exist");

        uint256 lastIndex = adminList.length;
        if (index != lastIndex) {
            address lastAdmin = adminList[lastIndex - 1];
            adminList[index - 1] = lastAdmin;
            adminIndexPlusOne[lastAdmin] = index;
        }

        adminList.pop();
        delete admins[account];
        delete adminIndexPlusOne[account];

        emit AdminRemoved(account, operator);
    }
}