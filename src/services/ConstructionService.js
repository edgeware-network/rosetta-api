import RosettaSDK from 'rosetta-node-sdk';
import { decode, createSigningPayload, methods, getTxHash, createSignedTx } from '@substrate/txwrapper';
import { u8aToHex, hexToU8a, stringToHex, hexToString, u8aConcat } from '@polkadot/util';
import BN from 'bn.js';
import { signatureVerify, decodeAddress } from '@polkadot/util-crypto';
import { createSubmittable } from '@polkadot/api/submittable';
import { EXTRINSIC_VERSION } from '@polkadot/types/extrinsic/v4/Extrinsic';

const Types = RosettaSDK.Client;

import {
  publicKeyToAddress,
} from '../substrate/crypto';

import {
  getNetworkConnection,
  getNetworkIdentifier,
  getNetworkApiFromRequest,
} from '../substrate/connections';

import dckCurrency from '../helpers/currency';

import { cryptoWaitReady } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';
import {
  Registry, DEVNODE_INFO, buildTransferTxn, signTxn,
} from '../offline-signing';
import { metadataRpc as metadata } from '../offline-signing/devnode-metadata.json';

import { createType, Metadata, TypeRegistry } from '@polkadot/types';

function jsonToTx(transaction, options = {}) {
  const txParams = JSON.parse(transaction);
  console.log('parsetxParams', txParams)
  const { unsignedTxn, signingPayload } = buildTransferTxn({
    ...txParams,
    ...options,
    version: EXTRINSIC_VERSION,
  });

  const extrinsic = options.registry.registry.createType(
    'Extrinsic',
    unsignedTxn,
    { version: EXTRINSIC_VERSION, ...unsignedTxn }
  );

  // console.log('jsonToTx parsed unsigneD:', unsignedTxn) // unsignedTxn is obj

  // TODO: add signature and signer
  if (txParams.signature) {
    console.log('add extrinsic signature', txParams.signature, 'payload', signingPayload, 'signer', txParams.signer)
    extrinsic.addSignature(txParams.signer, hexToU8a(txParams.signature), signingPayload);
  }

  return {
    transaction: unsignedTxn,
    extrinsic,
    signingPayload,
  };
}

/* Data API: Construction */

/**
* Get Transaction Construction Metadata
* Get any information required to construct a transaction for a specific network. Metadata returned here could be a recent hash to use, an account sequence number, or even arbitrary chain state. It is up to the client to correctly populate the options object with any network-specific details to ensure the correct metadata is retrieved.  It is important to clarify that this endpoint should not pre-construct any transactions for the client (this should happen in the SDK). This endpoint is left purposely unstructured because of the wide scope of metadata that could be required.  In a future version of the spec, we plan to pass an array of Rosetta Operations to specify which metadata should be received and to create a transaction in an accompanying SDK. This will help to insulate the client from chain-specific details that are currently required here.
*
* constructionMetadataRequest ConstructionMetadataRequest
* returns ConstructionMetadataResponse
* */
const constructionMetadata = async (params) => {
  const { constructionMetadataRequest } = params;
  const api = await getNetworkApiFromRequest(constructionMetadataRequest);
  const { options } = constructionMetadataRequest;

  // Get signing info for extrinsic
  const nonce = (await api.query.system.account(options.from)).nonce.toNumber();
  const signingInfo = await api.derive.tx.signingInfo(options.from, nonce);
  const blockNumber = signingInfo.header.number.toNumber();
  const blockHash = await api.rpc.chain.getBlockHash(signingInfo.header.number);
  const eraPeriod = signingInfo.mortalLength;

  // Format into metadata object
  const response = new Types.ConstructionMetadataResponse({
    nonce,
    blockHash,
    blockNumber,
    eraPeriod,
  });

  // TODO: proper suggested fee of extrinsic
  // not required but maybe useful for some
  // response.suggested_fee = [{
  //   value: '10000',
  //   currency: dckCurrency,
  //   metadata: {}
  // }];

  return response;
};

