/**
* @type import('hardhat/config').HardhatUserConfig
*/

require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-etherscan");
require('solidity-coverage')
require('dotenv').config();
const { COINMARKETCAP_API_KEY, NODE_PROVIDER_API_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

module.exports = {
    solidity: {
     version:  "0.8.13",
     settings: {
       optimizer: {
         enabled: true,
         runs: 250
       }
     }
   },
   defaultNetwork: "hardhat",
   networks: {
     hardhat: {
       chainId: 1337,
    },
    rinkeby: {
      url: NODE_PROVIDER_API_URL,
      accounts: [`0x${PRIVATE_KEY}`]
   }
  },
  gasReporter: {
    currency: 'USD',
    coinmarketcap: COINMARKETCAP_API_KEY
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  }
};
