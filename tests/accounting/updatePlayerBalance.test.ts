import {Cache} from '../../src/cache';

import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {updatePlayerBalance} from './utils';

describe('updatePlayerBalance APIs', () => {
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
  test('updatePlayerBalance', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const playerId2 = await clubutils.createPlayer('adam2', '1243ABCs');
    const playerId3 = await clubutils.createPlayer('adam2', '1243ABCss');
    await clubutils.playerJoinsClub(clubCode, playerId);
    await clubutils.playerJoinsClub(clubCode, playerId2);

    const data = await updatePlayerBalance({
      clubCode,
      ownerId,
      playerId,
      amount: 1,
      notes: 'test',
    });
    expect(data.updatePlayerBalance).toEqual(true);

    try {
      await updatePlayerBalance({
        clubCode,
        ownerId: 'test',
        playerId,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await updatePlayerBalance({
        clubCode,
        ownerId,
        playerId: 'test',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await updatePlayerBalance({
        clubCode: 'test',
        ownerId,
        playerId,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find club code [test] in club repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await updatePlayerBalance({
        clubCode,
        ownerId: playerId,
        playerId,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABC is not a host in club bbc';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await updatePlayerBalance({
        clubCode,
        ownerId,
        playerId: playerId3,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABCss is not a member in club bbc';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`playerCache-test`, 'null');

    try {
      await updatePlayerBalance({
        clubCode,
        ownerId: 'test',
        playerId,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await updatePlayerBalance({
        clubCode,
        ownerId,
        playerId: 'test',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`clubCache-test`, 'null');

    try {
      await updatePlayerBalance({
        clubCode: 'test',
        ownerId,
        playerId,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Club test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
