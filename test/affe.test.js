const { expect, use } = require('chai');
const { ethers } = require('hardhat');
const { utils } = ethers;

// hardhat test was not letting me use chai's 'revertedWith' until I added
// the two lines below.
const { solidity } = require('ethereum-waffle');
use(solidity)


require('dotenv').config();
const { CONTRACT_NAME, CONTRACT_SYMBOL, INITIAL_BASE_TOKEN_URI, INITIAL_CONTRACT_URI } = process.env;

// Define an object to store information about roles
const role = {
    admin:{string:"DEFAULT_ADMIN_ROLE"},
    minter:{string:"ROLE_MINTER"},
    pauser:{string:"ROLE_PAUSER"},
    royaltySetter:{string:"ROLE_ROYALTY_SETTING"},
    metadataUpdater:{string:"ROLE_METADATA_UPDATER"},
    metadataFreezer:{string:"ROLE_METADATA_FREEZER"}
};
// We can now implement a loop to store their hex representation
const keys = Object.keys(role);
keys.forEach((key, val) => {
    role[key]['hex'] = utils.keccak256(utils.toUtf8Bytes(role[key].string));
});
// The admin role (as hex) is a special case, defined in the OpenZeppelin
// Access Control contract, we we hardcode that correct value here, instead
// of the value that was set by keccak256 in the loop above
role.admin.hex = '0x0000000000000000000000000000000000000000000000000000000000000000'


// Below are a set of declarations that help clarify what each account may be used for during the unit tests
// First we create an array with all the accounts we want to use, and then we create a 'reverse lookup' object.
// So to find the account name using an index, we use the accountNames array, and
// to find the index of an account using a name, we use the accounIdx object, where we can use the
// accountIdx.name syntax
const accountNames = [
    "accDefaultAdmin",
    "accMinter",
    "accPauser",
    "accRoyaltySetter",
    "accMetaDataUpdater",
    "accMetaDataFreezer",
    "accNewAdmin",
    "accNoRoles1",
    "accNoRoles2"
];
// A reverse-lookup object is built below
const account = {};
counter = 0;
accountNames.forEach(anAccountName => {
    account[anAccountName] = {};
    account[anAccountName]['idx'] = counter;
    counter++;
});
// Another useful element of the object above, is not only a 'reverse-lookup', but also
// we can also use it to store the role intended for each account. We define these below.
account.accDefaultAdmin['role'] = role.admin
account.accMinter['role'] = role.minter
account.accPauser['role'] = role.pauser
account.accRoyaltySetter['role'] = role.royaltySetter
account.accMetaDataUpdater['role'] = role.metadataUpdater
account.accMetaDataFreezer['role'] = role.metadataFreezer
account.accNewAdmin['role'] = role.admin


// THE WAY THE ACCOUNTS WERE IMPLEMENTED ORIGINALLY
// const idxRoleAdmin = 0;
// const idxRoleMinter = 1;
// const idxRoleNone1 = 2;
// const idxRoleNone2 = 3;
// const idxRolePause = 4;
// const idxRoleRoyalty = 5;
// const idxRoleMetaDataUpdater = 6;
// const idxRoleMetaDataFreezer = 7;
// const idxRoleNewAdmin = 8;

const nullAddress = '0x0000000000000000000000000000000000000000'

// THE WAY THE ROLES WERE IMPLEMENTED ORIGINALLY
// const roleAsHexADMIN = '0x0000000000000000000000000000000000000000000000000000000000000000';
// const roleAsHexMinter = utils.keccak256(utils.toUtf8Bytes(role.minter.string));
// const roleAsHexPauser = utils.keccak256(utils.toUtf8Bytes(role.pauser.string));
// const roleAsHexRoyaltyManager = utils.keccak256(utils.toUtf8Bytes(role.royaltySetter.string));
// const roleAsHexMetaDataUpdater = utils.keccak256(utils.toUtf8Bytes(role.metadataUpdater.string));
// const roleAsHexMetaDataFreezer = utils.keccak256(utils.toUtf8Bytes(role.metadataFreezer.string));

// const accountIdxToHexRolePairs = [[account.accDefaultAdmin.idx, role.admin.hex],
//                          [account.accMinter.idx, role.minter.hex],
//                          [account.accPauser.idx, role.pauser.hex],
//                          [account.accRoyaltySetter.idx, role.royaltySetter.hex],
//                          [account.accMetaDataUpdater.idx, role.metadataUpdater.hex],
//                          [account.accMetaDataFreezer.idx, role.metadataFreezer.hex],
//                         ];

// Below are the expected parameters when deploying the contract and signing messages
const expectedContractName = 'AmWt01';
const expectedTokenName = CONTRACT_NAME;
const expectedTokenSymbol = CONTRACT_SYMBOL;
const expectedBaseTokenURI = INITIAL_BASE_TOKEN_URI;
const expectedContractURI = INITIAL_CONTRACT_URI;

// Below are the relevant Interface Ids
const IERC2981 = '0x01ffc9a7';
const IERC165 = '0x2a55205a';
const IERC721 = '0x80ac58cd';

async function deploy(name, ...params)
{
    /*
    This function creates and returns a new smart contract to the hardhat test net. The contract factory returns a Contract connected
    to the first account (e.g. this.accounts[0]). This creates and returns a new Contract object that is not connected
    to any accounts. To use it, an account must be explicitly connected to it. 
    Args:
        name (String): the name of the smart contract
        params (String): any other parameters the smart contract expects
    Returns: 
        deployedContractWithoutSigner (Contract): The depolyed contract unconnected to any accounts
    */
    const contractFactory = await ethers.getContractFactory(name);
    const deployedContractWithSigner = await contractFactory.deploy(...params).then(f => f.deployed());
    const abi = deployedContractWithSigner.interface;
    const {address} = deployedContractWithSigner;
    const {provider} = deployedContractWithSigner;

    const deployedContractWithoutSigner = new ethers.Contract(address, abi, provider);
    return deployedContractWithoutSigner;
}

