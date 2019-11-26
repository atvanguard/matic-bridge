const Web3 = require('web3')
const config = require('config')
// const HDWalletProvider = require("@truffle/hdwallet-provider");
const Queue = require('bee-queue');
const bluebird = require('bluebird')
const redis = require('redis')
bluebird.promisifyAll(redis);

const client = redis.createClient(config.get('bee-q.redis'))

const BridgeArtifact = require('../build/contracts/Bridge.json')
const Erc20Artifact = require('../build/contracts/MaticErc20.json')
const Erc721Artifact = require('../build/contracts/MaticErc721.json')

const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:8545'));
const childWeb3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:8545'));
let accounts

const bridge = new web3.eth.Contract(BridgeArtifact.abi, config.get('contracts.bridge'))
const depositsQName = 'deposits-test-1'
const withdrawsQName = 'withdraws-test-1'

async function setup() {
  accounts = await web3.eth.getAccounts()
  const depositsQ = new Queue(depositsQName, config.get('bee-q'));
  const withdrawsQ = new Queue(withdrawsQName, config.get('bee-q'));

  const rootToChild = {}, childToRoot = {}

  config.get('contracts.tokens').forEach(token => {
    let childContract
    if (token.isErc721) {
      childContract = new childWeb3.eth.Contract(Erc721Artifact.abi, token.child)
      childToRoot[token.child] = { contract: new web3.eth.Contract(Erc721Artifact.abi, token.root) , isErc721: true }
    } else {
      childContract = new childWeb3.eth.Contract(Erc20Artifact.abi, token.child)
      childToRoot[token.child] = { contract: new web3.eth.Contract(Erc20Artifact.abi, token.root) , isErc721: false }
    }
    rootToChild[token.root] = { contract: childContract, isErc721: token.isErc721 }

    // subscribe to burn event (Transfer to address(0)) on child tokens
    childContract.events.Transfer({
      filter: { to: '0x0000000000000000000000000000000000000000' },
      fromBlock: 0
    }, (err) => {
      if (err) console.log(err)
    })
    .on('connected', function(subscriptionId) {
      console.log(`Listening to Transfer(,address(0),) events on child contract ${token.child}`);
    })
    .on('data', async event => {
      // console.log('child contract event', event);
      event.token = token.child
      if (await shouldProcess(event, withdrawsQName)) withdrawsQ.createJob(event).save();
    })
  })

  // Subscribe to deposit events on bridge
  bridge.events.Deposit({ fromBlock: 0 }, (err) => {
    if (err) console.log(err)
  })
  .on('connected', function(subscriptionId) {
    console.log(`Listening to Deposit events on Bridge contract`);
  })
  .on('data', async event => {
    if (await shouldProcess(event, depositsQName)) depositsQ.createJob(event).save();
  })

  depositsQ.process(async function (job, done) {
    console.log(`Processing job ${job.id}`);
    const event = job.data;
    // console.log(event)
    try {
      const token = rootToChild[event.returnValues.token]
      // bridge could have events from tokens that we are no longer processing deposits for
      if (token) {
        let mint = token.contract.methods
          .mint(event.returnValues.user, event.returnValues.tokenIdOrAmount)
          .send({ from: accounts[0], gas: 1000000 })
        if (token.isErc721 === false) mint = await mint
        // console.log('mint', mint)
      }
      const key = buildKey(depositsQName, event.transactionHash, event.logIndex)
      await client.setAsync(key, true)
      console.log(`Processed ${key}`)
      return done(null, key);
    } catch(e) {
      console.log('error', e)
    }
  });

  withdrawsQ.process(async function (job, done) {
    console.log(`Processing job ${job.id}`);
    const event = job.data;
    // console.log(event)
    try {
      const token = childToRoot[event.token]
      // bridge could have events from tokens that we are no longer processing withdraws for
      if (token) {
        if (token.isErc721) {
          try {
            const owner = await token.contract.methods.ownerOf(event.returnValues.tokenId).call()
            console.log('owner', owner, bridge.options.address)
            if (owner === bridge.options.address) {
              const withdraw = await bridge.methods
                .withdraw(childToRoot[event.token].contract.options.address, event.returnValues.tokenId, event.returnValues.from, token.isErc721)
                .send({ from: accounts[0], gas: 1000000 })
              // console.log('withdraw', withdraw)
            }
          } catch(e) {
            console.log('token doesnt exist, minting it...')
            // call mint function
          }
        } else {
          // console.log('balanceOf', await token.contract.methods.balanceOf(bridge.options.address).call())
          const withdraw = await bridge.methods
            .withdraw(childToRoot[event.token].contract.options.address, event.returnValues.value, event.returnValues.from, token.isErc721)
            .send({ from: accounts[0], gas: 1000000 })
          // console.log('withdraw', withdraw)
        }
      }
      const key = buildKey(withdrawsQName, event.transactionHash, event.logIndex)
      await client.setAsync(key, true)
      console.log(`Processed ${key}`)
      return done(null, key);
    } catch(e) {
      console.log('error', e)
    }
  });
}

function buildKey(q, hash, index) {
  return `${q}-${hash}-${index}`
}

async function shouldProcess(event, q) {
  const key = buildKey(q, event.transactionHash, event.logIndex)
  const _isProcessed = await client.getAsync(key)
  if (_isProcessed) console.log(`Key ${key} is already processed`)
  return !_isProcessed
}

setup().then(() => console.log('Bridge server initialized'))