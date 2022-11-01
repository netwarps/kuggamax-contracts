# Kuggamax

> New Kuggamax!

~ Kingwel

The new Kuggamax is a decentralized publishing platform.

## Design Principles

## Overview

Kuggamax is described by two smart contracts:

1. `Kuggamax.sol` - Responsible for managing membership & voting rights, proposal submissions, voting, and processing proposals based on the outcomes of the votes.
2. `GuildBank.sol` - Responsible for managing Guild assets.

Kuggamax is using an external ERC20 token, KMC. 

## Installation

To intall this project run `npm install`.

## Testing

To tests the contracts run `npm run test`.

To compute their code coverage run `npm run coverage`.

## Deploying an interacting with a Kuggamax DAO and a Pool

This project includes Hardhat tasks for deploying and using Kuggamax.

### Deployment

#### Deploying a new Kuggamax

Follow this instructions to deploy a new DAO:

1. Edit `hardhat.config.js`, setting the values for `INFURA_API_KEY` and `MAINNET_PRIVATE_KEY`.
2. Edit `deployment-params.js`, setting your desired deployment parameters.
3. Run `npx hardhat kuggamax-deploy --network mainnet`
4. Edit `hardhat.config.js`, setting the address of the Kuggamax in `networks.mainnet.deployedContracts.kuggamax`.

### Interacting with the smart contracts

This project has tasks to work with Kuggamax contracts. To use them, you should first follow this instructions:

1. Edit `hardhat.config.js`, setting the values for `INFURA_API_KEY` and `MAINNET_PRIVATE_KEY`.
2. Make sure you have the right address in `hardhat.config.js`'s `networks.mainnet.deployedContracts.kuggamax` field.

```
npx hardhat kuggamax-deploy 

npx hardhat deposit --amount 0.1

npx hardhat create-lab --description no1

npx hardhat create-item --lab 1

npx hardhat mint --item 1

npx hardhat add-member --member 

npx hardhat remove-member --member 

npx hardhat withdraw --amount 100

npx hardhat debug

```


