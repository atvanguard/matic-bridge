const Web3 = require('web3')
const config = require('config')
const HDWalletProvider = require("@truffle/hdwallet-provider");
const Queue = require('bee-queue');
const bluebird = require('bluebird')
const redis = require('redis')
bluebird.promisifyAll(redis);

const client = redis.createClient(config.get('bee-q.redis'))

const BridgeArtifact = require('../build/contracts/Bridge.json')
const IMaticTokenArtifact = require('../build/contracts/IMaticToken.json')

const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:8545'));
const childWeb3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:8545'));
let accounts

const bridge = new web3.eth.Contract(BridgeArtifact.abi, config.get('contracts.bridge'))
const queueName = 'deposits-test-1'

async function setup() {
  accounts = await web3.eth.getAccounts()
  const depositsQ = new Queue(queueName, config.get('bee-q'));

  const rootToChild = {}
  config.get('contracts.tokens').forEach(token => {
    const contract = new childWeb3.eth.Contract(IMaticTokenArtifact.abi, token.child)
    rootToChild[token.root] = { contract, isErc721: token.isErc721 }
    // subscribe to burn event (Transfer to address(0)) on child tokens
    // contract.events.Transfer({ filter: { to: '' }, fromBlock: 0, toBlock: 'latest' })
    // contract.events.Transfer({ fromBlock: 0}, (err) => {
    //   if (err) console.log(err)
    // })
    // .on('connected', function(subscriptionId) {
    //   console.log(`Listening to Transfer(,address(0),) events on child contract`);
    // })
    // .on('data', event => {
    //   console.log('child contract', event);
    //   // transfer to user on root chain
    // })
  })

  // Subscribe to deposit events on bridge
  bridge.events.Deposit({ fromBlock: 0 }, (err) => {
    if (err) console.log(err)
  })
  .on('connected', function(subscriptionId) {
    console.log(`Listening to Deposit events on Bridge contract`);
  })
  .on('data', async event => {
    const key = buildKey(event.transactionHash, event.logIndex)
    const isProcessed = await client.getAsync(key)
    if (!isProcessed) {
      depositsQ.createJob(event).save();
    } else {
      console.log(`Key ${key} is already processed`)
    }
  })

  // Process jobs from as many servers or processes as you like
  depositsQ.process(async function (job, done) {
    console.log(`Processing job ${job.id}`);
    const event = job.data;
    // console.log(event)
    try {
      // bridge could have events from tokens that we are no longer processing deposits for
      const token = rootToChild[event.returnValues.token]
      if (token) {
        let mint = token.contract.methods
          .mint(event.returnValues.user, event.returnValues.tokenIdOrAmount)
          .send({ from: accounts[0], gas: 1000000 })
        if (token.isErc721 === false) mint = await mint
        // console.log('mint', mint)
      }
      const key = buildKey(event.transactionHash, event.logIndex)
      await client.setAsync(key, true)
      console.log(`Processed ${key}`, event.returnValues)
      return done(null, key);
    } catch(e) {
      console.log('error', e)
    }
  });
}

function buildKey(hash, index) {
  return queueName + hash + index
}

setup().then(() => console.log('Bridge server initialized'))