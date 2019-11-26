const assert = require('assert');
const Web3 = require('web3')
const config = require('config')
const HDWalletProvider = require("@truffle/hdwallet-provider");
const crypto = require('crypto');

const BridgeArtifact = require('../build/contracts/Bridge.json')
const Erc721Artifact = require('../build/contracts/MaticErc721.json')

let web3, childWeb3, bridge
const gas = 1000000

describe('Bridge', function() {
  let accounts, alice

  beforeEach(async function() {
    // web3 = new Web3(new HDWalletProvider(process.env.MAIN_CHAIN_MNEMONIC, config.get('networks.mainchain.rpc'), 0, 2))
    // childWeb3 = new Web3(new HDWalletProvider(process.env.CHILD_CHAIN_MNEMONIC, config.get('networks.childchain.rpc'), 0, 2))
    web3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:8545'));
    childWeb3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:8545'));
    bridge = new web3.eth.Contract(BridgeArtifact.abi, config.get('contracts.bridge'))
    accounts = await web3.eth.getAccounts()
    alice = web3.utils.toChecksumAddress(accounts[1])
  })

  it('Deposit ERC721', async function() {
    const token = config.get('contracts.tokens')[1]
    const rootContract = new web3.eth.Contract(Erc721Artifact.abi, token.root)
    const childContract = new childWeb3.eth.Contract(Erc721Artifact.abi, token.child)
    // console.log(await childContract.methods.owner().call(), accounts[0])
    const tokenId = '0x' + crypto.randomBytes(256).toString('hex');
    await rootContract.methods.mint(alice, tokenId).send({ from: accounts[0], gas })
    assert.equal(await rootContract.methods.ownerOf(tokenId).call(), alice)

    await rootContract.methods.approve(bridge.options.address, tokenId).send({ from: alice, gas })
    await bridge.methods.deposit(rootContract.options.address, tokenId, token.isErc721).send({ from: alice, gas })
    assert.equal(await rootContract.methods.ownerOf(tokenId).call(), bridge.options.address)

    await sleep(2 * 1000); // Wait for the bridge to deposit on child
    assert.equal(await childContract.methods.ownerOf(tokenId).call(), alice)

    // burn
    await childContract.methods.burn(tokenId).send({ from: alice, gas })
    await sleep(2 * 1000); // Wait for the bridge to deposit on child
    assert.equal(await rootContract.methods.ownerOf(tokenId).call(), alice)
  });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
