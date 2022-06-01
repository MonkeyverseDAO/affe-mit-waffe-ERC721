const { ethers } = require('hardhat');
const { expect } = require('chai');
  
const { utils } = ethers;

require('dotenv').config();
const { CONTRACT_NAME, CONTRACT_SYMBOL, INITIAL_BASE_TOKEN_URI, INITIAL_CONTRACT_URI } = process.env;

// Below are a set of declarations that help clarify what each account may be used for during the unit tests
const idxRoleAdmin = 0;
const idxRoleMintSigner1 = 1;
const idxRoleRegularMinter1 = 2;
const idxRoleNone1 = 3;
const idxRoleNone2 = 4;
const idxRolePause = 5;
const idxRoleRoyalty = 6;
const idxRoleUriSigner = 7;
const idxRoleMetaDataUpdater = 8;
const idxRoleMetaDataFreezer = 9;
const idxRoleNewAdmin = 10;

const nullAddress = '0x0000000000000000000000000000000000000000'
const roleAsHexADMIN = '0x0000000000000000000000000000000000000000000000000000000000000000';
const roleAsHexMinter = utils.keccak256(utils.toUtf8Bytes('ROLE_MINTER'));
const roleAsHexPauser = utils.keccak256(utils.toUtf8Bytes('ROLE_PAUSER'));
const roleAsHexRoyaltyManager = utils.keccak256(utils.toUtf8Bytes('ROLE_ROYALTY_SETTING'));
const roleAsHexMetaDataUpdater = utils.keccak256(utils.toUtf8Bytes('ROLE_METADATA_UPDATER'));
const roleAsHexMetaDataFreezer = utils.keccak256(utils.toUtf8Bytes('ROLE_METADATA_FREEZER'));

const roleIdxHexPairs = [[idxRoleAdmin, roleAsHexADMIN],
                        [idxRoleRegularMinter1, roleAsHexMinter],
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

  describe('Test function deploy()', () => {
    it('should not return a connected contract', async () => {
      this.contract = await deployAMW721();
      expect(this.contract.signer).to.equal(null);
      expect(await this.contract.ROLE_MINTER()).to.equal('0xaeaef46186eb59f884e36929b6d682a6ae35e1e43d8f05f058dcefb92b601461');
      await this.contract.grantRole(await this.contract.ROLE_MINTER(), this.accounts[idxRoleRegularMinter1].address)
                        .catch(error => expect(error.message).to.equal('sending a transaction requires a signer (operation="sendTransaction", code=UNSUPPORTED_OPERATION, version=contracts/5.6.2)'));
    });
  });
});