/**
* Submit a Signed Transaction
* Submit a pre-signed transaction to the node. This call should not block on the transaction being included in a block. Rather, it should return immediately with an indication of whether or not the transaction was included in the mempool.  The transaction submission response should only return a 200 status if the submitted transaction could be included in the mempool. Otherwise, it should return an error.
*
* constructionSubmitRequest ConstructionSubmitRequest
* returns ConstructionSubmitResponse
* */
const constructionSubmit = async (params) => {
  const { constructionSubmitRequest } = params;
    console.log('constructionSubmit', constructionSubmitRequest)
  const api = await getNetworkApiFromRequest(constructionSubmitRequest);
  const signedTxHex = constructionSubmitRequest.signed_transaction;

  // TODO: this doesnt seem to work for submitting, even though extrinsic seesm valid
  // perhaps we can just build it with api.transfer blah blah after deconstructing and then call addsignature, then send
  // its hacky because it limits to balances transfer only but maybe the only way we have according to docs
  // i figure its something like that we need to conver tto a corrrect type but which type and how is unknown
  // only reference i found of submitting an already signed hex tansaction is with api sidecar

const registry = new Registry({ chainInfo: DEVNODE_INFO, metadata });


console.log('submit jsontohx')
const { extrinsic } = jsonToTx(constructionSubmitRequest.signed_transaction, {
  metadataRpc: metadata,
  registry: registry,
});
console.log('test submit extrinsic', extrinsic.toHex())
const txHashtest = await api.rpc.author.submitExtrinsic(extrinsic.toHex());
console.log('it submitted! ', txHashtest);

return new Types.TransactionIdentifierResponse({
  hash: txHashtest.substr(2),
});











//
// const decodedTx = decode(signedTxHex, { metadataRpc: metadata, registry: api.registry });
// console.log('decodedTx', Object.keys(decodedTx));
//
// const signPayload = createSigningPayload(decodedTx, { registry: api.registry });
//
//
//   const txHuman = tx.toHuman();
//
//   // TODO: get from tx var
//   const section = 'balances';
//   const method = 'transfer';
//
//   // const transaction = api.tx[section][method](...txParams);
// const transaction = api.tx.balances.transfer(tx.method.args[0], tx.method.args[1]);
//
//
// // create the payload
// // console.log('create payload')
// const signer = api.createType('SignerPayload', {
//   method: transaction,
//   era: tx.era,
//   blockHash: tx.blockHash,
//   blockNumber: tx.blockNumber,
//   nonce: txHuman.nonce,
//   genesisHash: api.genesisHash,
//   runtimeVersion: api.runtimeVersion,
//   version: api.extrinsicVersion
// });
// console.log('payload1', signer.toPayload())
//
// // {
// //   address: '5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM',
// //   blockHash: '0xbae7b59e8d0ef61db70861f49f31e0c6145cb8c33836e2ea2fb4390996cdb174',
// //   blockNumber: '0x00000000',
// //   era: '0x3909',
// //   genesisHash: '0xbae7b59e8d0ef61db70861f49f31e0c6145cb8c33836e2ea2fb4390996cdb174',
// //   method: '0x07003dd99925ad56492dbf1ffa38a741d49c80bdd927498fa8ee5c03d96bc9502d1b32f12101',
// //   nonce: '0x00000000',
// //   signedExtensions: [],
// //   specVersion: '0x0000000c',
// //   tip: '0x0000000000000000',
// //   transactionVersion: '0x00000001',
// //   version: 4
// // }
//
//
//
// const signingPayload = createSigningPayload(tx, { registry: api.registry });
// console.log('payload2', signingPayload)
//
//
//
//   // Generate header byte
//   const headerU8a = new Uint8Array(1); // enum Ed25519, Sr25519, Ecdsa
//   headerU8a[0] = 0; // TODO: get from signature type
//
//   // Append signature type header then create a signed transaction
//   const signatureWithHeader = u8aConcat(headerU8a, hexToU8a(txHuman.signature));
//
// transaction.addSignature(txHuman.signer, signatureWithHeader, signer.toPayload());
// console.log('transaction signed', transaction.toHuman())
//
//
//   // TODO: throws bad signature error
//   console.log('signedTxHex', signedTxHex)
//
//   // even still, this is an incorrect way to send the tx. trying on polkadot fe js console with simple tx says cant pay fees
//   // so polkadot is doing some decoration magic or something
//   // const txHash = await api.rpc.author.submitExtrinsic(tx);
//
//   // const submittable = createSubmittable('Extrinsic', api, api._decorateMethod);
//   // const transaction = submittable(tx);
//   // console.log('transaction', transaction)
//   //
//   const txHash = await transaction.send();
//
//   console.log('txHash', txHash)
//   return new Types.TransactionIdentifierResponse({
//     hash: txHash.substr(2),
//   });
};

