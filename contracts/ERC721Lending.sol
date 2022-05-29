// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC721/extensions/ERC721URIStorage.sol)

pragma solidity ^0.8.13;

import "@openzeppelin/contracts@4.6.0/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@4.6.0/security/ReentrancyGuard.sol";

/**
 * @notice Implementation of ERC-721 NFT lending. The code is based off of the Meta Angels NFT
 *   code (thank you to that team for making their code available for other projects to learn
 *   from!) The code has been modified in several ways, most importantly that in the original
 *   smart contract it was included in the main contract, whereas here we have abstracted the
 *   functionality into its own parent contract. Also, some additional events have been added,
 *   and checking whether loans are paused has been moved to a Modifier.
 */
abstract contract ERC721Lending is ERC721, ReentrancyGuard {
    using Strings for uint256;

    mapping (address => uint256) public totalLoanedPerAddress;
    /**
    * @notice The mapping below keeps track of the original owner of each token, in other words,
    *   the address that truly owns the token (and has simply lent it out.) This is the address
    *   that is allowed to retrieve the token (to end the loan.)
    */
    mapping (uint256 => address) public mapFromTokenIdToRightfulOwner;
    uint256 private currentLoanCounter = 0;

    /**
     * @notice A variable that servers two purposes. 1) To allow the 'outside world' to easily query
     *   whether lendig is currently paused (or not), and 2) to hold the current state so that
     *   certain parts of the code can make decisons about the actions that are allowed (or not.)
     *   NOTE that when lending is paused, this restricts NEW loans from happening, but it does not
     *   restrict owners from reclaiming their loans, or from borrowers returning their borrowed tokens.
     */
    bool public loansAreCurrentlyPaused = false;

    /**
     * @notice Emitted when a loan is made.
     * @param from is the owner of the token (who is making the loan.)
     * @param to is the recipient of the loan.
     * @param item is the tokenID representing the token being lent.
     */
    event Loan(address indexed from, address indexed to, uint item);
    /**
     * @notice Emitted when a loan is recalled by its rightful/original owner.
     * @param byOriginalOwner is the original and rightful owner of the token.
     * @param fromBorrower is the address the token was lent out to.
     * @param item is the tokenID representing the token that was lent.
     */
    event LoanRetrieved(address indexed byOriginalOwner, address indexed fromBorrower, uint item);
    /**
     * @notice Emitted when a loan is returned by the borrower.
     * @param byBorrower is the address that token has been lent to.
     * @param toOriginalOwner is the original and rightful owner of the token.
     * @param item is the tokenID representing the token that was lent.
     */
    event LoanReturned(address indexed byBorrower, address indexed toOriginalOwner, uint item);
    /**
     * @notice Emitted when the pausing of loans is triggered.
     * @param account is the address that paused lending.
     */
    event LendingPaused(address account);
    /**
     * @notice Emitted when UNpausing of loans is triggered.
     * @param account is the address that UNpaused lending.
     */
    event LendingUnpaused(address account);


    /**
     * @notice Enables an owner to loan one of their tokens to another address. The loan is effectively
     *   a complete transfer of ownership. However, what makes it a 'loan' are a set of checks that do
     *   not allow the new owner to do certain things (such as further transfers of the token), and the
     *   ability of the lender to recall the token back into their ownership.
     * @param tokenId is the integer ID of the token to loan.
     * @param receiver is the address that the token will be loaned to.
     */
    function loan(uint256 tokenId, address receiver) external nonReentrant allowIfLendingNotPaused {
        require(msg.sender == ownerOf(tokenId), "ERC721Lending: Trying to lend a token that is not owned.");
        require(msg.sender != receiver, "ERC721Lending: Lending to self (the current owner's address) is not permitted.");
        require(receiver != address(0), "ERC721Lending: Loans to the zero 0x0 address are not permitted.");
        require(mapFromTokenIdToRightfulOwner[tokenId] == address(0), "ERC721Lending: Trying to lend a token that is already on loan.");

        // Transfer the token
        safeTransferFrom(msg.sender, receiver, tokenId);

        // Add it to the mapping (of loaned tokens, and who their original/rightful owners are.)
        mapFromTokenIdToRightfulOwner[tokenId] = msg.sender;

        // Add to the owner's loan balance
        uint256 loansByAddress = totalLoanedPerAddress[msg.sender];
        totalLoanedPerAddress[msg.sender] = loansByAddress + 1;
        currentLoanCounter = currentLoanCounter + 1;

        emit Loan(msg.sender, receiver, tokenId);
    }

    /**
     * @notice Allow the rightful owner of a token to retrieve it, if it is currently on loan.
     * @dev Notice that (in contrast to the loan() function), this function has to use the _safeTransfer
     *   function (as opposed to safeTransferFrom()), in order to bypass the check that the address
     *   requesting the transfer is the current owner (as far as the 721 contract is concerned.)
     * @param tokenId is the integer ID of the token that should be retrieved.
     */
    function retrieveLoan(uint256 tokenId) external nonReentrant {
        address rightfulOwner = mapFromTokenIdToRightfulOwner[tokenId];
        require(msg.sender == rightfulOwner, "ERC721: Only the original/rightful owner can recall a loaned token.");

        address borrowerAddress = ownerOf(tokenId);
        bytes memory emptyTransferData;

        // Remove it from the array of loaned out tokens
        delete mapFromTokenIdToRightfulOwner[tokenId];

        // Subtract from the rightful owner's loan balance
        uint256 loansByAddress = totalLoanedPerAddress[rightfulOwner];
        totalLoanedPerAddress[rightfulOwner] = loansByAddress - 1;

        // Decrease the global counter
        currentLoanCounter = currentLoanCounter - 1;
        
        // Transfer the token back. (The empty transfer data is required by the compiler (i.e. it wont'
        // allow a call to _safeTransfer() with only 3 parameters).
        _safeTransfer(borrowerAddress, rightfulOwner, tokenId, emptyTransferData);

        emit LoanRetrieved(rightfulOwner, borrowerAddress, tokenId);
    }

    /**
     * @notice Allow the borrower to return the loaned token.
     * @param tokenId is the integer ID of the token that should be retrieved.
     */
    function returnLoanByBorrower(uint256 tokenId) external nonReentrant {
        address borrowerAddress = ownerOf(tokenId);
        require(msg.sender == borrowerAddress, "ERC721: Only the borrower can return the token.");

        address rightfulOwner = mapFromTokenIdToRightfulOwner[tokenId];

        // Remove it from the array of loaned out tokens
        delete mapFromTokenIdToRightfulOwner[tokenId];

        // Subtract from the rightful owner's loan balance
        uint256 loansByAddress = totalLoanedPerAddress[rightfulOwner];
        totalLoanedPerAddress[rightfulOwner] = loansByAddress - 1;

        // Decrease the global counter
        currentLoanCounter = currentLoanCounter - 1;
        
        // Transfer the token back
        safeTransferFrom(borrowerAddress, rightfulOwner, tokenId);

        emit LoanReturned(borrowerAddress, rightfulOwner, tokenId);
    }

    // /**
    //  * Returns the total number of loaned angels
    //  */
    // function totalLoaned() public view returns (uint256) {
    //     return currentLoanCounter;
    // }

    // /**
    //  * Returns the loaned balance of an address
    //  */
    // function loanedBalanceOf(address owner) public view returns (uint256) {
    //     require(owner != address(0), "Balance query for the zero address");
    //     return totalLoanedPerAddress[owner];
    // }

    // /**
    //  * Returns all the token ids owned by a given address
    //  */
    // function loanedTokensByAddress(address owner) external view returns (uint256[] memory) {
    //     require(owner != address(0), "Balance query for the zero address");
    //     uint256 totalTokensLoaned = loanedBalanceOf(owner);
    //     uint256 mintedSoFar = totalSupply();
    //     uint256 tokenIdsIdx = 0;

    //     uint256[] memory allTokenIds = new uint256[](totalTokensLoaned);
    //     for (uint256 i = 0; i < mintedSoFar && tokenIdsIdx != totalTokensLoaned; i++) {
    //         if (mapFromTokenIdToRightfulOwner[i] == owner) {
    //             allTokenIds[tokenIdsIdx] = i;
    //             tokenIdsIdx++;
    //         }
    //     }

    //     return allTokenIds;
    // }

    /**
     * @notice Function to pause lending.
     * @dev The function is internal, so it should be called by child contracts, which allows
     *   them to implement their own restrictions, such as Access Control.
     */
    function _pauseLending() internal allowIfLendingNotPaused {
        loansAreCurrentlyPaused = true;
        emit LendingPaused(msg.sender);
    }

    /**
     * @notice Function to UNpause lending.
     * @dev The function is internal, so it should be called by child contracts, which allows
     *   them to implement their own restrictions, such as Access Control.
     */
    function _unpauseLending() internal {
        loansAreCurrentlyPaused = false;
        emit LendingUnpaused(msg.sender);
    }

    /**
     * @dev Modifier to make a function callable only if lending is not paused.
     */
    modifier allowIfLendingNotPaused() {
        require(!loansAreCurrentlyPaused, "ERC721Lending: Lending of tokens is currently paused.");
        _;
    }

}