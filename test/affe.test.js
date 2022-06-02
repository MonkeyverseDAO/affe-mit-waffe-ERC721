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

    // Below we are ensuring that deployAMW721 returns an object that is read-only, and that
    // cannot perform any 'write' actions without connecting as a proper signer somehow.
    describe('Test function deploy()', () => {
        it('should not return a connected contract', async () => {
        this.contract = await deployAMW721();
        expect(this.contract.signer).to.equal(null);
        expect(await this.contract.ROLE_MINTER()).to.equal(roleAsHexMinter);
        await this.contract.grantRole(roleAsHexMinter, this.accounts[idxRoleMinter].address)
                            .catch(error => expect(error.message).to.equal('sending a transaction requires a signer (operation="sendTransaction", code=UNSUPPORTED_OPERATION, version=contracts/5.6.2)'));
        });
    });


    describe('Safe Mint', () => {
        let tokenId = 0;
        before(async () => {
            this.contract = await deployAMW721();
            const contractAsAdmin = await this.contract.connect(this.accounts[idxRoleAdmin]);
            await contractAsAdmin.grantRole(roleAsHexMinter, this.accounts[idxRoleMinter].address);
        });

        it('should allow an address with the MINTER_ROLE to mint a token', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
            // Expect the contract to correctly reply with the correct newly minted owner
            // of the tokenId
            await expect(await this.contract.ownerOf(tokenId)).to.equal(this.accounts[idxRoleNone1].address);
        });

        it('should not allow duplicate minting (of the same tokenId twice)', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
            // Try to mint the same token (with the same Id) again
            await expect(contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId))
                  .to.be.revertedWith('ERC721: token already minted');
          });

        it('should not allow an address without the ROLE_MINTER to mint a token', async () => {
            tokenId++;
            // Connect to the contract wihtout any particular role
            const contractNoRole = await this.contract.connect(this.accounts[idxRoleNone1])
            // Try to mint a token, with a valid tokenId (not ever minted before), but connected to
            // the contract using an account that hasn't been granted the minting role.
            await expect(contractNoRole.safeMint(this.accounts[idxRoleNone1].address, tokenId))
                    .to.be.revertedWith(accessControlRevertString(this.accounts[idxRoleNone1].address, roleAsHexMinter));
        });
    });


    describe('Token tranfers', () => {
        let tokenId = 0;
        before(async () => {
            this.contract = await deployAMW721();
            const adminContract = this.contract.connect(this.accounts[idxRoleAdmin]);
            await adminContract.grantRole(roleAsHexMinter, this.accounts[idxRoleMinter].address);
            await adminContract.grantRole(roleAsHexPauser, this.accounts[idxRolePause].address);
        });
    
        it('should allow a token holder to tranfer their token when not paused', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
            // Connect to the contract wihtout any particular role
            const contractNoRole = await this.contract.connect(this.accounts[idxRoleNone1])
            await expect(contractNoRole.transferFrom(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId))
                .to.emit(this.contract, 'Transfer')
                .withArgs(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId);
        });
    
        it('should not allow an address to tranfer a token they do not own when not paused', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
            // Connect to the contract wihtout any particular role, and NOT as the token owner.
            // In this case, and address is trying to transfer to itself a token it does not own.
            const contractNoRole = await this.contract.connect(this.accounts[idxRoleNone2])
            await expect(contractNoRole.transferFrom(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId))
                .to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
        });
    
        it('should not allow a token holder to tranfer their token when paused', async () => {
            tokenId++;
            // Connect to the contract as the minter
            const contractAsMinter = await this.contract.connect(this.accounts[idxRoleMinter])
            // Mint a token, sending it to an address that has no roles
            await contractAsMinter.safeMint(this.accounts[idxRoleNone1].address, tokenId);
            // Connect to the contract as the pauser
            const contractAsPauser = await this.contract.connect(this.accounts[idxRolePause])
            // Pause the contract
            await contractAsPauser.pause();
            // Connect to the contract wihtout any particular role, but as the rightful owner of the
            // token that was minted.
            const contractNoRole = await this.contract.connect(this.accounts[idxRoleNone1])
            await expect(contractNoRole.transferFrom(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId))
                .to.be.revertedWith('Pausable: paused');
            // Unpaus the contract
            await contractAsPauser.unpause(); 
        });
    
        // it('should allow a token holder to tranfer their token minted with a signature when not paused', async () => {
        //     tokenId++;
        //   await this.contract.connect(this.accounts[idxRoleNone1]).signatureBasedSafeMint(this.accounts[idxRoleNone1].address, tokenId, await this.signatures[tokenId]);
        //   await expect(this.contract.connect(this.accounts[idxRoleNone1]).transferFrom(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId))
        //         .to.emit(this.contract, 'Transfer')
        //         .withArgs(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId);
        // });
    
        // it('should not allow an address to tranfer a token minted with a signature they do not own when not paused', async () => {
        //     tokenId++;
        //   await this.contract.connect(this.accounts[idxRoleNone1]).signatureBasedSafeMint(this.accounts[idxRoleNone1].address, tokenId, await this.signatures[tokenId]);
        //   await expect(this.contract.connect(this.accounts[idxRoleNone2]).transferFrom(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId))
        //         .to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
        // });
    
        // it('should not allow a token holder to tranfer their token minted with a signature when paused', async () => {
        //     tokenId++;
        //   await this.contract.connect(this.accounts[idxRoleNone1]).signatureBasedSafeMint(this.accounts[idxRoleNone1].address, tokenId, await this.signatures[tokenId]);
        //   await this.contract.connect(this.accounts[idxRolePause]).pause();
        //   await expect(this.contract.connect(this.accounts[idxRoleNone1]).transferFrom(this.accounts[idxRoleNone1].address, this.accounts[idxRoleNone2].address, tokenId))
        //         .to.be.revertedWith('Pausable: paused');
        // });
      });







});