/**
* Create Network Transaction from Signatures
* Combine creates a network-specific transaction from an unsigned transaction and an array of provided signatures. The signed transaction returned from this method will be sent to the `/construction/submit` endpoint by the caller.
*
* [OFFLINE]
* constructionCombineRequest ConstructionCombineRequest
* returns ConstructionCombineResponse
* */
const constructionCombine = async (params) => {
  const { constructionCombineRequest } = params;
  console.log('constructionCombineRequest', params)

  // TODO: get registry from network params
  const registry = new Registry({ chainInfo: DEVNODE_INFO, metadata });

  const { unsigned_transaction, signatures } = constructionCombineRequest;
  const unsignedTxJSON = JSON.parse(unsigned_transaction);
  console.log('signatures', signatures);

  // Get signature hex
  const signatureHex = '0x' + signatures[0].hex_bytes;
  const signingPayload = '0x' + signatures[0].signing_payload.hex_bytes;

  // Verify the message
  console.log('signatureVerify', signingPayload, signatureHex, unsignedTxJSON.from);
  const signer = u8aToHex(decodeAddress(unsignedTxJSON.from));
  const signatureU8a = hexToU8a(signatureHex);
  const { isValid } = signatureVerify(signingPayload, signatureU8a, signer);
  if (!isValid) {
    throw new Error(`Signature is not valid for signing payload`);
  }

  // Re-construct extrinsic
  const { transaction, extrinsic } = jsonToTx(unsigned_transaction, {
    metadataRpc: metadata,
    registry: registry,
  });
  const unsignedTxn = transaction;
  const txInfo = decode(unsignedTxn, { metadataRpc: metadata, registry: registry.registry });
  console.log('txInfo', txInfo.blockNumber, txInfo.blockHash, txInfo.address);
  console.log('unsignedTxn', unsignedTxn.blockNumber, unsignedTxn.blockHash, unsignedTxn.address);

  // Ensure tx is balances.transfer
  if (txInfo.method.name !== 'transfer' || txInfo.method.pallet !== 'balances') {
    throw new Error(`Extrinsic must be method transfer and pallet balances`);
  }

  // Generate header byte
  const headerU8a = new Uint8Array(1); // enum Ed25519, Sr25519, Ecdsa
  headerU8a[0] = 0; // TODO: get from signature type

  // Append signature type header then create a signed transaction
  const signatureWithHeader = u8aConcat(headerU8a, signatureU8a);
  // const signedTransaction = createSignedTx(unsignedTxn, signatureWithHeader, { metadataRpc: metadata, registry: registry.registry });
  // const signedDecoded = decode(signedTransaction, { metadataRpc: metadata, registry: registry.registry });
  //
  // // Sanity check signed decoded vs unsigned decoded
  // if (signedDecoded.eraPeriod !== txInfo.eraPeriod) {
  //   throw new Error(`createSignedTx decoding resulted in differing eraPeriod from unsigned tx`);
  // }
  //
  // if (signedDecoded.version !== txInfo.version) {
  //   throw new Error(`createSignedTx decoding resulted in differing version from unsigned tx`);
  // }
  //
  // if (signedDecoded.address !== txInfo.address) {
  //   throw new Error(`createSignedTx decoding resulted in differing address from unsigned tx`);
  // }
  //
  // if (signedDecoded.nonce !== txInfo.nonce) {
  //   throw new Error(`createSignedTx decoding resulted in differing nonce from unsigned tx`);
  // }
  // 
  // if (signedDecoded.tip !== txInfo.tip) {
  //   throw new Error(`createSignedTx decoding resulted in differing tip from unsigned tx`);
  // }

  const signedTxJSON = JSON.stringify({
    ...unsignedTxJSON,
    signature: u8aToHex(signatureWithHeader),
    signer: unsignedTxJSON.from,
  });
  console.log('txJSON1', txInfo)
  console.log('txJSON1', signedTxJSON)

  return new Types.ConstructionCombineResponse(signedTxJSON);
};

/**
* Derive an Address from a PublicKey
* Derive returns the network-specific address associated with a public key. Blockchains that require an on-chain action to create an account should not implement this method.
*
* [OFFLINE]
* constructionDeriveRequest ConstructionDeriveRequest
* returns ConstructionDeriveResponse
* */
const constructionDerive = async (params) => {
  const { constructionDeriveRequest } = params;
  // TODO: get network from identifier without connecting
  // and get appropriate ss58Format value
  const publicKeyHex = '0x' + constructionDeriveRequest.public_key.hex_bytes;
  const publicKeyType = constructionDeriveRequest.public_key.curve_type;
  const address = await publicKeyToAddress(publicKeyHex, publicKeyType);
  return new Types.ConstructionDeriveResponse(address);
};

