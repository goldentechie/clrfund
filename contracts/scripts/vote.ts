import fs from 'fs';
import { ethers } from '@nomiclabs/buidler';
import { PrivKey, PubKey, Keypair } from 'maci-domainobjs'

import { createMessage } from '../tests/utils'

async function main() {
  const [,,,,, contributor1, contributor2] = await ethers.getSigners()
  const state = JSON.parse(fs.readFileSync('state.json').toString())
  const coordinatorPubKey = PubKey.unserialize(state.coordinator.pubKey)

  for (const contributor of [contributor1, contributor2]) {
    const contributorAddress = await contributor.getAddress()
    const { privKey, stateIndex } = state.contributors[contributorAddress]
    const contributorKeyPair = new Keypair(PrivKey.unserialize(privKey))
    const messages = []
    const encPubKeys = []
    for (const recipientIndex of [1, 2]) {
      const nonce = recipientIndex
      const votes = 50
      const [message, encPubKey] = createMessage(
        stateIndex,
        contributorKeyPair,
        coordinatorPubKey,
        recipientIndex, votes, nonce,
      )
      messages.push(message.asContractParam())
      encPubKeys.push(encPubKey.asContractParam())
    }
    const fundingRoundAsContributor = await ethers.getContractAt(
      'FundingRound',
      state.fundingRound,
      contributor,
    )
    await fundingRoundAsContributor.submitMessageBatch(messages, encPubKeys)
    console.log(`Contributor ${contributorAddress} voted.`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
