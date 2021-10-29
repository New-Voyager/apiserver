import {Cache} from '../../src/cache';

import {resetDatabase, getClient, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getPlayerTransactions} from './utils';

describe('playerTransactions APIs', () => {
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
  test('playerTransactions', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const playerId2 = await clubutils.createPlayer('adam', '1243ABCs');
    await clubutils.playerJoinsClub(clubCode, playerId);

    const data = await getPlayerTransactions({
      clubCode,
      ownerId,
      playerId,
    });
    expect(data.transactions).toEqual([]);

    try {
      await getPlayerTransactions({
        clubCode,
        ownerId: 'test',
        playerId,
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getPlayerTransactions({
        clubCode,
        ownerId,
        playerId: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getPlayerTransactions({
        clubCode: 'test',
        ownerId,
        playerId,
      });
    } catch (error) {
      const expectedError = 'Cannot find club code [test] in club repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getPlayerTransactions({
        clubCode,
        ownerId: playerId,
        playerId,
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABC is not a host in club bbc';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getPlayerTransactions({
        clubCode,
        ownerId,
        playerId: playerId2,
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABCs is not a member in club bbc';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`playerCache-test`, 'null');

    try {
      await getPlayerTransactions({
        clubCode,
        ownerId: 'test',
        playerId,
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getPlayerTransactions({
        clubCode,
        ownerId,
        playerId: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`clubCache-test`, 'null');

    try {
      await getPlayerTransactions({
        clubCode: 'test',
        ownerId,
        playerId,
      });
    } catch (error) {
      const expectedError = 'Club test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