/**
* Get the Hash of a Signed Transaction
* TransactionHash returns the network-specific transaction hash for a signed transaction.
*
* [OFFLINE]
* constructionHashRequest ConstructionHashRequest
* returns TransactionIdentifierResponse
* */
const constructionHash = async (params) => {
  const { constructionHashRequest } = params;
  console.log('constructionHash', params);

  // TODO: get registry from network params
  const registry = new Registry({ chainInfo: DEVNODE_INFO, metadata });

  const { extrinsic } = jsonToTx(constructionHashRequest.signed_transaction, {
    metadataRpc: metadata,
    registry: registry,
  });

  console.log('extrinsic hex', extrinsic.toHex())
  const transactionHashHex = getTxHash(extrinsic.toHex());
  console.log('transactionHashHex', transactionHashHex)
  return new Types.TransactionIdentifierResponse({
    hash: transactionHashHex.substr(2),
  });
};

/**
* Parse a Transaction
* Parse is called on both unsigned and signed transactions to understand the intent of the formulated transaction. This is run as a sanity check before signing (after `/construction/payloads`) and before broadcast (after `/construction/combine`).
*
* [OFFLINE]
* constructionParseRequest ConstructionParseRequest
* returns ConstructionParseResponse
* */
const constructionParse = async (params) => {
  const { constructionParseRequest } = params;
  console.log('constructionParseRequest', params)
  const { signed, transaction } = constructionParseRequest;

  // TODO: get registry from network params
  const registry = new Registry({ chainInfo: DEVNODE_INFO, metadata });

  let value;
  let sourceAccountAddress;
  let destAccountAddress;

  // Parse transaction
  if (transaction.substr(0, 2) === '0x') { // Hex encoded extrinsic
    const polkaTx = registry.registry.createType('Extrinsic', hexToU8a(transaction), {
      isSigned: true,
    });

    const transactionJSON = polkaTx.toHuman();
    sourceAccountAddress = transactionJSON.signer;
    destAccountAddress = transactionJSON.method.args[0];
    value = polkaTx.method.args[1].toString();
  } else {
    const parsedTx = jsonToTx(transaction, {
      metadataRpc: metadata,
      registry: registry,
    }, signed);

    const parsedTxn = parsedTx.transaction;
    const txInfo = decode(parsedTxn, { metadataRpc: metadata, registry: registry.registry });
    const args = txInfo.method.args;
    console.log('txInfomethod', txInfo.method)

    // Ensure tx is balances.transfer
    if (txInfo.method.name !== 'transfer' || txInfo.method.pallet !== 'balances') {
      throw new Error(`Extrinsic must be method transfer and pallet balances`);
    }

    sourceAccountAddress = txInfo.address;
    destAccountAddress = args.dest;
    value = args.value;
  }


  // Ensure arguments are correct
  if (!destAccountAddress || typeof value === 'undefined') {
    throw new Error('Extrinsic is missing dest and value arguments');
  }

  // Deconstruct transaction into operations
  const operations = [
    Types.Operation.constructFromObject({
      'operation_identifier': new Types.OperationIdentifier(0),
      'type': 'Transfer',
      'account': new Types.AccountIdentifier(sourceAccountAddress),
      'amount': new Types.Amount(
        new BN(value).neg().toString(),
        dckCurrency
      ),
    }),
    Types.Operation.constructFromObject({
      'operation_identifier': new Types.OperationIdentifier(1),
      'type': 'Transfer',
      'account': new Types.AccountIdentifier(destAccountAddress),
      'amount': new Types.Amount(
        value.toString(),
        dckCurrency
      ),
    }),
  ];

  // console.log('operations', operations);

  // Build list of signers, just one
  const signers = signed ? [sourceAccountAddress] : [];

  // Create response
  const response = new Types.ConstructionParseResponse(operations, signers);
  response.account_identifier_signers = signers.map(signer => new Types.AccountIdentifier(signer));
  return response;
};

