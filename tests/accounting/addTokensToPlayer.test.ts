import {Cache} from '../../src/cache';

import {resetDatabase, getClient, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getLogger} from '../../src/utils/log';
import {addTokensToPlayer, settlePlayerToPlayer} from './utils';
const logger = getLogger('club');

describe('addTokensToPlayer APIs', () => {
  let stop;

  beforeAll(async done => {
    const testServer = await startGqlServer();
    stop = testServer.stop;
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    stop();
    done();
  });
  test('addTokensToPlayer', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const playerId2 = await clubutils.createPlayer('adam2', '1243ABCs');
    const playerId3 = await clubutils.createPlayer('adam2', '1243ABCss');

    await clubutils.playerJoinsClub(clubCode, playerId);
    await clubutils.playerJoinsClub(clubCode, playerId2);

    const data = await addTokensToPlayer({
      clubCode,
      ownerId,
      playerId,
      subType: 'BONUS',
      amount: 1,
      notes: 'test',
    });
    expect(data.addTokensToPlayer).toEqual(true);

    try {
      await addTokensToPlayer({
        clubCode,
        ownerId: 'test',
        playerId,
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await addTokensToPlayer({
        clubCode,
        ownerId,
        playerId: 'test',
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await addTokensToPlayer({
        clubCode: 'test',
        ownerId,
        playerId,
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find club code [test] in club repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await addTokensToPlayer({
        clubCode,
        ownerId: playerId3,
        playerId,
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABCss is not a host in club bbc';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await addTokensToPlayer({
        clubCode,
        ownerId,
        playerId: playerId3,
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABCss is not a member in club bbc';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`playerCache-test`, 'null');

    try {
      await addTokensToPlayer({
        clubCode,
        ownerId: 'test',
        playerId,
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await addTokensToPlayer({
        clubCode,
        ownerId,
        playerId: 'test',
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`clubCache-test`, 'null');

    try {
      await addTokensToPlayer({
        clubCode: 'test',
        ownerId,
        playerId,
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Club test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});