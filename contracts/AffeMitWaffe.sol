// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts@4.6.0/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@4.6.0/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts@4.6.0/security/Pausable.sol";
import "@openzeppelin/contracts@4.6.0/access/AccessControl.sol";
import "@openzeppelin/contracts@4.6.0/token/ERC721/extensions/ERC721Burnable.sol";
import "./URIManager.sol";
import "./ERC2981GlobalRoyalties.sol";
import "./ERC721Lending.sol";

/**
 * @title Affe mit Waffe NFT smart contract.
 * @notice Implementation of ERC-721 standard for the genesis NFT of the Monkeyverse DAO. With much
 *   gratitude to the collaborative spirit of OpenZeppelin, Real Vision, and Meta Angels, who have
 *   provided their code for other projects to learn from and use.
 */
contract AmWt01 is ERC721, ERC721Enumerable, Pausable, AccessControl,
                   ERC721Burnable, ERC2981GlobalRoyalties, URIManager, ERC721Lending {
    // create the hashes that identify various roles
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ROYALTY_SETTING_ROLE = keccak256("ROYALTY_SETTING_ROLE");
    bytes32 public constant METADATA_UPDATER_ROLE = keccak256("METADATA_UPDATER_ROLE");
    bytes32 public constant METADATA_FREEZER_ROLE = keccak256("METADATA_FREEZER_ROLE");

    /**
     * @notice The owner variable below is 'honorary' in the sense that it serves no purpose
     *   as far as the smart contract itself is concerned. The only reason for implementing
     *   this variable, is that OpenSea queries owner() (according to an article in their Help
     *   Center) in order to decide who can login to the OpenSea interface and change
     *   collection-wide settings, such as the collection banner, or more importantly, royalty
     *   amount and destination (as of this writing, OpenSea implements their own royalty
     *   settings, rather than EIP-2981.)
     *   Semantically, for our purposes (because this contract uses AccessControl rather than
     *   Ownable) it would be more accurate to call this variable something like
     *   'openSeaCollectionAdmin' (but sadly OpenSea is looking for 'owner' specifically.)
     */
    address public owner;

    uint8 constant MAX_SUPPLY = 250;
    /**
     * @dev The variable below keeps track of the number of Affen that have been minted.
     *   HOWEVER, note that the variable is never decreased. Therefore, if an Affe is burned
     *   this does not allow for a new Affe to be minted. There will ever only be 250 MINTED.
     */
    uint8 public numTokensMinted;
    
    /**
     * @dev From our testing, it seems OpenSea will only honor a new collection-level administrator
     *   (the person who can login to the interface and, for example, change royalty
     *   amount/destination), if an event is emmitted (as coded in the OpenZeppelin Ownable contract)
     *   announcing the ownership transfer. Therefore, in order to ensure the OpenSea collection
     *   admin can be updated if ever needed, the following event has been included in this smart
     *   contract.
     */
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @notice Constructor of the Affe mit Waffe ERC-721 NFT smart contract.
     * @param name is the name of the ERC-721 smart contract and NFT collection.
     * @param symbol is the symbol for the collection.
     * @param initialBaseURI is the base URI string that will concatenated with the tokenId to create
     *   the URI where each token's metadata can be found.
     * @param initialContractURI is the location where metadata about the collection as a whole
     *   can be found. For the most part it is an OpenSea-specific requirement (they will try
     *   to find metadata about the collection at this URI when the collecitons is initially
     *   imported into OpenSea.)
     */
    constructor(string memory name, string memory symbol, string memory initialBaseURI, string memory initialContractURI)
    ERC721(name, symbol)
    URIManager(initialBaseURI, initialContractURI) {
        // To start with we will only grant the DEFAULT_ADMIN_ROLE role to the msg.sender
        // The DEFAULT_ADMIN_ROLE is not granted any rights initially. The only privileges
        // the DEFAULT_ADMIN_ROLE has at contract deployment time are: the ability to grant other
        // roles, and the ability to set the 'honorary' contract owner (see comments above.)
        // For any functionality to be enabled, the DEFAULT_ADMIN_ROLE must explicitly grant those roles to
        // other accounts or to itself.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        setHonoraryOwner(msg.sender);
    }

    /**
     * @notice The 'honorary' portion of this function's name refers to the fact that the 'owner' variable
     *   serves no purpose in this smart contract itself. 'Ownership' is mostly meaningless in the context
     *   of a smart contract that implements security with RBAC (Role Based Access Control); so 'owndership'
     *   is only implemented here to allow for certain collection-wide admin functionality within the
     *   OpenSea web interface.
     * @param honoraryOwner is the address that one would like to designate as the 'owner' of this contract
     *   (most likely with the sole purpose of being able to login to OpenSea as an administrator of the
     *   collection.)
     */
    function setHonoraryOwner(address honoraryOwner) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(honoraryOwner != address(0), "New owner cannot be the zero address.");
        address priorOwner = owner;
        owner = honoraryOwner;
        emit OwnershipTransferred(priorOwner, honoraryOwner);
    }


    // Capabilities of the PAUSER_ROLE

    /**
     * @notice A function which can be called externally by an acount with the
     *   PAUSER_ROLE, with the purpose of (in the case of an emergency) pausing all transfers
     *   of tokens in the contract (which includes minting/burning/transferring.)
     * @dev This function calls the internal _pause() function from
     *   OpenZeppelin's Pausable contract.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice A function which can be called externally by an acount with the
     *   PAUSER_ROLE, with the purpose of UNpausing all transfers
     *   of tokens in the contract (which includes minting/burning/transferring.)
     * @dev This function calls the internal _unpause() function from
     *   OpenZeppelin's Pausable contract.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice A function which can be called externally by an acount with the
     *   PAUSER_ROLE, with the purpose of pausing all token lending. When loans
     *   are paused, new loans cannot be made, but existing loans can be recalled.
     * @dev This function calls the internal _pauseLending() function of the
     *   ERC721Lending contract.
     */
    function pauseLending() external onlyRole(PAUSER_ROLE) {
        _pauseLending();
    }

    /**
     * @notice A function which can be called externally by an acount with the
     *   PAUSER_ROLE, with the purpose of UNpausing all token lending.
     * @dev This function calls the internal _unpauseLending() function of the
     *   ERC721Lending contract.
     */
    function unpauseLending() external onlyRole(PAUSER_ROLE) {
        _unpauseLending();
    }


    // Capabilities of the MINTER_ROLE

    // the main minting function
    function safeMint(address to, uint256 tokenId) public onlyRole(MINTER_ROLE) {
        require(numTokensMinted < MAX_SUPPLY, "The maximum number of tokens that can ever be minted has been reached.");
        numTokensMinted += 1;
        _safeMint(to, tokenId);
    }


    // Capabilities of the ROYALTY_SETTING_ROLE
    
    function setRoyaltyAmountInBips(uint16 newRoyaltyInBips) external onlyRole(ROYALTY_SETTING_ROLE) {
        _setRoyaltyAmountInBips(newRoyaltyInBips);
    }

    function setRoyaltyDestination(address newRoyaltyDestination) external onlyRole(ROYALTY_SETTING_ROLE) {
        _setRoyaltyDestination(newRoyaltyDestination);
    }


    // Capabilities of the METADATA_UPDATER_ROLE

    function setBaseURI(string calldata newURI) external onlyRole(METADATA_UPDATER_ROLE) allowIfNotFrozen {
        _setBaseURI(newURI);
    }

    function setContractURI(string calldata newContractURI) external onlyRole(METADATA_UPDATER_ROLE) allowIfNotFrozen {
        _setContractURI(newContractURI);
    }

    
    // Capabilities of the METADATA_FREEZER_ROLE

    function freezeURIsForever() external onlyRole(METADATA_FREEZER_ROLE) allowIfNotFrozen {
        _freezeURIsForever();
    }


    // Information fetching - external/public

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "URI query for nonexistent token");
        return _buildTokenURI(tokenId);
    }

    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        public
        view
        override
        returns (address, uint256)
    {
        require(_exists(tokenId), "Royalty requested for non-existing token");
        return _globalRoyaltyInfo(salePrice);
    }

    // TO DO
    /**
     * Returns all the token ids owned by a given address
     */
    // function ownedTokensByAddress(address owner) external view returns (uint256[] memory) {
    //     uint256 totalTokensOwned = balanceOf(owner);
    //     uint256[] memory allTokenIds = new uint256[](totalTokensOwned);
    //     for (uint256 i = 0; i < totalTokensOwned; i++) {
    //         allTokenIds[i] = (tokenOfOwnerByIndex(owner, i));
    //     }
    //     return allTokenIds;
    // }


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
        override(ERC721, ERC721Enumerable, AccessControl, ERC2981GlobalRoyalties)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
