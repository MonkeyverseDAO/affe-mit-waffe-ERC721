// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts@4.6.0/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@4.6.0/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts@4.6.0/security/Pausable.sol";
import "@openzeppelin/contracts@4.6.0/access/AccessControl.sol";
import "@openzeppelin/contracts@4.6.0/token/ERC721/extensions/ERC721Burnable.sol";

contract AmWt01 is ERC721, ERC721Enumerable, Pausable, AccessControl, ERC721Burnable {
    // create the hashes that identify various roles
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ROYALTY_SETTING_ROLE = keccak256("ROYALTY_SETTING_ROLE");
    bytes32 public constant METADATA_UPDATER_ROLE = keccak256("METADATA_UPDATER_ROLE");
    bytes32 public constant METADATA_FREEZER_ROLE = keccak256("METADATA_FREEZER_ROLE");

    // The owner variable below is 'honorary' in the sense that it serves no purpose
    // as far as the smart contract itself is concerned. The only reason for implementing this variable
    // is that OpenSea queries owner() (according to an article in their Help Center) in order to decide
    // who can login to the OpenSea interface and change collection-wide settings such as the collection
    // banner, or more importantly, royalty amount and destination (as of this writing, OpenSea
    // implements their own royalty settings, rather than EIP-2981.)
    // Semantically, for our purposes (because this contract uses AccessControl rather than Ownable) it
    // would be more accurate to call this variable something like 'openSeaCollectionAdmin' (but sadly
    // OpenSea is looking for 'owner' specifically.)
    address public owner;
    

    // From testing, it seems OpenSea will only honor a new collection-level administrator (the person who can
    // login to the interface and, for example, change royalty amount/destination), if an event
    // is emmitted, as coded in the OpenZeppelin Ownable contract, announcing the ownership transfer.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


    constructor() ERC721("AmWt01", "AMWT01") {
        // To start with we will only grant the DEFAULT_ADMIN_ROLE role to the msg.sender
        // The DEFAULT_ADMIN_ROLE is not granted any rights initially. The only privileges
        // the DEFAULT_ADMIN_ROLE has at contract deployment time are: the ability to grant other
        // roles, and the ability to set the 'honorary' contract owner (see comments above.)
        // For any functionality to be enabled, the DEFAULT_ADMIN_ROLE must explicitly grant those roles to
        // other accounts or to itself.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        setHonoraryOwner(msg.sender);
    }

    // The 'honorary' portion of this function's name refers to the fact that the 'owner' variable
    // serves no purpose in this smart contract itself. 'Ownership' (so to speak) is only implemented here
    // to allow for certain collection-wide admin functionality within the OpenSea web interface.
    function setHonoraryOwner(address honoraryOwner) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(honoraryOwner != address(0), "New owner cannot be the zero address.");
        address priorOwner = owner;
        owner = honoraryOwner;
        emit OwnershipTransferred(priorOwner, honoraryOwner);
    }


    function _baseURI() internal pure override returns (string memory) {
        return "http://amazons.s3.something/";
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function safeMint(address to, uint256 tokenId) public onlyRole(MINTER_ROLE) {
        _safeMint(to, tokenId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
