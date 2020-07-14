import { waffle } from '@nomiclabs/buidler';
import { Contract } from 'ethers';
import { defaultAbiCoder } from 'ethers/utils/abi-coder';
import { use, expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { deployMockContract } from '@ethereum-waffle/mock-contract';

import InitialVoiceCreditProxy from '../build/contracts/InitialVoiceCreditProxy.json';
import { deployMaciFactory } from '../scripts/helpers';
import { ZERO_ADDRESS, getGasUsage, MaciParameters } from './utils';

use(solidity);

describe('MACI factory', () => {
  const provider = waffle.provider;
  const [dontUseMe, deployer, coordinator, contributor] = provider.getWallets();// eslint-disable-line @typescript-eslint/no-unused-vars

  let maciFactory: Contract;
  let initialVoiceCreditProxy: Contract;
  let maciParameters = new MaciParameters();
  const coordinatorPubKey = { x: 0, y: 1 };

  beforeEach(async () => {
    maciFactory = await deployMaciFactory(deployer);
    expect(await getGasUsage(maciFactory.deployTransaction)).lessThan(5600000);

    initialVoiceCreditProxy = await deployMockContract(deployer, InitialVoiceCreditProxy.abi);
    await initialVoiceCreditProxy.mock.getVoiceCredits.returns(100);
    const encodedAddress = defaultAbiCoder.encode(['address'], [contributor.address]);
    expect(await initialVoiceCreditProxy.getVoiceCredits(ZERO_ADDRESS, encodedAddress)).to.equal(100);
  });

  it('sets default MACI parameters', async () => {
    expect(await maciFactory.maxUsers()).to.equal(1023);
    expect(await maciFactory.maxMessages()).to.equal(1023);
    expect(await maciFactory.maxVoteOptions()).to.equal(24);
    expect(await maciFactory.signUpDuration()).to.equal(604800);
    expect(await maciFactory.votingDuration()).to.equal(604800);
  });

  it('sets MACI parameters', async () => {
    maciParameters = new MaciParameters({
      stateTreeDepth: 8,
      messageTreeDepth: 12,
      voteOptionTreeDepth: 4,
      signUpDuration: 86400,
      votingDuration: 86400,
    });
    await expect(maciFactory.setMaciParameters(...maciParameters.values()))
      .to.emit(maciFactory, 'MaciParametersChanged');

    expect(await maciFactory.maxUsers())
      .to.equal(2 ** maciParameters.stateTreeDepth - 1);
    expect(await maciFactory.maxMessages())
      .to.equal(2 ** maciParameters.messageTreeDepth - 1);
    expect(await maciFactory.maxVoteOptions())
      .to.equal(5 ** maciParameters.voteOptionTreeDepth - 1);
    expect(await maciFactory.signUpDuration())
      .to.equal(maciParameters.signUpDuration);
    expect(await maciFactory.votingDuration())
      .to.equal(maciParameters.votingDuration);
  });

  it('does not allow to decrease the vote option tree depth', async () => {
    maciParameters = new MaciParameters({ voteOptionTreeDepth: 1 });
    await expect(maciFactory.setMaciParameters(...maciParameters.values()))
      .to.be.revertedWith('MACIFactory: Vote option tree depth can not be decreased');
  });

  it('allows only owner to set MACI parameters', async () => {
    const coordinatorMaciFactory = maciFactory.connect(coordinator);
    await expect(coordinatorMaciFactory.setMaciParameters(...maciParameters.values()))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('deploys MACI', async () => {
    const maciDeployed = maciFactory.deployMaci(
      initialVoiceCreditProxy.address,
      coordinatorPubKey,
    );
    await expect(maciDeployed).to.emit(maciFactory, 'MaciDeployed');

    const deployTx = await maciDeployed;
    expect(await getGasUsage(deployTx)).lessThan(7200000);
  });

  it('allows only owner to deploy MACI', async () => {
    const coordinatorMaciFactory = maciFactory.connect(coordinator);
    await expect(coordinatorMaciFactory.deployMaci(
        initialVoiceCreditProxy.address,
        coordinatorPubKey,
      ))
      .to.be.revertedWith('Ownable: caller is not the owner');
    });
});