async function deployAMW721(){
    return deploy(expectedContractName, expectedTokenName, expectedTokenSymbol, expectedBaseTokenURI, expectedContractURI);
}

function accessControlRevertString(address, role){
    return `AccessControl: account ${address.toLowerCase()} is missing role ${role.toLowerCase()}`;
}


/*
  When a local test blockchain is created by Hardhat, it automatically creates 20
  accounts (with private and public keys/addresses) that can be used to test with. These can
  be accessed through the ethers.js library with ethers.getSigners()
  For more information see https://hardhat.org/plugins/nomiclabs-hardhat-ethers.html
*/
describe('Affe mit Waffe Unit Testing',  () => {
    before(async () => {
        this.accounts = await ethers.getSigners();
    });

    // Below we are ensuring that deployAMW721 returns an object that is read-only; in other words
    // it cannot perform any 'write' actions without connecting as a proper signer somehow.
    describe('Test function deploy()', () => {
        it('should return a READ-ONLY contract object', async () => {
        this.contract = await deployAMW721();
        expect(this.contract.signer).to.equal(null);
        expect(await this.contract.ROLE_MINTER()).to.equal(role.minter.hex);
        await this.contract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address)
                            .catch(error => expect(error.message).to.equal('sending a transaction requires a signer (operation="sendTransaction", code=UNSUPPORTED_OPERATION, version=contracts/5.6.2)'));
        });
    });


    describe('Safe Minting', () => {
        let tokenId = 0;
        before(async () => {
            this.contract = await deployAMW721();
            const contractAsAdmin = await this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
            await contractAsAdmin.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
            await contractAsAdmin.grantRole(role.pauser.hex, this.accounts[account.accPauser.idx].address);
        });

        it('should allow an address with ROLE_MINTER to mint a token', async () => {
            let mintReceiverAddress = await this.accounts[account.accNoRoles1.idx].address;
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx])
            // Mint a token, sending it to an address that has no roles
            await expect(contractAsMinter.safeMint(mintReceiverAddress, tokenId)).to.emit(this.contract, 'Transfer')
                .withArgs(nullAddress, mintReceiverAddress, tokenId);
            // Expect the contract to correctly reply with the correct newly minted owner
            // of the tokenId and their balance
            await expect(await this.contract.ownerOf(tokenId)).to.equal(mintReceiverAddress);
            await expect(await this.contract.balanceOf(mintReceiverAddress)).to.equal(1);
        });

        it('should not allow duplicate minting (of the same tokenId twice)', async () => {
            let mintReceiverAddress = await this.accounts[account.accNoRoles1.idx].address;
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(mintReceiverAddress, tokenId);
            // Try to mint the same token (with the same Id) again
            await expect(contractAsMinter.safeMint(mintReceiverAddress, tokenId))
                  .to.be.revertedWith('ERC721: token already minted');
          });

        it('should not allow an address without ROLE_MINTER to mint a token', async () => {
            tokenId++;
            // Connect to the contract wihtout any particular role
            const contractNoRole = await this.contract.connect(this.accounts[account.accNoRoles1.idx])
            // Try to mint a token, with a valid tokenId (not ever minted before), but connected to
            // the contract using an account that hasn't been granted the minting role.
            await expect(contractNoRole.safeMint(this.accounts[account.accNoRoles2.idx].address, tokenId))
                .to.be.revertedWith(accessControlRevertString(this.accounts[account.accNoRoles1.idx].address, role.minter.hex));
        });
    });


    describe('Token tranfers', () => {
        let tokenId = 0;
        before(async () => {
            this.contract = await deployAMW721();
            const adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
            await adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
            await adminContract.grantRole(role.pauser.hex, this.accounts[account.accPauser.idx].address);
        });
    
        it('should allow a token holder to tranfer their token', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Connect to the contract wihtout any particular role, but as the token owner
            const contractNoRole = await this.contract.connect(this.accounts[account.accNoRoles1.idx])
            let balanceHolder1 = await this.contract.balanceOf(this.accounts[account.accNoRoles1.idx].address);
            let balanceHolder2 = await this.contract.balanceOf(this.accounts[account.accNoRoles2.idx].address);
            await expect(contractNoRole.transferFrom(
                this.accounts[account.accNoRoles1.idx].address, this.accounts[account.accNoRoles2.idx].address, tokenId))
                    .to.emit(this.contract, 'Transfer')
                    .withArgs(this.accounts[account.accNoRoles1.idx].address, this.accounts[account.accNoRoles2.idx].address, tokenId);
            // Expect the contract to correctly update the owner and balance of
            await expect(await this.contract.ownerOf(tokenId)).to.equal(this.accounts[account.accNoRoles2.idx].address);
            await expect(await this.contract.balanceOf(this.accounts[account.accNoRoles1.idx].address)).to.equal(balanceHolder1 - 1);
            await expect(await this.contract.balanceOf(this.accounts[account.accNoRoles2.idx].address)).to.equal(balanceHolder2 + 1);
        });
    
        it('should not allow an address to tranfer a token they do not own', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Connect to the contract wihtout any particular role, and NOT as the token owner.
            // In this case, and address is trying to transfer to itself a token it does not own.
            const contractNoRole = await this.contract.connect(this.accounts[account.accNoRoles2.idx])
            await expect(contractNoRole.transferFrom(
                this.accounts[account.accNoRoles1.idx].address, this.accounts[account.accNoRoles2.idx].address, tokenId))
                .to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
        });
    });


    describe('Token burning', () => {
        let tokenId = 0;
        before(async () => {
            this.contract = await deployAMW721();
            const adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
            await adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
            await adminContract.grantRole(role.pauser.hex, this.accounts[account.accPauser.idx].address);
        });
        
        it('should allow the owner of a token to burn it', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            await expect(await this.contract.ownerOf(tokenId.toString())).to.equal(this.accounts[account.accNoRoles1.idx].address);
            // Try to burn the token as the owner
            await expect(this.contract.connect(this.accounts[account.accNoRoles1.idx]).burn(tokenId))
                .to.emit(this.contract, 'Transfer')
                .withArgs(this.accounts[account.accNoRoles1.idx].address, nullAddress, tokenId);
            await expect(await this.contract.balanceOf(this.accounts[account.accNoRoles1.idx].address)).to.equal(0);
            // (Note in the line below, even though 'ownerOf' is a read-only function, so we should not
            // need to 'connect', the 'to.be.reverdedWith' does not seem to work without a connection.)
            await expect(this.contract.connect(this.accounts[account.accNoRoles2.idx]).ownerOf(tokenId))
                .to.be.revertedWith('ERC721: owner query for nonexistent token');
        });

        it('should not allow an account to burn a token they do not own', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Try to burn the token connected to the contract as someone who is not the token owner
            // expecting it to fail
            await expect(this.contract.connect(this.accounts[account.accNoRoles2.idx]).burn(tokenId))
                .to.be.revertedWith('ERC721Burnable: caller is not owner nor approved');
        });
    });

    describe('Contract pausing and then unpausing', () => {
        before(async () => {
            this.contract = await deployAMW721();
            this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
            await this.adminContract.grantRole(role.pauser.hex, this.accounts[account.accPauser.idx].address);
        });

        it('should allow contract to go from starting state, to paused, to unpaused', async () => {
            // Connect to the contract as the pauser
            const contractAsPauser = await this.contract.connect(this.accounts[account.accPauser.idx])
            // Pause the contract
            await contractAsPauser.pause();
            // Unpause the contract
            await contractAsPauser.unpause();
        });

    });

    describe('Pause contract transfers', () => {
        tokenId = 0;
        before(async () => {
            this.contract = await deployAMW721();
            this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
            await this.adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
            await this.adminContract.grantRole(role.pauser.hex, this.accounts[account.accPauser.idx].address);
        });

        it('should not allow safeMint when paused', async () => {
            tokenId++;
            // Connect to the contract as the pauser, and pause the contract
            const contractAsPauser = await this.contract.connect(this.accounts[account.accPauser.idx])
            await contractAsPauser.pause();
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx])
            // Try to mint, expecting it to fail
            await expect(contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId))
                    .to.be.revertedWith('Pausable: paused');
            // Unpause the contract
            await contractAsPauser.unpause();
            // Try to mint again expecting success this time again
            tokenId++;
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
        });

        it('should not allow a token holder to tranfer their token when paused', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Connect to the contract as the pauser, and pause the contract
            const contractAsPauser = await this.contract.connect(this.accounts[account.accPauser.idx])
            await contractAsPauser.pause();
            // Connect to the contract wihtout any particular role, but as the rightful owner of the
            // token that was minted.
            const contractNoRole = await this.contract.connect(this.accounts[account.accNoRoles1.idx])
            await expect(contractNoRole.transferFrom(
                this.accounts[account.accNoRoles1.idx].address, this.accounts[account.accNoRoles2.idx].address, tokenId))
                    .to.be.revertedWith('Pausable: paused');
            // Unpause the contract, and try the transfer again
            await contractAsPauser.unpause();
            await contractNoRole.transferFrom(
                this.accounts[account.accNoRoles1.idx].address, this.accounts[account.accNoRoles2.idx].address, tokenId);
        });

        it('should stop token burning when paused', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Connect to the contract as the pauser, and pause the contract
            const contractAsPauser = await this.contract.connect(this.accounts[account.accPauser.idx])
            await contractAsPauser.pause();
            // Connect to the contract wihtout any particular role, but as the rightful owner of the
            // token that was minted.
            const contractNoRole = await this.contract.connect(this.accounts[account.accNoRoles1.idx])
            await expect(contractNoRole.burn(tokenId)).to.be.revertedWith('Pausable: paused');
            // Unpause the contract, and try the burn again
            await contractAsPauser.unpause();
            await contractNoRole.burn(tokenId);
        });

    });


    describe('Renounce And Revoke Roles', () => {
        beforeEach(async () => {
            this.contract = await deployAMW721();
            this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
            this.newUri = 'ipfs://new_uri/';
            // Grant, to each account, the role it is expected to have
            accountNames.forEach(async (anAccountName) => {
                // There are a couple of reasons we may not want to execute a particular iteration of
                // this loop. 1) If an account should not have a role (so it will be 'undefined'),
                // and 2) if the account in question is already the main admin (then there is no
                // need to grant itself the admin role which it should already have.)
                if (typeof account[anAccountName].role !== 'undefined' &&
                    anAccountName !== "accDefaultAdmin") {
                    const theRole = account[anAccountName].role.hex;
                    const theAddress = this.accounts[account[anAccountName].idx].address;
                    await this.adminContract.grantRole(theRole, theAddress);
                }
            });
        });

        it('should revoke roles given to an address', async () => {
            let tokenId = 1;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Revoke the minting role
            await this.adminContract.revokeRole(await this.contract.ROLE_MINTER(), this.accounts[account.accMinter.idx].address);
            // Try to mint again, after the role being revoked
            tokenId++;
            await expect(contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId))
                .to.be.revertedWith(accessControlRevertString(this.accounts[account.accMinter.idx].address, role.minter.hex));
            
            // Connect to the contract as the pauser
            const contractAsPauser = await this.contract.connect(this.accounts[account.accPauser.idx]);
            // Ensure the role can successfully pause and unpause the contract
            await contractAsPauser.pause();
            await contractAsPauser.unpause();
            // Revoke the pauser role
            await this.adminContract.revokeRole(await this.contract.ROLE_PAUSER(), this.accounts[account.accPauser.idx].address);
            // Try to pause the contract again
            await expect(contractAsPauser.pause())
                .to.be.revertedWith(accessControlRevertString(this.accounts[account.accPauser.idx].address, role.pauser.hex));
            
            // Connect to the contract as the metadata updater
            const contractAsMetadataUpdater = await this.contract.connect(this.accounts[account.accMetaDataUpdater.idx]);
            // Set the contract-level metadata URI
            await contractAsMetadataUpdater.setContractURI('ipfs://some_random_contract_uri/');
            // Revoke the metadata updater role
            await this.adminContract.revokeRole(role.metadataUpdater.hex, this.accounts[account.accMetaDataUpdater.idx].address);
            // Try again to set the contract-level metadata URI
            await expect(this.contract.connect(this.accounts[account.accMetaDataUpdater.idx]).setContractURI('ipfs://another_contract_uri/'))
                .to.be.revertedWith(accessControlRevertString(this.accounts[account.accMetaDataUpdater.idx].address, role.metadataUpdater.hex));
            
            // Connect to the contract as the metadata freezer
            const contractAsMetadataFreezer = await this.contract.connect(this.accounts[account.accMetaDataFreezer.idx]);
            // Freeze the metadata
            await contractAsMetadataFreezer.freezeURIsForever();
            // Revoke the freezer role
            await this.adminContract.revokeRole(role.metadataFreezer.hex, this.accounts[account.accMetaDataFreezer.idx].address);
            // Attempt to freeze the metadata again. Note that in reality, even the role with the proper access would not be
            // able to freeze metadata 'again' - it would be kind of meaningless because once metadata is frozen it can't be
            // frozen again, but as long as the smart contract checks 'first' whether the right role is held to even call the
            // function, the test remains valid.
            await expect(contractAsMetadataFreezer.freezeURIsForever())
                .to.be.revertedWith(accessControlRevertString(this.accounts[account.accMetaDataFreezer.idx].address, role.metadataFreezer.hex));
            
            // Connect to the contract as a 'new' admin 
            const contractAsNextAdmin = await this.contract.connect(this.accounts[account.accNewAdmin.idx]);
            // Ensure the 'new' admin can do something it is supposed to be able to do, such as granting a role
            await contractAsNextAdmin.grantRole(role.metadataFreezer.hex, this.accounts[account.accMetaDataFreezer.idx].address);
            // The 'first' admin now changes its mind and revokes the role from the 'new' admin
            await this.adminContract.revokeRole(role.admin.hex, this.accounts[account.accNewAdmin.idx].address);
            // Confirm that the 'revoked' admin can no longer to 'admin stuff'
            await expect(contractAsNextAdmin.grantRole(role.metadataUpdater.hex, this.accounts[account.accMetaDataUpdater.idx].address))
                .to.be.revertedWith(accessControlRevertString(this.accounts[account.accNewAdmin.idx].address, role.admin.hex));
        });
    
        it('should allow an address to renounce their roles', async () => {
            let tokenId = 1;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // The minter address itself renounces its minter role
            await contractAsMinter.renounceRole(await this.contract.ROLE_MINTER(), this.accounts[account.accMinter.idx].address);
            // Try to mint to confirm it is no longer allowed
            tokenId++;
            await expect(contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId))
                .to.be.revertedWith(accessControlRevertString(this.accounts[account.accMinter.idx].address, role.minter.hex));
            
            // Connect to the contract as the pauser
            const contractAsPauser = await this.contract.connect(this.accounts[account.accPauser.idx]);
            // Ensure the role can successfully pause and unpause the contract
            await contractAsPauser.pause();
            await contractAsPauser.unpause();
            // The pauser address itself renounces its pauser role
            await contractAsPauser.renounceRole(await this.contract.ROLE_PAUSER(), this.accounts[account.accPauser.idx].address);
            // Try to pause the contract again to ensure it can't be done anymore
            await expect(contractAsPauser.pause())
                .to.be.revertedWith(accessControlRevertString(this.accounts[account.accPauser.idx].address, role.pauser.hex));

            // Connect to the contract as the metadata updater
            const contractAsMetadataUpdater = await this.contract.connect(this.accounts[account.accMetaDataUpdater.idx]);
            // Set the contract-level metadata URI
            await contractAsMetadataUpdater.setContractURI('ipfs://yet_another_random_contract_uri/');
            // The address itself renounces the metadata updater role
            await contractAsMetadataUpdater.renounceRole(role.metadataUpdater.hex, this.accounts[account.accMetaDataUpdater.idx].address);
            // Try again to set a contract URI to ensure it can no longer be done
            await expect(contractAsMetadataUpdater.setContractURI('ipfs://a_contract_uri/'))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[account.accMetaDataUpdater.idx].address, role.metadataUpdater.hex));
            
            // Connect to the contract as the metadata freezer
            const contractAsMetadataFreezer = await this.contract.connect(this.accounts[account.accMetaDataFreezer.idx])
            // Freeze the metadata
            await contractAsMetadataFreezer.freezeURIsForever();
            // The address itself renounces the freezer role
            await contractAsMetadataFreezer.renounceRole(role.metadataFreezer.hex, this.accounts[account.accMetaDataFreezer.idx].address);
            // Try again to freeze the metadata to ensure it can't be done. Note this is sort of 'meaningless' as metadata
            // should not be freeze-able 'again'. However, as long as the smart contract checks for access control first
            // the test itself is valid.
            await expect(contractAsMetadataFreezer.freezeURIsForever())
                    .to.be.revertedWith(accessControlRevertString(this.accounts[account.accMetaDataFreezer.idx].address, role.metadataFreezer.hex));
            
            // Connect to the contract as a 'new' admin 
            const contractAsNextAdmin = await this.contract.connect(this.accounts[account.accNewAdmin.idx]);
            // Ensure the 'new' admin can do something it is supposed to be able to do, such as granting a role
            await contractAsNextAdmin.grantRole(role.admin.hex, this.accounts[account.accDefaultAdmin.idx].address);
            // The address itself renounces the admin role
            await contractAsNextAdmin.renounceRole(role.admin.hex, this.accounts[account.accNewAdmin.idx].address);
            // Try again to do something that an admin should be able to do, in order to ensure it is
            // no longer possible.
            await expect(contractAsNextAdmin.grantRole(role.metadataUpdater.hex, this.accounts[account.accMetaDataUpdater.idx].address))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[account.accNewAdmin.idx].address, role.admin.hex));
        });
    });


    describe('Transfer contract admin and (honorary) owner', () => {
        before(async () => {
          this.contract = await deployAMW721();
        });
    
        it('should allow the new admin to take control of contract', async () => {
            // Connect to the contract as admin, and add another address with 'default admin' role
            const contractAsAdmin = await this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
            await contractAsAdmin.grantRole(role.admin.hex, this.accounts[account.accNewAdmin.idx].address);
            // Connect to the contract as a 'new' admin 
            const contractAsNextAdmin = await this.contract.connect(this.accounts[account.accNewAdmin.idx]);
            // The new admin now gets territorial and revokes admin access from the 'first' admin
            await contractAsNextAdmin.revokeRole(role.admin.hex, this.accounts[account.accDefaultAdmin.idx].address);
            // Confirm that the 'previous' admin can no longer do 'admin stuff'
            await expect(contractAsAdmin.grantRole(role.metadataUpdater.hex, this.accounts[account.accMetaDataUpdater.idx].address))
                .to.be.revertedWith(accessControlRevertString(this.accounts[account.accDefaultAdmin.idx].address, role.admin.hex));
        });

        it('should allow the DEFAULT_ADMIN_ROLE to set the Honorary Owner', async () => {
            // Initially expect the owner to be the account that deployed the contract
            const initialOwner = await this.contract.owner();
            expect(initialOwner).to.equal(this.accounts[0].address);
            // Connect to the contract as admin (because of the prior test, we neec to connect as the 'new' admin)
            const contractAsNextAdmin = this.contract.connect(this.accounts[account.accNewAdmin.idx]);
            // Make some address as the new honorary contract owner
            await contractAsNextAdmin.setHonoraryOwner(this.accounts[account.accNoRoles1.idx].address);
            // Check that this has in fact been correctly set
            expect(await this.contract.owner()).to.equal(this.accounts[account.accNoRoles1.idx].address);
        });
    
        it('should not allow the Honorary Owner to be set to the null address', async () => {
            // Connect to the contract as admin (because of a prior test, we neec to connect as the 'new' admin)
            const contractAsNextAdmin = this.contract.connect(this.accounts[account.accNewAdmin.idx]);
            await expect(contractAsNextAdmin.setHonoraryOwner(nullAddress))
                .to.be.revertedWith("New owner cannot be the zero address.");
        });
    });


    describe('Role Interference (using accounts that have their correct role granted)', () => {
        beforeEach(async () => {
          this.contract = await deployAMW721();
          // Connect to the contract as admin
          const contractAsAdmin = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
           // Grant, to each account, the role it is expected to have
           accountNames.forEach(async (anAccountName) => {
                // There are a couple of reasons we may not want to execute a particular iteration of
                // this loop. 1) If an account should not have a role (so it will be 'undefined'),
                // and 2) if the account in question is already the main admin (then there is no
                // need to grant itself the admin role which it should already have.)
                if (typeof account[anAccountName].role !== 'undefined' &&
                    anAccountName !== "accDefaultAdmin") {
                    const theRole = account[anAccountName].role.hex;
                    const theAddress = this.accounts[account[anAccountName].idx].address;
                    await contractAsAdmin.grantRole(theRole, theAddress);
                }
            });
        });

        accountNames.forEach(async (anAccountName) => {
            // Exclude certain accounts that don't make sense for this test, or are redundat
            // (because another account has the same permission set). If one of these
            // accounts is anAccountName, we move on to the next iterataion of the loop.
            const accountsToExclude = [
                "accDefaultAdmin",     // test does not make sense for this role
                "accNewAdmin",  // test does not make sense for this role
                "accNoRoles2"   // test would be redundant (accountNoRole1 IS being tested)
            ];
            if (accountsToExclude.includes(anAccountName)) { return; }

            const idx = account[anAccountName].idx;
            it(`should not allow ${anAccountName} to run DEFAULT_ADMIN_ROLE functions`, async () => {
                // Connect to the contract as the account/role in the current iteration of the loop
                contractAsAnAccount = this.contract.connect(this.accounts[idx])
                // Try to grant the minter role to some address, expecting it to fail
                await expect(contractAsAnAccount.grantRole(role.minter.hex, this.accounts[account.accNoRoles2.idx].address))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.admin.hex));
                // Try to revoke the pauser role, expecting it to fail
                await expect(contractAsAnAccount.revokeRole(role.pauser.hex, this.accounts[account.accPauser.idx].address))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.admin.hex));
                // Try to set the honorary owner to some account, expecting it to fail
                await expect(contractAsAnAccount.setHonoraryOwner(this.accounts[account.accNoRoles2.idx].address))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.admin.hex));
            }); 
        });

        accountNames.forEach(async (anAccountName) => {
            // Exclude certain accounts that don't make sense for this test, or are redundat
            // (because another account has the same permission set). If one of these
            // accounts is anAccountName, we move on to the next iterataion of the loop.
            const accountsToExclude = [
                "accMinter",    // test does not make sense for this role
                "accNewAdmin",  // test would be redundant (accDefaultAdmin IS being tested)
                "accNoRoles2"   // test would be redundant (accountNoRole1 IS being tested)
            ];
            if (accountsToExclude.includes(anAccountName)) { return; }
            
            const idx = account[anAccountName].idx;
            it(`should not allow ${anAccountName} to run ROLE_MINTER functions`, async () => {
                // Connect to the contract as the account/role in the current iteration of the loop
                contractAsAnAccount = this.contract.connect(this.accounts[idx])
                // Try to mint (to self), expecting to fail
                await expect(contractAsAnAccount.safeMint(this.accounts[idx].address, 0))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.minter.hex));
            }); 
        });
    
        accountNames.forEach(async (anAccountName) => {
            // Exclude certain accounts that don't make sense for this test, or are redundat
            // (because another account has the same permission set). If one of these
            // accounts is anAccountName, we move on to the next iterataion of the loop.
            const accountsToExclude = [
                "accPauser",    // test does not make sense for this role
                "accNewAdmin",  // test would be redundant (accDefaultAdmin IS being tested)
                "accNoRoles2"   // test would be redundant (accountNoRole1 IS being tested)
            ];
            if (accountsToExclude.includes(anAccountName)) { return; }
            
            const idx = account[anAccountName].idx;
            it(`should not allow ${anAccountName} to run ROLE_PAUSER functions`, async () => {
                // Connect to the contract as the account/role in the current iteration of the loop
                contractAsAnAccount = this.contract.connect(this.accounts[idx])
                // Try to pause transfers, expecting to fail
                await expect(contractAsAnAccount.pause())
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.pauser.hex));
                // Try to unpause transfers, expecting to fail (NOTE that we don't need to
                // successfully pause the contract first, because the first check that happens in
                // the contract is for Access Control, so the test is valid.)
                await expect(contractAsAnAccount.unpause())
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.pauser.hex));
            });
        });
        
        accountNames.forEach(async (anAccountName) => {
            // Exclude certain accounts that don't make sense for this test, or are redundat
            // (because another account has the same permission set). If one of these
            // accounts is anAccountName, we move on to the next iterataion of the loop.
            const accountsToExclude = [
                "accRoyaltySetter", // test does not make sense for this role
                "accNewAdmin",       // test would be redundant (accDefaultAdmin IS being tested)
                "accNoRoles2"        // test would be redundant (accountNoRole1 IS being tested)
            ];
            if (accountsToExclude.includes(anAccountName)) { return; }
            
            const idx = account[anAccountName].idx;
            it(`should not allow ${anAccountName} to run ROLE_ROYALTY_SETTING functions`, async () => {
                // Connect to the contract as the account/role in the current iteration of the loop
                contractAsAnAccount = this.contract.connect(this.accounts[idx])
                await expect(contractAsAnAccount.setRoyaltyAmountInBips(200))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.royaltySetter.hex));
                await expect(contractAsAnAccount.setRoyaltyDestination(this.accounts[account.accNoRoles2.idx].address))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.royaltySetter.hex));
            }); 
        });
        
        accountNames.forEach(async (anAccountName) => {
            // Exclude certain accounts that don't make sense for this test, or are redundat
            // (because another account has the same permission set). If one of these
            // accounts is anAccountName, we move on to the next iterataion of the loop.
            const accountsToExclude = [
                "accMetaDataUpdater", // test does not make sense for this role
                "accNewAdmin",        // test would be redundant (accDefaultAdmin IS being tested)
                "accNoRoles2"         // test would be redundant (accountNoRole1 IS being tested)
            ];
            if (accountsToExclude.includes(anAccountName)) { return; }
            
            const idx = account[anAccountName].idx;
            it(`should not allow ${anAccountName} to run ROLE_METADATA_UPDATER functions`, async () => {
                // Connect to the contract as the account/role in the current iteration of the loop
                contractAsAnAccount = this.contract.connect(this.accounts[idx])
                // Try to set the base uri, expecting to fail
                await expect(contractAsAnAccount.setBaseURI('ipfs://a_new_different_base_uri/'))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.metadataUpdater.hex));
                // Try to set the contract uri, expecting to fail
                await expect(contractAsAnAccount.setContractURI('ipfs://a_new_different_contract_uri/'))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.metadataUpdater.hex));
            }); 
        });
    
        accountNames.forEach(async (anAccountName) => {
            // Exclude certain accounts that don't make sense for this test, or are redundat
            // (because another account has the same permission set). If one of these
            // accounts is anAccountName, we move on to the next iterataion of the loop.
            const accountsToExclude = [
                "accMetaDataFreezer", // test does not make sense for this role
                "accNewAdmin",        // test would be redundant (accDefaultAdmin IS being tested)
                "accNoRoles2"         // test would be redundant (accountNoRole1 IS being tested)
            ];
            if (accountsToExclude.includes(anAccountName)) { return; }
            
            const idx = account[anAccountName].idx;
            it(`should not allow ${anAccountName} to run ROLE_METADATA_FREEZER function`, async () => {
                // Connect to the contract as the account/role in the current iteration of the loop
                contractAsAnAccount = this.contract.connect(this.accounts[idx])
                // Try to freeze uris, expecting to fail
                await expect(contractAsAnAccount.freezeURIsForever())
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idx].address, role.metadataFreezer.hex));
            }); 
        });
    });


    describe('Token Royalty', () => {
        let tokenId = 0;
        before(async () => {
            this.contract = await deployAMW721();
            this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
            await this.adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
            await this.adminContract.grantRole(role.royaltySetter.hex, this.accounts[account.accRoyaltySetter.idx].address);
            this.royaltyInBips = 200;
            this.tokenPrice = 3000000;
            this.expectedRoyaltyPayment = 60000
            this.royaltyDestination = this.accounts[account.accNoRoles2.idx].address;
        });

        it('should allow ROLE_ROYALTY_SETTING to correctly configure the royalty settings', async () => {
            tokenId++;
            // Connect to the contract as the royalty setter
            const contractAsRoyaltySetter = await this.contract.connect(this.accounts[account.accRoyaltySetter.idx]);
            await contractAsRoyaltySetter.setRoyaltyAmountInBips(this.royaltyInBips);
            await contractAsRoyaltySetter.setRoyaltyDestination(this.royaltyDestination);
            // Connect to the contract as the minter, and mint a token
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);

            const [royaltyDestination, royaltyFee] = 
                await this.contract.connect(this.accounts[account.accNoRoles1.idx]).royaltyInfo(tokenId, this.tokenPrice);
            expect(royaltyDestination).to.equal(this.royaltyDestination);
            expect(royaltyFee).to.equal(this.expectedRoyaltyPayment);
        });

        it('should not return royalty info for a non-existant token', async () => {
            tokenId++;
            await expect(this.contract.connect(this.accounts[account.accNoRoles1.idx]).royaltyInfo(tokenId, this.tokenPrice))
                    .to.be.revertedWith('Royalty requested for non-existing token');
        });

        it('should not allow bips to be > 10000', async () => {
            // Connect to the contract as the royalty setter
            const contractAsRoyaltySetter = await this.contract.connect(this.accounts[account.accRoyaltySetter.idx]);
            await expect(contractAsRoyaltySetter.setRoyaltyAmountInBips(10001))
                    .to.be.revertedWith('Royalty fee will exceed salePrice');
        });

        it(`should not be able to get a token's royalty info after it is burned`, async () => {
            tokenId++;
            // Connect to the contract as the minter, and mint a token
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Get royalty info prior to burn, expecting it to work
            await this.contract.royaltyInfo(tokenId, this.tokenPrice);
            // Burn the token
            await this.contract.connect(this.accounts[account.accNoRoles1.idx]).burn(tokenId);
            // Try to get royalty info, expecting it to fail
            await expect(this.contract.royaltyInfo(tokenId, this.tokenPrice))
                    .to.be.revertedWith('Royalty requested for non-existing token');
        });
    
        it('should be able to pseudo remove royalty fee', async () => {
            tokenId++;
            // Connect to the contract as the minter, and mint a token
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Connect to the contract as the royalty setter
            const contractAsRoyaltySetter = await this.contract.connect(this.accounts[account.accRoyaltySetter.idx]);
            await contractAsRoyaltySetter.setRoyaltyAmountInBips(0);
            const [royaltyDestination, royaltyFee] =
                await this.contract.royaltyInfo(tokenId, this.tokenPrice);
            expect(royaltyFee).to.equal(0);
            expect(royaltyDestination).to.equal(this.royaltyDestination);
        });
    });


    describe('Supported Interfaces', () => {
        before(async () => {
            this.contract = await deployAMW721();
        });

        it('should support IERC721, IERC165, IERC2981', async () => {
            expect(await this.contract.supportsInterface(IERC165)).to.equal(true);
            expect(await this.contract.supportsInterface(IERC721)).to.equal(true);
            expect(await this.contract.supportsInterface(IERC2981)).to.equal(true);
        });
    });


    describe('Freezing metadata', () => {
        let tokenId = 0;
        before(async () => {
            this.contract = await deployAMW721();
                this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
                await this.adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
                await this.adminContract.grantRole(role.metadataUpdater.hex, this.accounts[account.accMetaDataUpdater.idx].address);
                await this.adminContract.grantRole(role.metadataFreezer.hex, this.accounts[account.accMetaDataFreezer.idx].address);
                this.newUri = 'ipfs://some_new_uri/';
                this.contractUri = 'ipfs://some_different_contract_uri/';
        });

        it('should allow ROLE_METADATA_FREEZER to freeze URIs', async () => {
            tokenId++;
            // Connect to the contract as the minter, and mint a token
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Ensure metadata is not frozen
            expect(await this.contract.areURIsForeverFrozen()).to.equal(false);
            // Connect to the contract as the metadata freezer, and freeze the metadata forever
            const contractAsMetadataFreezer = await this.contract.connect(this.accounts[account.accMetaDataFreezer.idx]);
            await contractAsMetadataFreezer.freezeURIsForever();
            // Ensure metadata is frozen
            expect(await this.contract.areURIsForeverFrozen()).to.equal(true);

        });
    });


    describe('Updating URIs', () => {
        let tokenId = 0;
        before(async () => {
        this.contract = await deployAMW721();
            this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
            await this.adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
            await this.adminContract.grantRole(role.metadataUpdater.hex, this.accounts[account.accMetaDataUpdater.idx].address);
            await this.adminContract.grantRole(role.metadataFreezer.hex, this.accounts[account.accMetaDataFreezer.idx].address);
            this.newUri = 'ipfs://some_new_uri/';
            this.contractUri = 'ipfs://some_different_contract_uri/';
        });

        it('should allow the base URI to be set when not frozen', async () => {
            tokenId++;
            // Connect to the contract as the minter, and mint a token
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Check the tokenURI is correct
            expect(await this.contract.tokenURI(tokenId)).to.equal(expectedBaseTokenURI+tokenId.toString()+".json");
            // Connect to the contract as the metadata updater, and update the baseURI
            const contractAsMetadataUpdater = await this.contract.connect(this.accounts[account.accMetaDataUpdater.idx]);
            await contractAsMetadataUpdater.setBaseURI(this.newUri);
            // Check the tokenURI has been correctly updated
            expect(await this.contract.tokenURI(tokenId)).to.equal(this.newUri+tokenId.toString()+".json");
        }); 

        it('should allow the contract URI to be set when not frozen', async () => {
            // Connect to the contract as the metadata updater, and update the contract URI
            const contractAsMetadataUpdater = await this.contract.connect(this.accounts[account.accMetaDataUpdater.idx]);
            await contractAsMetadataUpdater.setContractURI(this.contractUri);
            expect(await this.contract.contractURI()).to.equal(this.contractUri);
        });

        it('should not allow changes to URIs after freezing', async () => {
            tokenId++;
            // Connect to the contract as the minter, and mint a token
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);
            // Connect to the contract as the metadata freezer, and freeze the metadata forever
            const contractAsMetadataFreezer = await this.contract.connect(this.accounts[account.accMetaDataFreezer.idx]);
            await contractAsMetadataFreezer.freezeURIsForever();
            // Connect to the contract as the metadata updater, and try to do all the things
            const contractAsMetadataUpdater = await this.contract.connect(this.accounts[account.accMetaDataUpdater.idx]);
            await expect(contractAsMetadataUpdater.setContractURI('ipfs://yet_another_contract_uri/'))
                        .to.be.revertedWith('URIManager: URIs have been frozen forever');
            await expect(contractAsMetadataUpdater.setBaseURI('ipfs://yet_another_new_base_uri/'))
                        .to.be.revertedWith('URIManager: URIs have been frozen forever');
        });
    });


    describe('Token URI interference', () => {
        let tokenId = 0;
        before(async () => {
            this.contract = await deployAMW721();
                this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
                await this.adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
                await this.adminContract.grantRole(role.metadataUpdater.hex, this.accounts[account.accMetaDataUpdater.idx].address);
                this.newContractUri = 'ipfs://a_new_contract_uri/';
                this.newBaseUri = 'ipfs://a_new_base_uri/';
        });

        it('should not affect the contract uri when the base uri is changed and vice versa', async () => {
            tokenId++;
            // Connect to the contract as the minter, and mint a token
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            await contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, tokenId);

            const originalContractUri = await this.contract.contractURI();
            expect(await this.contract.tokenURI(tokenId)).to.equal(expectedBaseTokenURI+tokenId.toString()+".json");
            // Connect to the contract as the metadata updater, and update the contract URI
            // expecting the baseURI for the tokens to be unaffected
            const contractAsMetadataUpdater = await this.contract.connect(this.accounts[account.accMetaDataUpdater.idx]);
            await contractAsMetadataUpdater.setContractURI(this.newContractUri);
            expect(await this.contract.tokenURI(tokenId)).to.equal(expectedBaseTokenURI+tokenId.toString()+".json");

            expect(await this.contract.contractURI()).to.equal(this.newContractUri);
            // Update the baseURI, expecting the contract URI to be unaffected
            await contractAsMetadataUpdater.setBaseURI(this.newBaseUri);
            expect(await this.contract.contractURI()).to.equal(this.newContractUri);
        });
    });


    describe('Max supply', () => {
        beforeEach(async () => {
            this.contract = await deployAMW721();
            await this.contract.connect(this.accounts[account.accDefaultAdmin.idx]).
                grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
        });

        it('should not not allow minting more than the max supply', async () => {
            const maxSupply = 250;
            const batchLength = 100;
            let transactions = [];
            // Connect to the contract as the minter, and mint a token
            const contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            // this loop batch mints tokens in intervals of "batchLength"
            for(let i = 1; i<=maxSupply; i+=1){
                // The 'i%20' mints tokens rount robin to 20 addresses, as the test blockchain
                // being used provides 20 addresses.
                transactions.push(contractAsMinter.safeMint(this.accounts[i%20].address, i));
                // once transactions reaches the batch length or the loop is about to end,
                // resolve all the promises in the transactions array
                if(transactions.length === batchLength || i === maxSupply-1){
                    // eslint-disable-next-line no-await-in-loop
                    await Promise.all(transactions);
                    transactions =  [];
                }
            }
            // Check that maxSupply tokens were, in fact, minted
            expect(await this.contract.numTokensMinted()).to.equal(maxSupply);
            expect(await this.contract.totalSupply()).to.equal(maxSupply);
            // Check that another token cannot be minted, after minting the maximum number
            await expect(contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, maxSupply+1))
                    .to.be.revertedWith('The maximum number of tokens that can ever be minted has been reached.');
            // Ensure that even after burning a couple of tokens, another cannot be minted
            this.contract.connect(this.accounts[1]).burn(1);
            this.contract.connect(this.accounts[10]).burn(250);
            await expect(contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, maxSupply+1))
                    .to.be.revertedWith('The maximum number of tokens that can ever be minted has been reached.');
        });
    });

});
