const assert = require('assert');
const Web3 = require('web3')
const config = require('config')
const HDWalletProvider = require("@truffle/hdwallet-provider");
const crypto = require('crypto');

const BridgeArtifact = require('../build/contracts/Bridge.json')
const IMaticTokenArtifact = require('../build/contracts/IMaticToken.json')
const Erc20Artifact = require('../build/contracts/MaticErc20.json')
const Erc721Artifact = require('../build/contracts/MaticErc721.json')

let web3, childWeb3, bridge
const gas = 1000000

describe('Bridge', function() {
  let accounts, alice

  // before(async function() {
  //   accounts = await web3.eth.getAccounts()
  //   alice = web3.utils.toChecksumAddress(accounts[1])
  // })

  beforeEach(async function() {
    web3 = new Web3(new HDWalletProvider(process.env.MAIN_CHAIN_MNEMONIC, config.get('networks.mainchain.rpc'), 0, 2))
    childWeb3 = new Web3(new HDWalletProvider(process.env.CHILD_CHAIN_MNEMONIC, config.get('networks.childchain.rpc'), 0, 2))
    bridge = new web3.eth.Contract(BridgeArtifact.abi, config.get('contracts.bridge'))
    accounts = await web3.eth.getAccounts()
    alice = web3.utils.toChecksumAddress(accounts[1])
  })

  it.only('Deposit ERC20', async function() {
    const token = config.get('contracts.tokens')[0]
    const rootContract = new web3.eth.Contract(Erc20Artifact.abi, token.root)
    const childContract = new childWeb3.eth.Contract(Erc20Artifact.abi, token.child)
    const amount = web3.utils.toWei('2')
    await rootContract.methods.mint(alice, amount).send({ from: accounts[0], gas })

    const bridgeInitialBalance = web3.utils.toBN(await rootContract.methods.balanceOf(bridge.options.address).call())
    const aliceInitialBalance = web3.utils.toBN(await rootContract.methods.balanceOf(alice).call())
    const aliceInitialBalanceOnChild = web3.utils.toBN(await childContract.methods.balanceOf(alice).call())

    await rootContract.methods.approve(bridge.options.address, amount).send({ from: alice, gas })
    await bridge.methods.deposit(rootContract.options.address, amount, token.isErc721).send({ from: alice, gas })

    const bridgeNowBalance = web3.utils.toBN(await rootContract.methods.balanceOf(bridge.options.address).call())
    const aliceNowBalance = web3.utils.toBN(await rootContract.methods.balanceOf(alice).call())
    assert.ok(bridgeNowBalance.eq(bridgeInitialBalance.add(web3.utils.toBN(amount))))
    assert.ok(aliceNowBalance.eq(aliceInitialBalance.sub(web3.utils.toBN(amount))))

    sleep(2 * 1000); // Wait for the bridge to deposit on child
    const aliceNowBalanceOnChild = web3.utils.toBN(await childContract.methods.balanceOf(alice).call())
    assert.ok(aliceNowBalanceOnChild.eq(aliceInitialBalanceOnChild.add(web3.utils.toBN(amount))))
  });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
