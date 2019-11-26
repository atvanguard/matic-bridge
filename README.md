# Matic Bridge

### Backgroud Processes
```
nvm use 11
ganache-cli
docker run -p 6379:6379 -d redis
```

### Compile
```
npm run truffle:compile
npm run truffle migrate -- --reset
```
Copy the output from above migration to [config file](./config/default.json#16) under `contracts` key.

### Run Bridge Server
```
npm start
```

### Test
```
npm run mocha test/testErc20.js
npm run mocha test/testErc721.js
```
