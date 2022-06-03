const { expect, use } = require('chai');
const { ethers } = require('hardhat');
const { utils } = ethers;

// hardhat test was not letting me use chai's 'revertedWith' until I added
// the two lines below.
const { solidity } = require('ethereum-waffle');
use(solidity)


require('dotenv').config();
const { CONTRACT_NAME, CONTRACT_SYMBOL, INITIAL_BASE_TOKEN_URI, INITIAL_CONTRACT_URI } = process.env;

// Below are a set of declarations that help clarify what each account may be used for during the unit tests
const idxRoleAdmin = 0;
const idxRoleMinter = 1;
const idxRoleNone1 = 2;
const idxRoleNone2 = 3;
const idxRolePause = 4;
const idxRoleRoyalty = 5;
const idxRoleMetaDataUpdater = 6;
const idxRoleMetaDataFreezer = 7;
const idxRoleNewAdmin = 8;

const nullAddress = '0x0000000000000000000000000000000000000000'
const roleAsHexADMIN = '0x0000000000000000000000000000000000000000000000000000000000000000';
const roleAsHexMinter = utils.keccak256(utils.toUtf8Bytes('ROLE_MINTER'));
const roleAsHexPauser = utils.keccak256(utils.toUtf8Bytes('ROLE_PAUSER'));
const roleAsHexRoyaltyManager = utils.keccak256(utils.toUtf8Bytes('ROLE_ROYALTY_SETTING'));
const roleAsHexMetaDataUpdater = utils.keccak256(utils.toUtf8Bytes('ROLE_METADATA_UPDATER'));
const roleAsHexMetaDataFreezer = utils.keccak256(utils.toUtf8Bytes('ROLE_METADATA_FREEZER'));

