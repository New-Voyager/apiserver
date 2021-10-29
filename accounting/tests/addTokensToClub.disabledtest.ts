import {Cache} from '../../src/cache';

import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {addTokensToClub} from './utils';

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

    const data = await addTokensToClub({
      clubCode,
      ownerId,
      subType: 'BONUS',
      amount: 1,
      notes: 'test',
    });
    expect(data.addTokensToClub).toEqual(true);

    try {
      await addTokensToClub({
        clubCode,
        ownerId: 'test',
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await addTokensToClub({
        clubCode: 'test',
        ownerId,
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find club code [test] in club repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await addTokensToClub({
        clubCode,
        ownerId: playerId,
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABC is not a host in club bbc';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`playerCache-test`, 'null');

    try {
      await addTokensToClub({
        clubCode,
        ownerId: 'test',
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`clubCache-test`, 'null');

    try {
      await addTokensToClub({
        clubCode: 'test',
        ownerId,
        subType: 'BONUS',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Club test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
