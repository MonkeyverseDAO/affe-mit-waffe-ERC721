// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC721/extensions/ERC721URIStorage.sol)

pragma solidity ^0.8.13;

import "@openzeppelin/contracts@4.6.0/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@4.6.0/security/ReentrancyGuard.sol";

/**
 * @notice Implementation of ERC-721 NFT lending.
 */
abstract contract ERC721Lending is ERC721, ReentrancyGuard {
    using Strings for uint256;

    mapping (address => uint256) public totalLoanedPerAddress;
    mapping (uint256 => address) public tokenOwnersOnLoan;
    uint256 private currentLoanIndex = 0;

    bool public loansPaused = false;

    event Loan(address indexed _from, address indexed to, uint _value);
    event LoanRetrieved(address indexed _from, address indexed to, uint value);


    /**
     * @notice Allow owner to loan their tokens to other addresses
     */
    function loan(uint256 tokenId, address receiver) external nonReentrant {
        require(loansPaused == false, "Token lending is paused.");
        require(ownerOf(tokenId) == msg.sender, "Trying to lend a token that is not owned.");
        require(receiver != address(0), "Loans to the zero 0x0 address are not permitted.");
        require(tokenOwnersOnLoan[tokenId] == address(0), "Trying to lend a token that is already on loan.");

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


}