const roleIdxHexPairs = [[idxRoleAdmin, roleAsHexADMIN],
                        [idxRoleMinter, roleAsHexMinter],
                        [idxRolePause, roleAsHexPauser],
                        [idxRoleRoyalty, roleAsHexRoyaltyManager],
                        [idxRoleMetaDataUpdater, roleAsHexMetaDataUpdater],
                        [idxRoleMetaDataFreezer, roleAsHexMetaDataFreezer],
                      ];

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

    const deployedContractWithoutSigner = new ethers.Contract(address , abi, provider);
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
        expect(await this.contract.ROLE_MINTER()).to.equal(roleAsHexMinter);
        await this.contract.grantRole(roleAsHexMinter, this.accounts[idxRoleMinter].address)
                            .catch(error => expect(error.message).to.equal('sending a transaction requires a signer (operation="sendTransaction", code=UNSUPPORTED_OPERATION, version=contracts/5.6.2)'));
        });
    });


    // describe('Safe Mint', () => {
    //     let tokenId = 0;
    //     before(async () => {
    //         this.contract = await deployAMW721();
    //         const contractAsAdmin = await this.contract.connect(this.accounts[idxRoleAdmin]);
    //         await contractAsAdmin.grantRole(roleAsHexMinter, this.accounts[idxRoleMinter].address);
    //     });

    //     it('should allow an address with the ROLE_MINTER to mint a token', async () => {
    //         tokenId++;
    //         // Connect to the contract as the minter
    //         const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
    //         // Mint a token, sending it to an address that has no roles
    //         await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
    //         // Expect the contract to correctly reply with the correct newly minted owner
    //         // of the tokenId
    //         await expect(await this.contract.ownerOf(tokenId)).to.equal(this.accounts[idxRoleNone1].address);
    //     });

    //     it('should not allow duplicate minting (of the same tokenId twice)', async () => {
    //         tokenId++;
    //         // Connect to the contract as the minter
    //         const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
    //         // Mint a token, sending it to an address that has no roles
    //         await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
    //         // Try to mint the same token (with the same Id) again
    //         await expect(contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId))
    //               .to.be.revertedWith('ERC721: token already minted');
    //       });

    //     it('should not allow an address without the ROLE_MINTER to mint a token', async () => {
    //         tokenId++;
    //         // Connect to the contract wihtout any particular role
    //         const contractNoRole = await this.contract.connect(this.accounts[idxRoleNone1])
    //         // Try to mint a token, with a valid tokenId (not ever minted before), but connected to
    //         // the contract using an account that hasn't been granted the minting role.
    //         await expect(contractNoRole.safeMint(this.accounts[idxRoleNone1].address, tokenId))
    //                 .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleNone1].address, roleAsHexMinter));
    //     });
    // });


    // describe('Token tranfers', () => {
    //     let tokenId = 0;
    //     before(async () => {
    //         this.contract = await deployAMW721();
    //         const adminContract = this.contract.connect(this.accounts[idxRoleAdmin]);
    //         await adminContract.grantRole(roleAsHexMinter, this.accounts[idxRoleMinter].address);
    //         await adminContract.grantRole(roleAsHexPauser, this.accounts[idxRolePause].address);
    //     });
    
    //     it('should allow a token holder to tranfer their token when not paused', async () => {
    //         tokenId++;
    //         // Connect to the contract as the minter
    //         const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
    //         // Mint a token, sending it to an address that has no roles
    //         await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
    //         // Connect to the contract wihtout any particular role
    //         const contractNoRole = await this.contract.connect(this.accounts[idxRoleNone1])
    //         await expect(contractNoRole.transferFrom(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId))
    //             .to.emit(this.contract, 'Transfer')
    //             .withArgs(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId);
    //     });
    
    //     it('should not allow an address to tranfer a token they do not own when not paused', async () => {
    //         tokenId++;
    //         // Connect to the contract as the minter
    //         const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
    //         // Mint a token, sending it to an address that has no roles
    //         await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
    //         // Connect to the contract wihtout any particular role, and NOT as the token owner.
    //         // In this case, and address is trying to transfer to itself a token it does not own.
    //         const contractNoRole = await this.contract.connect(this.accounts[idxRoleNone2])
    //         await expect(contractNoRole.transferFrom(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId))
    //             .to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
    //     });
    
    //     it('should not allow a token holder to tranfer their token when paused', async () => {
    //         tokenId++;
    //         // Connect to the contract as the minter
    //         const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
    //         // Mint a token, sending it to an address that has no roles
    //         await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
    //         // Connect to the contract as the pauser
    //         const contractAsPauser = await this.contract.connect(this.accounts[idxRolePause])
    //         // Pause the contract
    //         await contractAsPauser.pause();
    //         // Connect to the contract wihtout any particular role, but as the rightful owner of the
    //         // token that was minted.
    //         const contractNoRole = await this.contract.connect(this.accounts[idxRoleNone1])
    //         await expect(contractNoRole.transferFrom(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId))
    //             .to.be.revertedWith('Pausable: paused');
    //         // Unpaus the contract
    //         await contractAsPauser.unpause(); 
    //     });
    // });

    // describe('Renounce And Revoke Roles', () => {
    //     beforeEach(async () => {
    //         this.contract = await deployAMW721();
    //         this.adminContract = this.contract.connect(this.accounts[idxRoleAdmin]);
    //         this.newUri = 'ipfs://new_uri/';
    //         this.rolesAndAddress = [[roleAsHexMinter, this.accounts[idxRoleMinter].address],
    //                                 [roleAsHexPauser, this.accounts[idxRolePause].address],
    //                                 [roleAsHexRoyaltyManager, this.accounts[idxRoleRoyalty].address],
    //                                 [roleAsHexMetaDataUpdater, this.accounts[idxRoleMetaDataUpdater].address],
    //                                 [roleAsHexMetaDataFreezer, this.accounts[idxRoleMetaDataFreezer].address],
    //                                 [roleAsHexADMIN, this.accounts[idxRoleNewAdmin].address]];
    //         this.rolesAndAddress.forEach(async (element) => {
    //             const [role, address] = element;
    //             await this.adminContract.grantRole(role, address);
    //         });  
    //     });
    
    //     it('should revoke roles given to an address', async () => {
    //         let tokenId = 1;
    //         // Connect to the contract as the minter
    //         const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
    //         // Mint a token, sending it to an address that has no roles
    //         await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
    //         // Revoke the minting role
    //         await this.adminContract.revokeRole(await this.contract.ROLE_MINTER(), this.accounts[idxRoleMinter].address);
    //         // Try to mint again, after the role being revoked
    //         tokenId++;
    //         await expect(contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId))
    //             .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleMinter].address, roleAsHexMinter));
            
    //         // Connect to the contract as the pauser
    //         const contractAsPauser = await this.contract.connect(this.accounts[idxRolePause])
    //         // Ensure the role can successfully pause and unpause the contract
    //         await contractAsPauser.pause();
    //         await contractAsPauser.unpause();
    //         // Revoke the pauser role
    //         await this.adminContract.revokeRole(await this.contract.ROLE_PAUSER(), this.accounts[idxRolePause].address);
    //         // Try to pause the contract again
    //         await expect(contractAsPauser.pause())
    //             .to.be.revertedWith(accessControlRevertString(this.accounts[idxRolePause].address, roleAsHexPauser));
            
    //         // Connect to the contract as the metadata updater
    //         const contractAsMetadataUpdater = await this.contract.connect(this.accounts[idxRoleMetaDataUpdater])
    //         // Set the contract-level metadata URI
    //         await contractAsMetadataUpdater.setContractURI('ipfs://some_random_contract_uri/');
    //         // Revoke the metadata updater role
    //         await this.adminContract.revokeRole(roleAsHexMetaDataUpdater, this.accounts[idxRoleMetaDataUpdater].address);
    //         // Try again to set the contract-level metadata URI
    //         await expect(this.contract.connect(this.accounts[idxRoleMetaDataUpdater]).setContractURI('ipfs://another_contract_uri/'))
    //             .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleMetaDataUpdater].address, roleAsHexMetaDataUpdater));
            
    //         // Connect to the contract as the metadata freezer
    //         const contractAsMetadataFreezer = await this.contract.connect(this.accounts[idxRoleMetaDataFreezer])
    //         // Freeze the metadata
    //         await contractAsMetadataFreezer.freezeURIsForever();
    //         // Revoke the freezer role
    //         await this.adminContract.revokeRole(roleAsHexMetaDataFreezer, this.accounts[idxRoleMetaDataFreezer].address);
    //         // Attempt to freeze the metadata again. Note that in reality, even the role with the proper access would not be
    //         // able to freeze metadata 'again' - it would be kind of meaningless because once metadata is frozen it can't be
    //         // frozen again, but as long as the smart contract checks 'first' whether the right role is held to even call the
    //         // function, the test remains valid.
    //         await expect(contractAsMetadataFreezer.freezeURIsForever())
    //             .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleMetaDataFreezer].address, roleAsHexMetaDataFreezer));
            
    //         // Connect to the contract as a 'new' admin 
    //         const contractAsNextAdmin = await this.contract.connect(this.accounts[idxRoleNewAdmin])
    //         // Ensure the 'new' admin can do something it is supposed to be able to do, such as granting a role
    //         await contractAsNextAdmin.grantRole(roleAsHexMetaDataFreezer, this.accounts[idxRoleMetaDataFreezer].address);
    //         // The 'first' admin now changes its mind and revokes the role from the 'new' admin
    //         await this.adminContract.revokeRole(roleAsHexADMIN, this.accounts[idxRoleNewAdmin].address);
    //         // Confirm that the 'revoked' admin can no longer to 'admin stuff'
    //         await expect(contractAsNextAdmin.grantRole(roleAsHexMetaDataUpdater, this.accounts[idxRoleMetaDataUpdater].address))
    //             .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleNewAdmin].address, roleAsHexADMIN));
    //     });
    
    //     it('should allow an address to renounce their roles', async () => {
    //         let tokenId = 1;
    //         // Connect to the contract as the minter
    //         const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter]);
    //         // Mint a token, sending it to an address that has no roles
    //         await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
    //         // The minter address itself renounces its minter role
    //         await contractAsMinter.renounceRole(await this.contract.ROLE_MINTER(), this.accounts[idxRoleMinter].address);
    //         // Try to mint to confirm it is no longer allowed
    //         tokenId++;
    //         await expect(contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId))
    //             .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleMinter].address, roleAsHexMinter));
            
    //         // Connect to the contract as the pauser
    //         const contractAsPauser = await this.contract.connect(this.accounts[idxRolePause])
    //         // Ensure the role can successfully pause and unpause the contract
    //         await contractAsPauser.pause();
    //         await contractAsPauser.unpause();
    //         // The pauser address itself renounces its pauser role
    //         await contractAsPauser.renounceRole(await this.contract.ROLE_PAUSER(), this.accounts[idxRolePause].address);
    //         // Try to pause the contract again to ensure it can't be done anymore
    //         await expect(contractAsPauser.pause())
    //             .to.be.revertedWith(accessControlRevertString(this.accounts[idxRolePause].address, roleAsHexPauser));

    //         // Connect to the contract as the metadata updater
    //         const contractAsMetadataUpdater = await this.contract.connect(this.accounts[idxRoleMetaDataUpdater])
    //         // Set the contract-level metadata URI
    //         await contractAsMetadataUpdater.setContractURI('ipfs://yet_another_random_contract_uri/');
    //         // The address itself renounces the metadata updater role
    //         await contractAsMetadataUpdater.renounceRole(roleAsHexMetaDataUpdater, this.accounts[idxRoleMetaDataUpdater].address);
    //         // Try again to set a contract URI to ensure it can no longer be done
    //         await expect(contractAsMetadataUpdater.setContractURI('ipfs://a_contract_uri/'))
    //                 .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleMetaDataUpdater].address, roleAsHexMetaDataUpdater));
            
    //         // Connect to the contract as the metadata freezer
    //         const contractAsMetadataFreezer = await this.contract.connect(this.accounts[idxRoleMetaDataFreezer])
    //         // Freeze the metadata
    //         await contractAsMetadataFreezer.freezeURIsForever();
    //         // The address itself renounces the freezer role
    //         await contractAsMetadataFreezer.renounceRole(roleAsHexMetaDataFreezer, this.accounts[idxRoleMetaDataFreezer].address);
    //         // Try again to freeze the metadata to ensure it can't be done. Note this is sort of 'meaningless' as metadata
    //         // should not be freeze-able 'again'. However, as long as the smart contract checks for access control first
    //         // the test itself is valid.
    //         await expect(contractAsMetadataFreezer.freezeURIsForever())
    //                 .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleMetaDataFreezer].address, roleAsHexMetaDataFreezer));
            
    //         // Connect to the contract as a 'new' admin 
    //         const contractAsNextAdmin = await this.contract.connect(this.accounts[idxRoleNewAdmin])
    //         // Ensure the 'new' admin can do something it is supposed to be able to do, such as granting a role
    //         await contractAsNextAdmin.grantRole(roleAsHexADMIN, this.accounts[idxRoleAdmin].address);
    //         // The address itself renounces the admin role
    //         await contractAsNextAdmin.renounceRole(roleAsHexADMIN, this.accounts[idxRoleNewAdmin].address);
    //         // Try again to do something that an admin should be able to do, in order to ensure it is
    //         // no longer possible.
    //         await expect(contractAsNextAdmin.grantRole(roleAsHexMetaDataUpdater, this.accounts[idxRoleMetaDataUpdater].address))
    //                 .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleNewAdmin].address, roleAsHexADMIN));
    //     });
    
    //     it('should not allow a non-admin address to grant any of the other roles', async () => {
    //         // Connect to the contract as an address without any roles
    //         const contractAsNobody = await this.contract.connect(this.accounts[idxRoleNone2])
    //         this.rolesAndAddress.forEach(async (element) => {
    //             const [role, address] = element;
    //             await expect(contractAsNobody.grantRole(role, address))
    //                 .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleNone2].address, roleAsHexADMIN));
    //         });
    //     });
    
    //     it('should allow the new admin to take control of contract', async () => {
    //         // Connect to the contract as a 'new' admin 
    //         const contractAsNextAdmin = await this.contract.connect(this.accounts[idxRoleNewAdmin])
    //         // The new admin now gets territorial and revokes admin access from the 'first' admin
    //         await contractAsNextAdmin.revokeRole(roleAsHexADMIN, this.accounts[idxRoleAdmin].address);
    //         // Confirm that the 'previous' admin can no longer do 'admin stuff'
    //         await expect(this.adminContract.grantRole(roleAsHexMetaDataUpdater, this.accounts[idxRoleMetaDataUpdater].address))
    //             .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleAdmin].address, roleAsHexADMIN));
    //     });
    // });






});

