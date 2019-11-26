const Bridge = artifacts.require('Bridge')
const erc20 = artifacts.require('MaticErc20')
const erc721 = artifacts.require('MaticErc721')

module.exports = async function(deployer) {
  const contracts = { tokens: [] }
  await deployer.deploy(Bridge);
  contracts.bridge = Bridge.address

  await deployer.deploy(erc20);
  contracts.tokens.push({
    root: erc20.address,
    isErc721: false
  })
  await deployer.deploy(erc20);
  contracts.tokens[0].child = erc20.address

  await deployer.deploy(erc721);
  contracts.tokens.push({
    root: erc721.address,
    isErc721: true
  })
  await deployer.deploy(erc721);
  contracts.tokens[1].child = erc721.address

  console.log(JSON.stringify(contracts, null, 2))
};