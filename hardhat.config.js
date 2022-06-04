/**
* @type import('hardhat/config').HardhatUserConfig
*/

require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require('solidity-coverage')
require('dotenv').config();
const { COINMARKETCAP_API_KEY } = process.env;

module.exports = {
   solidity: {
     version:  "0.8.13",
     settings: {
       optimizer: {
         enabled: true,
         runs: 200
       }
     },
   },
   networks: {
     hardhat: {
       chainId: 1337,
    },
  },
  gasReporter: {
    currency: 'USD',
    coinmarketcap: COINMARKETCAP_API_KEY
  }
 };
