const types = require('../polkadot-types.json');
const metadata = require('./metadata/testnet-metadata.json');

module.exports = {
  blockchain: 'Substrate',
  network: 'Beresheet',
  nodeAddress: 'wss://beresheet.edgewa.re',
  ss58Format: 42,
  properties: {
    ss58Format: 42,
    tokenDecimals: 6,
    tokenSymbol: 'TEDG',
    poaModule: {
      treasury: '5EYCAe5d818kja8P5YikNggRz4KxztMtMhxP6qSTw7Bwahwq', // TODO
    },
  },
  genesis: '0x459015af8910a8c68308175c80a3967671183157871fa705e6d5b78149aa9ff5',
  name: 'Beresheet',
  specName: 'Beresheet v3',
  // Next 2 fields need to change whenever they change on the chain.
  specVersion: 48,
  transactionVersion: 1, // TODO
  types,
  metadataRpc: metadata.metadataRpc,
};
