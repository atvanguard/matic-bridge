const Bridge = artifacts.require('Bridge')
const erc20 = artifacts.require('MaticErc20')
const erc721 = artifacts.require('MaticErc721')

module.exports = async function(deployer) {
  await deployer.deploy(Bridge);
  await deployer.deploy(erc20);
  await deployer.deploy(erc20);
  await deployer.deploy(erc721);
  await deployer.deploy(erc721);
  // const _erc721 = await erc721.deployed()
  // const mint = await _erc721.mint('0xc5688dD95251Fb80696A75E2Ca8eBe8a0e89AB76', '0x1')
  // console.log(mint)
};