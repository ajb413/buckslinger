module.exports = {
  defaultNetwork: "base_sepolia",
  networks: {
    hardhat: {
    },
    base_sepolia: {
      url: "https://sepolia.base.org",
    }
  },
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
}