/**
* Generate an Unsigned Transaction and Signing Payloads
* Payloads is called with an array of operations and the response from `/construction/metadata`. It returns an unsigned transaction blob and a collection of payloads that must be signed by particular addresses using a certain SignatureType. The array of operations provided in transaction construction often times can not specify all \"effects\" of a transaction (consider invoked transactions in Ethereum). However, they can deterministically specify the \"intent\" of the transaction, which is sufficient for construction. For this reason, parsing the corresponding transaction in the Data API (when it lands on chain) will contain a superset of whatever operations were provided during construction.
*
* [OFFLINE]
* constructionPayloadsRequest ConstructionPayloadsRequest
* returns ConstructionPayloadsResponse
* */
const constructionPayloads = async (params) => {
  const { constructionPayloadsRequest } = params;
  const { operations } = constructionPayloadsRequest;
  console.log('constructionPayloads', constructionPayloadsRequest);

  // Must have 2 operations, send and receive
  if (operations.length !== 2) {
    throw new Error('Need atleast 2 transfer operations');
  }

  // Sort by sender/reciever
  const senderOperations = operations
    .filter(operation =>
      new BN(operation.amount.value).isNeg()
    );

  const receiverOperations = operations
    .filter(operation =>
      !new BN(operation.amount.value).isNeg()
    );

  // Ensure we have correct amount of operations
  if (senderOperations.length !== 1 || receiverOperations.length !== 1) {
    throw new Error(`Payloads require 1 sender and 1 receiver transfer operation`);
  }

  const sendOp = senderOperations[0];
  const receiveOp = receiverOperations[0];

  // Support only transfer operation
  if (sendOp.type !== 'Transfer' || receiveOp.type !== 'Transfer') {
    throw new Error(`Payload operations must be of type Transfer`);
  }

  const senderAddress = sendOp.account.address;
  const toAddress = receiveOp.account.address;

  // console.log('senderOperations', senderOperations)
  // console.log('receiverOperations', receiverOperations)
  // TODO: provide proper signature type from public_keys in request
  const signatureType = 'ed25519';

  const { nonce, eraPeriod, blockNumber, blockHash } = constructionPayloadsRequest.metadata;

  // Initialize the registry
  const registry = new Registry({ chainInfo: DEVNODE_INFO, metadata });

  // Build the transfer txn
  const txParams = {
    from: senderAddress,
    to: toAddress,
    value: receiveOp.amount.value,
    tip: 0,
    nonce,
    eraPeriod,
    blockNumber,
    blockHash,
    version: EXTRINSIC_VERSION,
  };

  const { unsignedTxn } = buildTransferTxn({
    ...txParams,
    registry,
  });

  const extrinsicPayload = registry.registry
    .createType('ExtrinsicPayload', unsignedTxn, {
      version: EXTRINSIC_VERSION,
   });

  // With the `ExtrinsicPayload` class, construct the actual payload to sign.
  const actualPayload = extrinsicPayload.toU8a({ method: true });
  const signingPayload = u8aToHex(actualPayload);

  // Create an array of payloads that must be signed by the caller
  const payloads = [{
    address: senderAddress,
    account_identifier: new Types.AccountIdentifier(senderAddress),
    hex_bytes: signingPayload.substr(2),
    signature_type: signatureType,
  }];

  console.log('payloads', payloads)

  const unsignedTransaction = JSON.stringify(txParams);
  console.log('unsignedTransaction', unsignedTransaction)
  return new Types.ConstructionPayloadsResponse(unsignedTransaction, payloads);
};

/**
* Create a Request to Fetch Metadata
* Preprocess is called prior to /construction/payloads to construct a request for any metadata that is needed for transaction construction given (i.e. account nonce).
* The options object returned from this endpoint will be sent to the /construction/metadata endpoint UNMODIFIED by the caller (in an offline execution environment).
* If your Construction API implementation has configuration options, they MUST be specified in the /construction/preprocess request (in the metadata field).
*
* [OFFLINE]
* constructionPreprocessRequest ConstructionPreprocessRequest
* returns ConstructionPreprocessResponse
* */
const constructionPreprocess = async (params) => {
  const { constructionPreprocessRequest } = params;
  const { operations } = constructionPreprocessRequest;

  // Gather public keys needed for TXs
  const requiredPublicKeys = operations.map(operation => {
    return new Types.AccountIdentifier(operation.account.address); // TODO: do we need address or pks?
  });

  console.log('constructionPreprocess', operations);

  const senderAddress = operations.filter(operation => {
    return new BN(operation.amount.value).isNeg();
  }).map(operation => {
    return operation.account.address;
  });

  // TODO: this needs implementing in rosetta-node-client-sdk
  // return new Types.ConstructionPreprocessResponse();
  return {
    options: {
      from: senderAddress[0],
    }, // Configuration options
    required_public_keys: requiredPublicKeys
  }
};

module.exports = {
  /* /construction/metadata */
  constructionMetadata,

  /* /construction/submit */
  constructionSubmit,

  /* /construction/combine */
  constructionCombine,

  /* /construction/derive */
  constructionDerive,

  /* /construction/hash */
  constructionHash,

  /* /construction/parse */
  constructionParse,

  /* /construction/payloads */
  constructionPayloads,

  /* /construction/preprocess */
  constructionPreprocess,
};
