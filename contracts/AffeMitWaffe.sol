// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./URIManager.sol";
import "@openzeppelin/contracts@4.6.0/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@4.6.0/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts@4.6.0/security/Pausable.sol";
import "@openzeppelin/contracts@4.6.0/access/AccessControl.sol";
import "@openzeppelin/contracts@4.6.0/token/ERC721/extensions/ERC721Burnable.sol";


contract AmWt01 is ERC721, ERC721Enumerable, Pausable, AccessControl, ERC721Burnable, URIManager {
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

    uint8 constant MAX_SUPPLY = 250;
    uint8 public numTokensMinted;
    
    // From testing, it seems OpenSea will only honor a new collection-level administrator (the person who can
    // login to the interface and, for example, change royalty amount/destination), if an event
    // is emmitted, as coded in the OpenZeppelin Ownable contract, announcing the ownership transfer.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


    constructor(string memory name, string memory symbol, string memory baseTokenURI, string memory contractURI)
    ERC721(name, symbol)
    URIManager(baseTokenURI, contractURI) {
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


    // Capabilities of the PAUSER_ROLE

    // create a function which can be called externally by an acount with the
    // PAUSER_ROLE. This function, calls the internal _pause() function
    // inherited from Pausable contract, and its purpose is to pause all transfers
    // of tokens in the contract (which includes minting/burning/transferring)
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    // create a function which can be called externally by an acount with the
    // PAUSER_ROLE. This function, calls the internal _uppause() function
    // inherited from Pausable contract, and its purpose is to *un*pause all transfers
    // of tokens in the contract (which includes minting/burning/transferring)
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }


    // Capabilities of the MINTER_ROLE

    // the main minting function
    function safeMint(address to, uint256 tokenId) public onlyRole(MINTER_ROLE) {
        require(numTokensMinted < MAX_SUPPLY, "The maximum number of tokens that can ever be minted has been reached.");
        numTokensMinted += 1;
        _safeMint(to, tokenId);
    }


    // Capabilities of the METADATA_UPDATER_ROLE

    function setBaseURI(string calldata newURI) external onlyRole(METADATA_UPDATER_ROLE) allowIfNotFrozen {
        _setBaseURI(newURI);
    }

    function setContractURI(string calldata newContractURI) external onlyRole(METADATA_UPDATER_ROLE) allowIfNotFrozen {
        _setContractURI(newContractURI);
    }


    // Information fetching - external/public

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "URI query for nonexistent token");

        // return a concatenation of the baseURI (of the collection), with the tokenID, and the file extension.
        return _buildTokenURI(tokenId);
    }




    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.

    function _baseURI() internal view override returns (string memory) {
        return _getBaseURI();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
