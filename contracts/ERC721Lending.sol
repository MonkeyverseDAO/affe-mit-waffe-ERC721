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
    mapping (uint256 => address) public tokenOwnersOnLoan;
    uint256 private currentLoanIndex = 0;

    /**
     * @notice A variable that servers two purposes. 1) To allow the 'outside world' to easily query
     *   whether lendig is currently paused (or not), and 2) to hold the current state so that
     *   certain parts of the code can make decisons about the actions that are allowed (or not.)
     *   NOTE that when lending is paused, this restricts NEW loans from happening, but it does not
     *   restrict owners from reclaiming their loans     --------------- OR FROM THE RECEPIENTS TO RETURN THE LOANS IF WE IMPLEMENT THIS?
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
     * @notice Emitted when a loan is recalled (EITHER WHEN THE OWNER RECALLS IT OR THE RECIPIENT SEND IT BACK DEPENDING ON IF WE IMPLEMENT-----------.
     * @param from is the current owner of the token (which is not the original owner, but rather
     *   the recipient of the loan.)
     * @param to is the original owner of the token, and to whom it is being returned to.
     * @param item is the tokenID representing the token that was lent.
     */
    event LoanRetrieved(address indexed from, address indexed to, uint item);/**
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
        require(tokenOwnersOnLoan[tokenId] == address(0), "ERC721Lending: Trying to lend a token that is already on loan.");

        // Transfer the token
        safeTransferFrom(msg.sender, receiver, tokenId);

        // Add it to the mapping of originally loaned tokens
        tokenOwnersOnLoan[tokenId] = msg.sender;

        // Add to the owner's loan balance
        uint256 loansByAddress = totalLoanedPerAddress[msg.sender];
        totalLoanedPerAddress[msg.sender] = loansByAddress + 1;
        currentLoanIndex = currentLoanIndex + 1;

        emit Loan(msg.sender, receiver, tokenId);
    }

    // /**
    //  * @notice Allow owner to loan their tokens to other addresses
    //  */
    // function retrieveLoan(uint256 tokenId) external nonReentrant {
    //     address borrowerAddress = ownerOf(tokenId);
    //     require(borrowerAddress != msg.sender, "Trying to retrieve their owned loaned token");
    //     require(tokenOwnersOnLoan[tokenId] == msg.sender, "Trying to retrieve token not on loan");

    //     // Remove it from the array of loaned out tokens
    //     delete tokenOwnersOnLoan[tokenId];

    //     // Subtract from the owner's loan balance
    //     uint256 loansByAddress = totalLoanedPerAddress[msg.sender];
    //     totalLoanedPerAddress[msg.sender] = loansByAddress - 1;
    //     currentLoanIndex = currentLoanIndex - 1;
        
    //     // Transfer the token back
    //     _safeTransfer(borrowerAddress, msg.sender, tokenId);

    //     emit LoanRetrieved(borrowerAddress, msg.sender, tokenId);
    // }

    // /**
    //  * Returns the total number of loaned angels
    //  */
    // function totalLoaned() public view returns (uint256) {
    //     return currentLoanIndex;
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
    //         if (tokenOwnersOnLoan[i] == owner) {
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