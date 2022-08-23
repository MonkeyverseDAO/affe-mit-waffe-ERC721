const { expect, use } = require('chai');
const { ethers } = require('hardhat');
const { utils } = ethers;

// hardhat test was not letting me use chai's 'revertedWith' until I added
// the two lines below.
const { solidity } = require('ethereum-waffle');
use(solidity)


require('dotenv').config();
const { NFT_NAME, NFT_SYMBOL, INITIAL_BASE_TOKEN_URI, COLLECTION_URI } = process.env;
// Below are the expected parameters when deploying the contract
const expectedContractName = 'AmWd02';
const expectedTokenName = NFT_NAME;
const expectedTokenSymbol = NFT_SYMBOL;
const expectedBaseTokenURI = INITIAL_BASE_TOKEN_URI;
const expectedContractURI = COLLECTION_URI;


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

const nullAddress = '0x0000000000000000000000000000000000000000'


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
                .to.be.revertedWith('ERC721: caller is not token owner nor approved');
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
                .to.be.revertedWith('ERC721: invalid token ID');
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
                .to.be.revertedWith('ERC721: caller is not token owner nor approved');
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
        const maxSupply = 250;
        let contractAsMinter;
        before(async () => {
            this.contract = await deployAMW721();
            await this.contract.connect(this.accounts[account.accDefaultAdmin.idx]).
                grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
            // Connect to the contract as the minter
            contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
        });

        it('should not allow minting more than the max supply', async () => {
            const batchLength = 100;
            let transactions = [];
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
        });

        it('should not allow minting more than the max supply, even if tokens are burned', async () => {
            // Ensure that even after burning a token, another cannot be minted
            this.contract.connect(this.accounts[1]).burn(1);
            await expect(contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, maxSupply+1))
                    .to.be.revertedWith('The maximum number of tokens that can ever be minted has been reached.');
            // Try even after buring another token
            this.contract.connect(this.accounts[10]).burn(250);
            await expect(contractAsMinter.safeMint(this.accounts[account.accNoRoles1.idx].address, maxSupply+1))
                    .to.be.revertedWith('The maximum number of tokens that can ever be minted has been reached.');
        });
    });


    describe('Basic Lending Functionality', () => {
        let tokenId = 0;
        let contractAsMinter;
        let accountRightfulOwner;
        let accountBorrower;
        let addressRightfulOwner;
        let addressBorrower;
        let idxArbitraryAccount1 = 13;
        let accArbitraryAccount1;
        before(async () => {
            this.contract = await deployAMW721();
                this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
                await this.adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
            // Connect to the contract as the minter
            contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            accountRightfulOwner = this.accounts[account.accNoRoles1.idx];
            accountBorrower = this.accounts[account.accNoRoles2.idx];
            addressRightfulOwner = accountRightfulOwner.address;
            addressBorrower = accountBorrower.address;
            // An arbitrary account we can use
            accArbitraryAccount1 = this.accounts[idxArbitraryAccount1];
        });

        it('should allow an owner to lend a token', async () => {
            // Mint a couple of tokens
            tokenId++;
            await contractAsMinter.safeMint(addressRightfulOwner, tokenId);
            tokenId++;
            await contractAsMinter.safeMint(addressRightfulOwner, tokenId);
            // Connect to the contract as the token owner, and lend a token
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            await expect(await contractAsRightfulOwner.loan(addressBorrower, tokenId))
                .to.emit(this.contract, 'Loan').withArgs(addressRightfulOwner, addressBorrower, tokenId);
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(tokenId-1)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(1);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([1]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([2]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([2]);
        });

        it('should allow an owner to recall a loan', async () => {
            // Connect to the contract as the token owner
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            // Recall the loan made during the previous 'it should' section
            await expect(await contractAsRightfulOwner.reclaimLoan(tokenId))
                .to.emit(this.contract, 'LoanReclaimed').withArgs(addressRightfulOwner, addressBorrower, tokenId);
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(tokenId-1)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressRightfulOwner);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(2);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(0);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([1, 2]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([]);
        });

        it('should allow a borrower to return a loan', async () => {
            // Use the first token that was minted further above
            aToken = tokenId-1;
            // Connect to the contract as the token owner
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            // Loan the token
            await contractAsRightfulOwner.loan(addressBorrower, aToken);
            // Expect the token to now be owned by the borrower and all checks and balances to be
            // correct
            expect(await this.contract.ownerOf(aToken)).to.equal(addressBorrower);
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressRightfulOwner);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(1);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([1]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([1]);
            // Connect to the contract as the token borrower, and return the token
            const contractAsTokenBorrower = await this.contract.connect(accountBorrower);
            await expect(await contractAsTokenBorrower.returnLoanByBorrower(aToken))
                .to.emit(this.contract, 'LoanReturned').withArgs(addressBorrower, addressRightfulOwner, aToken);
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(aToken)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressRightfulOwner);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(2);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(0);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([]);
        });

        it('shoud not allow an owner to lend a token to themselves', async () => {
            tokenId++;
            // Mint a token
            await contractAsMinter.safeMint(addressRightfulOwner, tokenId);
            // Connect to the contract as the token owner, and try to lend the latest
            // minted token to self, expecting to fail
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            await expect(contractAsRightfulOwner.loan(addressRightfulOwner, tokenId))
                .to.be.revertedWith("ERC721Lending: Lending to self (the current owner's address) is not permitted.");
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(aToken)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressRightfulOwner);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(0);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([]);
        });

        it("shoud not allow an arbitrary account to lend a token they do not own", async () => {
            // Connect to the contract as an arbitrary account (that does not own the previously
            // minted token)
            const contractAsArbitraryAccount = await this.contract.connect(accArbitraryAccount1);
            await expect(contractAsArbitraryAccount.loan(addressBorrower, tokenId))
                .to.be.revertedWith("ERC721Lending: Trying to lend a token that is not owned.");
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(aToken)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressRightfulOwner);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(0);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([]);
        });

        it("shoud not allow a borrower to re-lend the token", async () => {
            tokenId++;
            // Mint a token
            await contractAsMinter.safeMint(addressRightfulOwner, tokenId);
            // Connect to the contract as the token owner, and loan the recently minted token
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            await contractAsRightfulOwner.loan(addressBorrower, tokenId);
            // Expect the token to now be owned by the borrower and all checks and balances to be
            // correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
            // Connect to the contract as the token borrower, and try to re-lend
            // the token, expecting to fail
            const contractAsTokenBorrower = await this.contract.connect(accountBorrower);
            await expect(contractAsTokenBorrower.loan(accArbitraryAccount1.address, tokenId))
                .to.be.revertedWith("ERC721Lending: Trying to lend a token that is already on loan.");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

        it("shoud not allow a borrower to transfer a token that is on loan to them", async () => {
            // Connect to the contract as the token borrower, and try to safeTransferFrom
            // the token (using both version, the one with 3 params, and the one with 4),
            // expecting to fail
            const contractAsTokenBorrower = await this.contract.connect(accountBorrower);
            // @dev - NOTE because safeTransferFrom is an overloaded function, it cannot be called
            // using the usual ethers 'dot' notation. You kind of have to reference the ABI to
            // clarify which version of the function you are intending to call. Below, we call
            // both versions of the functions separately.
            await expect(contractAsTokenBorrower["safeTransferFrom(address,address,uint256)"]
                (addressBorrower, accArbitraryAccount1.address, tokenId))
                .to.be.revertedWith("ERC721Lending: Cannot transfer token on loan.");
            await expect(contractAsTokenBorrower["safeTransferFrom(address,address,uint256,bytes)"]
                (addressBorrower, accArbitraryAccount1.address, tokenId, []))
                .to.be.revertedWith("ERC721Lending: Cannot transfer token on loan.");
            // Also try the regular transferFrom function    
            await expect(contractAsTokenBorrower.transferFrom(addressBorrower, accArbitraryAccount1.address, tokenId))
                .to.be.revertedWith("ERC721Lending: Cannot transfer token on loan.");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

        it("shoud not allow a borrower to burn a token that is on loan to them", async () => {
            // Connect to the contract as the token borrower, and try to burn the token
            const contractAsTokenBorrower = await this.contract.connect(accountBorrower);
            await expect(contractAsTokenBorrower.burn(tokenId))
                .to.be.revertedWith("ERC721Lending: Cannot transfer token on loan.");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

        it("shoud not allow a borrower to reclaim a token that is on loan to them", async () => {
            // Connect to the contract as the token borrower, and try to burn the token
            const contractAsTokenBorrower = await this.contract.connect(accountBorrower);
            await expect(contractAsTokenBorrower.reclaimLoan(tokenId))
                .to.be.revertedWith("ERC721Lending: Only the original/rightful owner can recall a loaned token.");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

        it("shoud not allow an arbitrary account to transfer a token that is on loan", async () => {
            // Connect to the contract as an arbitrary account (that is neither the rightful owner
            // nor the borrower of a token.)
            const contractAsArbitraryAccount = await this.contract.connect(accArbitraryAccount1);
            // @dev - NOTE because safeTransferFrom is an overloaded function, it cannot be called
            // using the usual ethers 'dot' notation. You kind of have to reference the ABI to
            // clarify which version of the function you are intending to call. Below, we call
            // both versions of the functions separately.
            await expect(contractAsArbitraryAccount["safeTransferFrom(address,address,uint256)"]
                (addressBorrower, accArbitraryAccount1.address, tokenId))
                .to.be.revertedWith("ERC721: caller is not token owner nor approved'");
            await expect(contractAsArbitraryAccount["safeTransferFrom(address,address,uint256,bytes)"]
                (addressBorrower, accArbitraryAccount1.address, tokenId, []))
                .to.be.revertedWith("ERC721: caller is not token owner nor approved'");
            // Also try the regular transferFrom function    
            await expect(contractAsArbitraryAccount.transferFrom(addressBorrower, accArbitraryAccount1.address, tokenId))
                .to.be.revertedWith("ERC721: caller is not token owner nor approved'");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

        it("shoud not allow an arbitrary account to burn a token that is on loan", async () => {
            // Connect to the contract as an arbitrary account (that is neither the rightful owner
            // nor the borrower of a token.)
            const contractAsArbitraryAccount = await this.contract.connect(accArbitraryAccount1);
            // Try to burn the token expecting to fail
            await expect(contractAsArbitraryAccount.burn(tokenId))
                .to.be.revertedWith("ERC721: caller is not token owner nor approved'");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

        it("shoud not allow an arbitrary account to reclaim a token that is on loan", async () => {
            // Connect to the contract as an arbitrary account (that is neither the rightful owner
            // nor the borrower of a token.)
            const contractAsArbitraryAccount = await this.contract.connect(accArbitraryAccount1);
            // Try to reclaim the token expecting to fail
            await expect(contractAsArbitraryAccount.reclaimLoan(tokenId))
                .to.be.revertedWith("ERC721Lending: Only the original/rightful owner can recall a loaned token.");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

        it("shoud not allow an arbitrary account to return a token that is on loan", async () => {
            // Connect to the contract as an arbitrary account (that is neither the rightful owner
            // nor the borrower of a token.)
            const contractAsArbitraryAccount = await this.contract.connect(accArbitraryAccount1);
            // Try to return the token expecting to fail
            await expect(contractAsArbitraryAccount.returnLoanByBorrower(tokenId))
                .to.be.revertedWith("ERC721Lending: Only the borrower can return the token.");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

        it("shoud not allow the rightful owner to use returnLoanByBorrower to reclaim a loan", async () => {
            // Connect to the contract as the token's rightful owner, and try to
            // recover the token using the returnLoanByBorrower function, expecting it to fail
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            await expect(contractAsRightfulOwner.returnLoanByBorrower(tokenId))
                .to.be.revertedWith("ERC721Lending: Only the borrower can return the token.");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

        it("shoud not allow the rightful owner to lend a token more than once", async () => {
            // Connect to the contract as the token's rightful owner, and try to
            // re-lend the token again, expecting it to fail
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            await expect(contractAsRightfulOwner.loan(accArbitraryAccount1.address, tokenId))
                .to.be.revertedWith("ERC721Lending: Trying to lend a token that is not owned.");
            // Expect ownership and balances to still be correct
            expect(await this.contract.ownerOf(tokenId)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([2, 1, 3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([4]);
        });

    });


    describe('Ability to Pause Lending', () => {
        let tokenId = 0;
        let token1;
        let token2;
        let token3;
        let token4;
        let contractAsMinter;
        let contractAsPauser;
        let accountRightfulOwner;
        let accountBorrower;
        let addressRightfulOwner;
        let addressBorrower;
        before(async () => {
            this.contract = await deployAMW721();
                this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
                await this.adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
                await this.adminContract.grantRole(role.pauser.hex, this.accounts[account.accPauser.idx].address);
            // Connect to the contract as the minter
            contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            // Connect to the contract as the pauser
            contractAsPauser = await this.contract.connect(this.accounts[account.accPauser.idx]);
            accountRightfulOwner = this.accounts[account.accNoRoles1.idx];
            accountBorrower = this.accounts[account.accNoRoles2.idx];
            addressRightfulOwner = accountRightfulOwner.address;
            addressBorrower = accountBorrower.address;
        });

        it('should allow lending to be paused', async () => {
            tokenId++;
            // Mint some tokens
            token1 = tokenId++;
            await contractAsMinter.safeMint(addressRightfulOwner, token1);
            token2 = tokenId++;
            await contractAsMinter.safeMint(addressRightfulOwner, token2);
            token3 = tokenId++;
            await contractAsMinter.safeMint(addressRightfulOwner, token3);
            // Connect to the contract as the token owner, and lend the first and second tokens
            // that were minted
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            await expect(await contractAsRightfulOwner.loan(addressBorrower, token1))
                .to.emit(this.contract, 'Loan').withArgs(addressRightfulOwner, addressBorrower, token1);
            await expect(await contractAsRightfulOwner.loan(addressBorrower, token2))
                .to.emit(this.contract, 'Loan').withArgs(addressRightfulOwner, addressBorrower, token2);
            // Pause lending
            await expect(await contractAsPauser.pauseLending())
                .to.emit(this.contract, 'LendingPaused').withArgs(this.accounts[account.accPauser.idx].address);
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(token1)).to.equal(addressBorrower);
            expect(await this.contract.ownerOf(token2)).to.equal(addressBorrower);
            expect(await this.contract.ownerOf(token3)).to.equal(addressRightfulOwner);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(1);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(2);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([3]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([1, 2]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([1, 2]);
        });

        it('should not allow pausing loans when they are already paused', async () => {
            // Try to pause lending again, expecting it to fail
            await expect(contractAsPauser.pauseLending())
                .to.be.revertedWith("ERC721Lending: Lending of tokens is currently paused.");
        });

        it('should not allow new loans to be made when lending is paused', async () => {
            // Connect to the contract as the token owner, and try to lend the third
            // token that was minted (prior to the lending being set to the paused state)
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            await expect(contractAsRightfulOwner.loan(addressBorrower, token3))
                .to.be.revertedWith("ERC721Lending: Lending of tokens is currently paused.");
            // Mint another token, and try to lend this one, which is being minted WHILE the
            // contract is in the paused state
            token4 = tokenId++;
            await contractAsMinter.safeMint(addressRightfulOwner, token4);
            await expect(contractAsRightfulOwner.loan(addressBorrower, token4))
                .to.be.revertedWith("ERC721Lending: Lending of tokens is currently paused.");
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(token1)).to.equal(addressBorrower);
            expect(await this.contract.ownerOf(token2)).to.equal(addressBorrower);
            expect(await this.contract.ownerOf(token3)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(token4)).to.equal(addressRightfulOwner);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(2);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(2);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([3, 4]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([1, 2]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([1, 2]);
        });

        it('should allow an owner to reclaim a loan when lending is paused', async () => {
            // Connect to the contract as the rightful token owner, and try to reclaim the second token
            // that was lent, expecting it to succeed
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            await expect(contractAsRightfulOwner.reclaimLoan(token2))
                .to.emit(this.contract, 'LoanReclaimed').withArgs(addressRightfulOwner, addressBorrower, token2);
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(token1)).to.equal(addressBorrower);
            expect(await this.contract.ownerOf(token2)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(token3)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(token4)).to.equal(addressRightfulOwner);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(3);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(1);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([3, 4, 2]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([1]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([1]);
        });

        it('should allow a borrower to return a loan when lending is paused', async () => {
            // Connect to the contract as the borrower, and try to return the first token
            // that was lent, expecting it to succeed
            const contractAsTokenBorrower = await this.contract.connect(accountBorrower);
            await expect(contractAsTokenBorrower.returnLoanByBorrower(token1))
                .to.emit(this.contract, 'LoanReturned').withArgs(addressBorrower, addressRightfulOwner, token1);
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(token1)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(token2)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(token3)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(token4)).to.equal(addressRightfulOwner);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(4);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(0);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([3, 4, 2, 1]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([]);
        });

        it('should allow UNpausing loans when they are paused', async () => {
            // Try to pause lending again, expecting it to fail
            await expect(contractAsPauser.unpauseLending())
                .to.emit(this.contract, 'LendingUnpaused').withArgs(this.accounts[account.accPauser.idx].address);
        });

        it('should not allow unpausing loans when they are already unpaused', async () => {
            // Try to pause lending again, expecting it to fail
            await expect(contractAsPauser.unpauseLending())
                .to.be.revertedWith("ERC721Lending: Lending of tokens is already in unpaused state.");
        });

        it('should allow lending to be resumed after lending is unpaused', async () => {
            // Connect to the contract as the token owner, and lend the first and fourth tokens
            // that were minted
            const contractAsRightfulOwner = await this.contract.connect(accountRightfulOwner);
            await expect(await contractAsRightfulOwner.loan(addressBorrower, token1))
                .to.emit(this.contract, 'Loan').withArgs(addressRightfulOwner, addressBorrower, token1);
            await expect(await contractAsRightfulOwner.loan(addressBorrower, token4))
                .to.emit(this.contract, 'Loan').withArgs(addressRightfulOwner, addressBorrower, token4);
            // Expect ownership and balances to be correct
            expect(await this.contract.ownerOf(token1)).to.equal(addressBorrower);
            expect(await this.contract.ownerOf(token2)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(token3)).to.equal(addressRightfulOwner);
            expect(await this.contract.ownerOf(token4)).to.equal(addressBorrower);
            expect(await this.contract.balanceOf(addressRightfulOwner)).to.equal(2);
            expect(await this.contract.balanceOf(addressBorrower)).to.equal(2);
            // @dev - NOTE the use of chai's 'eql' operator to 'deep' compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()))
                .to.eql([3, 2]);
            expect((await this.contract.loanedTokensByAddress(addressRightfulOwner)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql([1, 4]);
            expect((await this.contract.ownedTokensByAddress(addressBorrower)).map(bigNum => bigNum.toNumber()))
                .to.eql([1, 4]);
        });


    });

    describe('Contract and lending enumeration', () => {
        const maxSupply = 250;
        let contractAsMinter;
        const numTokensToBatchMint = 73;
        let batchNumber = 0;
        const transactions = [];
        firstTokenIdOffset = 1000;
        let tokenIndex;
        let idxLender1;
        let accLender1;
        let idxLender2;
        let accLender2;
        let idxLender3;
        let accLender3;
        // arrays that will track off-chain the tokens owned by the lenders (which include tokens that
        // have been lent TO them, and does NOT include tokens that have relinquised to a loan).
        const tokensLender1Owns = [];
        const tokensLender2Owns = [];
        const tokensLender3Owns = [];
        let startingBatchIdOfOwner1;
        let startingBatchIdOfOwner2;
        let startingBatchIdOfOwner3;
        // let numTokensOwner1DidNotLend;
        // let numTokensOwner2DidNotLend;
        // let numTokensOwner3DidNotLend;
        let numTokensOwner2burned = 0;
        const tokensLoanedByLender1 = [];
        const tokensLoanedByLender2 = [];
        const tokensLoanedByLender3 = [];
        let idxArbitraryAccount1 = 13;
        let accArbitraryAccount1;
        let idxArbitraryAccount2 = 14;
        let accArbitraryAccount2;
        let idxArbitraryAccount3 = 15;
        let accArbitraryAccount3;
        const tokensOwnedByArbitraryAccount1 = [];
        const tokensOwnedByArbitraryAccount2 = [];
        const tokensOwnedByArbitraryAccount3 = [];
        tokensMinted = 0;
        before(async () => {
            this.contract = await deployAMW721();
                this.adminContract = this.contract.connect(this.accounts[account.accDefaultAdmin.idx]);
                await this.adminContract.grantRole(role.minter.hex, this.accounts[account.accMinter.idx].address);
            // Connect to the contract as the minter
            contractAsMinter = await this.contract.connect(this.accounts[account.accMinter.idx]);
            idxLender1 = account.accNoRoles1.idx;
            accLender1 = this.accounts[idxLender1];
            idxLender2 = account.accNoRoles2.idx;
            accLender2 = this.accounts[idxLender2];
            idxLender3 = account.accNoRoles2.idx;
            // We'll make the 3rd lender an arbitrary index from the addresses available
            idxLender3 = 11;
            accLender3 = this.accounts[idxLender3];
            // Some arbitrary accounts we'll track loans to
            accArbitraryAccount1 = this.accounts[idxArbitraryAccount1];
            accArbitraryAccount2 = this.accounts[idxArbitraryAccount2];
            accArbitraryAccount3 = this.accounts[idxArbitraryAccount3];
        });

        it('should allow many tokens to be minted to many owners', async () => {
            // The loops below queue actions into a batch of transactions,
            // which get executed after the loop.

            // This loop mints a number of tokens, round robin to several addresses. This batch
            // of minting doesn't serve a specific purpose other than to set the stage
            // that there are a bunch of tokens minted, with a bunch of owners.
            batchNumber++;
            startAt = firstTokenIdOffset + 1;
            limit = firstTokenIdOffset + (numTokensToBatchMint*batchNumber);
            for(tokenIndex = startAt; tokenIndex<=limit; tokenIndex++){
                if (tokensMinted >= maxSupply) { break; }
                // The 'i%20' mints tokens round robin to 20 addresses (as the test blockchain
                // being used provides 20 addresses).
                if (tokenIndex%20 === idxLender1) { tokensLender1Owns.push(tokenIndex); }
                if (tokenIndex%20 === idxLender2) { tokensLender2Owns.push(tokenIndex); }
                if (tokenIndex%20 === idxLender3) { tokensLender3Owns.push(tokenIndex); }
                if (tokenIndex%20 === idxArbitraryAccount1) { tokensOwnedByArbitraryAccount1.push(tokenIndex); }
                if (tokenIndex%20 === idxArbitraryAccount2) { tokensOwnedByArbitraryAccount2.push(tokenIndex); }
                if (tokenIndex%20 === idxArbitraryAccount3) { tokensOwnedByArbitraryAccount3.push(tokenIndex); }
                transactions.push(contractAsMinter.safeMint(this.accounts[tokenIndex%20].address, tokenIndex));
                tokensMinted++;
            }
            await Promise.all(transactions);
            // reset the array
            transactions.length =  0;

            // This loop mints a number of tokens to an owner. This prepares the state of
            // contract for that owner to be able to do some lending.
            batchNumber++;
            startingBatchIdOfOwner1 = tokenIndex;
            limit = firstTokenIdOffset + (numTokensToBatchMint*batchNumber);
            for(tokenIndex = startingBatchIdOfOwner1; tokenIndex<=limit; tokenIndex++){
                if (tokensMinted >= maxSupply) { break; }
                // The 'i%20' mints tokens rount robin to 20 addresses (as the test blockchain
                // being used provides 20 addresses).
                tokensLender1Owns.push(tokenIndex)
                transactions.push(contractAsMinter.safeMint(accLender1.address, tokenIndex));
                tokensMinted++;
            }
            await Promise.all(transactions);
            // reset the array
            transactions.length =  0;

            // This loop mints a number of tokens to ANOTHER owner. This prepares the state of
            // contract for that owner to be able to do some lending.
            batchNumber++;
            startingBatchIdOfOwner2 = tokenIndex;
            limit = firstTokenIdOffset + (numTokensToBatchMint*batchNumber);
            for(tokenIndex = startingBatchIdOfOwner2; tokenIndex<=limit; tokenIndex++){
                if (tokensMinted >= maxSupply) { break; }
                // The 'i%20' mints tokens rount robin to 20 addresses (as the test blockchain
                // being used provides 20 addresses).
                tokensLender2Owns.push(tokenIndex)
                transactions.push(contractAsMinter.safeMint(accLender2.address, tokenIndex));
                tokensMinted++;
            }
            await Promise.all(transactions);
            // reset the array
            transactions.length =  0;

            // This loop mints a number of tokens to yet ANOTHER owner. This prepares the state of
            // contract for that owner to be able to do some lending.
            batchNumber++;
            startingBatchIdOfOwner3 = tokenIndex;
            limit = firstTokenIdOffset + (numTokensToBatchMint*batchNumber);
            for(tokenIndex = startingBatchIdOfOwner3; tokenIndex<=limit; tokenIndex++){
                if (tokensMinted >= maxSupply) { break; }
                // The 'i%20' mints tokens rount robin to 20 addresses (as the test blockchain
                // being used provides 20 addresses).
                tokensLender3Owns.push(tokenIndex)
                transactions.push(contractAsMinter.safeMint(accLender3.address, tokenIndex));
                tokensMinted++;
            }
            await Promise.all(transactions);
            // reset the array
            transactions.length =  0;

            // Check that the contract variables numTokensMinted and totalSupply are correct
            expect(await this.contract.numTokensMinted()).to.equal(tokensMinted);
            expect(await this.contract.totalSupply()).to.equal(tokensMinted);
        });

        it('should allow some owners to lend many of their tokens', async () => {
            // Connect to the contract as the (first) rightful owner of a bunch of tokens
            contractAsLender1 = await this.contract.connect(accLender1);
            // // Track the number of tokens the owner skips from lending because they own them
            // numTokensOwner1DidNotLend = 0;
            // In this loop the rightful owner of a bunch of tokens lends them out to many
            // addressess
            for(i = startingBatchIdOfOwner1; i<startingBatchIdOfOwner1+numTokensToBatchMint; i++){
                if (i > firstTokenIdOffset + maxSupply) { break; }
                // We need to check that the current tokenId (represented by 'i' is)
                // not owned by the lender, because an owner is not allowed to lend to self.
                if (i%20 !== idxLender1) {
                    // The 'i%20' lends tokens rount robin to 20 addresses (as the test blockchain
                    // being used provides 20 addresses).
                    transactions.push(contractAsLender1.loan(this.accounts[i%20].address, i));
                    // Remove the token from the array being used off-chain to track Lender1's ownership
                    tokensLender1Owns.splice(tokensLender1Owns.indexOf(i), 1);
                    // Tracking off-chain the loans made by Lender1
                    tokensLoanedByLender1.push(i)
                    // Tracking off-chain the loans made to some arbitrarily chosen accounts
                    if (i%20 === idxArbitraryAccount1) { tokensOwnedByArbitraryAccount1.push(i); }
                    if (i%20 === idxArbitraryAccount2) { tokensOwnedByArbitraryAccount2.push(i); }
                    if (i%20 === idxArbitraryAccount3) { tokensOwnedByArbitraryAccount3.push(i); }
                    // We are also tracking off-chain the tokens owned by other lenders, so if Lender1
                    // lends to them, we need to include that in their ownership
                    if (i%20 === idxLender2) { tokensLender2Owns.push(i) }
                    if (i%20 === idxLender3) { tokensLender3Owns.push(i) }
                } //else { numTokensOwner1DidNotLend++; }
            }
            await Promise.all(transactions);
            // reset the array
            transactions.length =  0;

            // Connect to the contract as the (second) rightful owner of a bunch of tokens
            contractAsLender2 = await this.contract.connect(accLender2);
            // // Track the number of tokens the owner skips from lending because they own them
            // numTokensOwner2DidNotLend = 0;
            // In this loop the rightful owner of a bunch of tokens lends them out to many
            // addressess, or burns
            for(i = startingBatchIdOfOwner2; i<startingBatchIdOfOwner2 + numTokensToBatchMint; i++){
                if (i > firstTokenIdOffset + maxSupply) { break; }
                // We need to check that the current tokenId (represented by 'i' is)
                // not owned by the lender, because an owner is not allowed to lend to self.
                if (i%20 !== idxLender2) {
                    // In order to throw something 'a bit different' at the tests, we'll make this
                    // loop different from the loop of the other two lenders, by making it so that
                    // every other iteration of the loop the lender either lends one of their tokens,
                    // or burns one of their tokens.
                    if (i%2 === 0) {
                        // The 'i%20' lends tokens rount robin to 20 addresses (as the test blockchain
                        // being used provides 20 addresses).
                        transactions.push(contractAsLender2.loan(this.accounts[i%20].address, i));
                        // Remove the token from the array being used off-chain to track Lender2's ownership
                        tokensLender2Owns.splice(tokensLender2Owns.indexOf(i), 1);
                        // Tracking off-chain the loans made by Lender2
                        tokensLoanedByLender2.push(i)
                        // Tracking off-chain the loans made to some arbitrarily chosen accounts
                        if (i%20 === idxArbitraryAccount1) { tokensOwnedByArbitraryAccount1.push(i); }
                        if (i%20 === idxArbitraryAccount2) { tokensOwnedByArbitraryAccount2.push(i); }
                        if (i%20 === idxArbitraryAccount3) { tokensOwnedByArbitraryAccount3.push(i); }
                        // We are also tracking off-chain the tokens owned by other lenders, so if Lender2
                        // lends to them, we need to include that in their ownership
                        if (i%20 === idxLender1) { tokensLender1Owns.push(i) }
                        if (i%20 === idxLender3) { tokensLender3Owns.push(i) }
                    } else {
                        transactions.push(contractAsLender2.burn(i));
                        // Remove the token from the array being used off-chain to track Owner2's ownership
                        tokensLender2Owns.splice(tokensLender2Owns.indexOf(i), 1);
                        numTokensOwner2burned++;
                    }
                    
                } //else { numTokensOwner2DidNotLend++; }
            }
            await Promise.all(transactions);
            // reset the array
            transactions.length =  0;

            // Connect to the contract as the (third) rightful owner of a bunch of tokens
            contractAsLender3 = await this.contract.connect(accLender3);
            // // Track the number of tokens the owner skips from lending because they own them
            // numTokensOwner3DidNotLend = 0;
            // In this loop the rightful owner of a bunch of tokens lends them out to many
            // addressess
            for(i = startingBatchIdOfOwner3; i<startingBatchIdOfOwner3 + numTokensToBatchMint; i++){
                if (i > firstTokenIdOffset + maxSupply) { break; }
                // We need to check that the current tokenId (represented by 'i' is)
                // not owned by the lender, because an owner is not allowed to lend to self.
                if (i%20 !== idxLender3) {
                    // The 'i%20' lends tokens rount robin to 20 addresses (as the test blockchain
                    // being used provides 20 addresses).
                    transactions.push(contractAsLender3.loan(this.accounts[i%20].address, i));
                    // Remove the token from the array being used off-chain to track Lender3's ownership
                    tokensLender3Owns.splice(tokensLender3Owns.indexOf(i), 1);
                    // Tracking off-chain the loans made by Lender3
                    tokensLoanedByLender3.push(i)
                    // Tracking off-chain the loans made to some arbitrarily chosen accounts
                    if (i%20 === idxArbitraryAccount1) { tokensOwnedByArbitraryAccount1.push(i); }
                    if (i%20 === idxArbitraryAccount2) { tokensOwnedByArbitraryAccount2.push(i); }
                    if (i%20 === idxArbitraryAccount3) { tokensOwnedByArbitraryAccount3.push(i); }
                    // We are also tracking off-chain the tokens owned by other lenders, so if Lender3
                    // lends to them, we need to include that in their ownership
                    if (i%20 === idxLender1) { tokensLender1Owns.push(i) }
                    if (i%20 === idxLender2) { tokensLender2Owns.push(i) }
                } //else { numTokensOwner3DidNotLend++; }
            }
            await Promise.all(transactions);
            // reset the array
            transactions.length =  0;

            // Check that the contract variables numTokensMinted and totalSupply are still correct
            expect(await this.contract.numTokensMinted()).to.equal(tokensMinted);
            expect(await this.contract.totalSupply()).to.equal(tokensMinted - numTokensOwner2burned);
            // Check totalLoaned we are tracking off-chain
            expect(await this.contract.totalLoaned()).to.equal(
                tokensLoanedByLender1.length + tokensLoanedByLender2.length + tokensLoanedByLender3.length);
            // Check the balanceOf and loanedBalanceOf the rightful owners are correct;
            expect(await this.contract.balanceOf(accLender1.address)).to.equal(tokensLender1Owns.length);
            expect(await this.contract.loanedBalanceOf(accLender1.address)).to.equal(tokensLoanedByLender1.length);
            expect(await this.contract.balanceOf(accLender2.address)).to.equal(tokensLender2Owns.length);
            expect(await this.contract.loanedBalanceOf(accLender2.address)).to.equal(tokensLoanedByLender2.length);
            expect(await this.contract.balanceOf(accLender3.address)).to.equal(tokensLender3Owns.length);
            expect(await this.contract.loanedBalanceOf(accLender3.address)).to.equal(tokensLoanedByLender3.length);
            // Check the right ownership list and loans list of each lender. Ethers returns the answer from
            // the contract as a big number, which needs to be mapped to a regular javascript integer
            // @dev - NOTE the use of chai's 'eql' operator to compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(accLender1.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLender1Owns.sort());
            expect((await this.contract.loanedTokensByAddress(accLender1.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLoanedByLender1.sort());
            expect((await this.contract.ownedTokensByAddress(accLender2.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLender2Owns.sort());
            expect((await this.contract.loanedTokensByAddress(accLender2.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLoanedByLender2.sort());
            expect((await this.contract.ownedTokensByAddress(accLender3.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLender3Owns.sort());
            expect((await this.contract.loanedTokensByAddress(accLender3.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLoanedByLender3.sort());
            // Also check the balances and listings of the addresses the tokens were lent to (the borrowers)
            expect(await this.contract.balanceOf(accArbitraryAccount1.address)).to.equal(tokensOwnedByArbitraryAccount1.length);
            expect((await this.contract.ownedTokensByAddress(accArbitraryAccount1.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensOwnedByArbitraryAccount1.sort());
            expect(await this.contract.balanceOf(accArbitraryAccount2.address)).to.equal(tokensOwnedByArbitraryAccount2.length);
            expect((await this.contract.ownedTokensByAddress(accArbitraryAccount2.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensOwnedByArbitraryAccount2.sort());
            expect(await this.contract.balanceOf(accArbitraryAccount3.address)).to.equal(tokensOwnedByArbitraryAccount3.length);
            expect((await this.contract.ownedTokensByAddress(accArbitraryAccount3.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensOwnedByArbitraryAccount3.sort());
        });

        it('should allow an owner to recall loans', async () => {
            // Connect to the contract as the (first) rightful owner of a bunch of tokens
            contractAsLender1 = await this.contract.connect(accLender1);
            // In this loop the rightful owner of a bunch of tokens that they had lent out,
            // recalls them back to their address ownership
            for(i = startingBatchIdOfOwner1; i<startingBatchIdOfOwner1+numTokensToBatchMint; i++){
                if (i > firstTokenIdOffset + maxSupply) { break; }
                // We need to check that the current tokenId (represented by 'i' is)
                // not mod 20, because it would not have been able to lend a token to self,
                // so we should not attempt to recall it
                if (i%20 !== idxLender1) {
                    // The 'i%20' recalls tokens rount robin to 20 addresses (as the test blockchain
                    // being used provides 20 addresses) - same as they were lent out previously.
                    transactions.push(contractAsLender1.reclaimLoan(i));
                    // Add the token to the array being used off-chain to track Lender1's ownership
                    tokensLender1Owns.push(i);
                    // Tracking off-chain the loans made by Lender1 (here we remove the loan)
                    tokensLoanedByLender1.splice(tokensLoanedByLender1.indexOf(i), 1);
                    // Tracking off-chain the loans made to an arbitrarily chosen accounts (here)
                    // we remove the tokens from the borrower's ownership
                    if (i%20 === idxArbitraryAccount1) {
                        tokensOwnedByArbitraryAccount1.splice(tokensOwnedByArbitraryAccount1.indexOf(i), 1);
                    }
                    if (i%20 === idxArbitraryAccount2) {
                        tokensOwnedByArbitraryAccount2.splice(tokensOwnedByArbitraryAccount2.indexOf(i), 1);
                    }
                    if (i%20 === idxArbitraryAccount3) {
                        tokensOwnedByArbitraryAccount3.splice(tokensOwnedByArbitraryAccount3.indexOf(i), 1);
                    }
                    // We are also tracking off-chain the tokens owned by other lenders, so if Lender1
                    // lent to them, we need to remove the recalled token from their ownership
                    if (i%20 === idxLender2) { tokensLender2Owns.splice(tokensLender2Owns.indexOf(i), 1) }
                    if (i%20 === idxLender3) { tokensLender3Owns.splice(tokensLender3Owns.indexOf(i), 1) }
                }
            }
            await Promise.all(transactions);
            // reset the array
            transactions.length =  0;

            // Check that the contract variables numTokensMinted and totalSupply are still correct
            expect(await this.contract.numTokensMinted()).to.equal(tokensMinted);
            expect(await this.contract.totalSupply()).to.equal(tokensMinted - numTokensOwner2burned);
            // Check totalLoaned we are tracking off-chain
            expect(await this.contract.totalLoaned()).to.equal(
                tokensLoanedByLender1.length + tokensLoanedByLender2.length + tokensLoanedByLender3.length);
            // Check the balanceOf and loanedBalanceOf the rightful owners are correct;
            expect(await this.contract.balanceOf(accLender1.address)).to.equal(tokensLender1Owns.length);
            expect(await this.contract.loanedBalanceOf(accLender1.address)).to.equal(tokensLoanedByLender1.length);
            expect(await this.contract.balanceOf(accLender2.address)).to.equal(tokensLender2Owns.length);
            expect(await this.contract.loanedBalanceOf(accLender2.address)).to.equal(tokensLoanedByLender2.length);
            expect(await this.contract.balanceOf(accLender3.address)).to.equal(tokensLender3Owns.length);
            expect(await this.contract.loanedBalanceOf(accLender3.address)).to.equal(tokensLoanedByLender3.length);
            // Check the right ownership list and loans list of each lender. Ethers returns the answer from
            // the contract as a big number, which needs to be mapped to a regular javascript integer
            // @dev - NOTE the use of chai's 'eql' operator to compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(accLender1.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLender1Owns.sort());
            expect((await this.contract.loanedTokensByAddress(accLender1.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLoanedByLender1.sort());
            expect((await this.contract.ownedTokensByAddress(accLender2.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLender2Owns.sort());
            expect((await this.contract.loanedTokensByAddress(accLender2.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLoanedByLender2.sort());
            expect((await this.contract.ownedTokensByAddress(accLender3.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLender3Owns.sort());
            expect((await this.contract.loanedTokensByAddress(accLender3.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLoanedByLender3.sort());
            // Also check the balances and listings of the addresses the tokens were lent to (the borrowers)
            expect(await this.contract.balanceOf(accArbitraryAccount1.address)).to.equal(tokensOwnedByArbitraryAccount1.length);
            expect((await this.contract.ownedTokensByAddress(accArbitraryAccount1.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensOwnedByArbitraryAccount1.sort());
            expect(await this.contract.balanceOf(accArbitraryAccount2.address)).to.equal(tokensOwnedByArbitraryAccount2.length);
            expect((await this.contract.ownedTokensByAddress(accArbitraryAccount2.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensOwnedByArbitraryAccount2.sort());
            expect(await this.contract.balanceOf(accArbitraryAccount3.address)).to.equal(tokensOwnedByArbitraryAccount3.length);
            expect((await this.contract.ownedTokensByAddress(accArbitraryAccount3.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensOwnedByArbitraryAccount3.sort());
        });

        it('should allow a borrower to return tokens lent to them', async () => {
            // Connect to the contract as one of the arbitrary accounts that had tokens
            // lent to them
            contractAsBorrower1 = await this.contract.connect(accArbitraryAccount1);
            
            // In order to correctly update the arrays we are using to track, off-chain, the lending
            // and ownerships, we need to run through two loops checking fo the same conditions that were
            // used previously to make the loans by owners 2 and 3 to the arbitrary borrower 1 (we don't
            // need to do it for owner 1, because they already recalled all their loans above.)
            for(i = startingBatchIdOfOwner2; i<startingBatchIdOfOwner2 + numTokensToBatchMint; i++) {
                if (i > firstTokenIdOffset + maxSupply) { break; }
                // We need to check that the current tokenId (represented by 'i' is)
                // not mod 20, because it would not have been able to lend a token to self,
                // so the case can be ignored
                if (i%20 !== idxLender2) {
                    // In oreder to throw something 'a bit different' at the tests, for owner two,
                    // only half the tokens were lent - the rest were burne, so here we do the same
                    // check before trying to return loans.
                    if (i%2 === 0) {
                        // now we can finally check for tokens that, based on mod 20, were lent to
                        // the arbitrary account
                        if (i%20 === idxArbitraryAccount1) {
                            // make the call to the smart contract to return the loan
                            transactions.push(contractAsBorrower1.returnLoanByBorrower(i));
                            // update our off-chain tracking arrays
                            tokensOwnedByArbitraryAccount1.splice(tokensOwnedByArbitraryAccount1.indexOf(i), 1);
                            tokensLoanedByLender2.splice(tokensLoanedByLender2.indexOf(i), 1);
                            tokensLender2Owns.push(i);
                        }
                    }
                    
                }
            }
            // The lool for owner 3 is a little bit simpler, because owner 3 did not burn any tokens, they
            // only lent
            for(i = startingBatchIdOfOwner3; i<startingBatchIdOfOwner3 + numTokensToBatchMint; i++) {
                if (i > firstTokenIdOffset + maxSupply) { break; }
                // We need to check that the current tokenId (represented by 'i' is)
                // not mod 20, because it would not have been able to lend a token to self,
                // so the case can be ignored
                if (i%20 !== idxLender3) {
                    // now we can finally check for tokens that, based on mod 20, were lent to
                    // the arbitrary account
                    if (i%20 === idxArbitraryAccount1) {
                        // make the call to the smart contract to return the loan
                        transactions.push(contractAsBorrower1.returnLoanByBorrower(i));
                        // update our off-chain tracking arrays
                        tokensOwnedByArbitraryAccount1.splice(tokensOwnedByArbitraryAccount1.indexOf(i), 1);
                        tokensLoanedByLender3.splice(tokensLoanedByLender3.indexOf(i), 1);
                        tokensLender3Owns.push(i);
                    }
                }
            }
            await Promise.all(transactions);
            // reset the array
            transactions.length =  0;

            // Check that the contract variables numTokensMinted and totalSupply are still correct
            expect(await this.contract.numTokensMinted()).to.equal(tokensMinted);
            expect(await this.contract.totalSupply()).to.equal(tokensMinted - numTokensOwner2burned);
            // Check totalLoaned we are tracking off-chain
            expect(await this.contract.totalLoaned()).to.equal(
                tokensLoanedByLender1.length + tokensLoanedByLender2.length + tokensLoanedByLender3.length);
            // Check the balanceOf and loanedBalanceOf the rightful owners are correct;
            expect(await this.contract.balanceOf(accLender1.address)).to.equal(tokensLender1Owns.length);
            expect(await this.contract.loanedBalanceOf(accLender1.address)).to.equal(tokensLoanedByLender1.length);
            expect(await this.contract.balanceOf(accLender2.address)).to.equal(tokensLender2Owns.length);
            expect(await this.contract.loanedBalanceOf(accLender2.address)).to.equal(tokensLoanedByLender2.length);
            expect(await this.contract.balanceOf(accLender3.address)).to.equal(tokensLender3Owns.length);
            expect(await this.contract.loanedBalanceOf(accLender3.address)).to.equal(tokensLoanedByLender3.length);
            // Check the right ownership list and loans list of each lender. Ethers returns the answer from
            // the contract as a big number, which needs to be mapped to a regular javascript integer
            // @dev - NOTE the use of chai's 'eql' operator to compare the arrays, rather than the usual 'equal'
            expect((await this.contract.ownedTokensByAddress(accLender1.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLender1Owns.sort());
            expect((await this.contract.loanedTokensByAddress(accLender1.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLoanedByLender1.sort());
            expect((await this.contract.ownedTokensByAddress(accLender2.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLender2Owns.sort());
            expect((await this.contract.loanedTokensByAddress(accLender2.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLoanedByLender2.sort());
            expect((await this.contract.ownedTokensByAddress(accLender3.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLender3Owns.sort());
            expect((await this.contract.loanedTokensByAddress(accLender3.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensLoanedByLender3.sort());
            // Also check the balances and listings of the addresses the tokens were lent to (the borrowers)
            expect(await this.contract.balanceOf(accArbitraryAccount1.address)).to.equal(tokensOwnedByArbitraryAccount1.length);
            expect((await this.contract.ownedTokensByAddress(accArbitraryAccount1.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensOwnedByArbitraryAccount1.sort());
            expect(await this.contract.balanceOf(accArbitraryAccount2.address)).to.equal(tokensOwnedByArbitraryAccount2.length);
            expect((await this.contract.ownedTokensByAddress(accArbitraryAccount2.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensOwnedByArbitraryAccount2.sort());
            expect(await this.contract.balanceOf(accArbitraryAccount3.address)).to.equal(tokensOwnedByArbitraryAccount3.length);
            expect((await this.contract.ownedTokensByAddress(accArbitraryAccount3.address)).map(bigNum => bigNum.toNumber()).sort())
                .to.eql(tokensOwnedByArbitraryAccount3.sort());
        });
    });

});
