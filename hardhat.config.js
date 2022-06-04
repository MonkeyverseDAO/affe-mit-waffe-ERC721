/**
* @type import('hardhat/config').HardhatUserConfig
*/

require("@nomiclabs/hardhat-ethers");

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
 };
