import {Cache} from '../../src/cache';

import {resetDatabase, getClient, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getLogger} from '../../src/utils/log';
import {settlePlayerToPlayer} from './utils';
const logger = getLogger('club');

describe('SettlePlayerToPlayer APIs', () => {
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

  test('settlePlayerToPlayer', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const playerId2 = await clubutils.createPlayer('adam2', '1243ABCs');
    const playerId3 = await clubutils.createPlayer('adam2', '1243ABCss');
    await clubutils.playerJoinsClub(clubCode, playerId);
    await clubutils.playerJoinsClub(clubCode, playerId2);

    const data = await settlePlayerToPlayer({
      clubCode,
      ownerId,
      fromPlayerId: playerId,
      toPlayerId: playerId2,
      amount: 1,
      notes: 'test',
    });
    expect(data.settlePlayerToPlayer).toEqual(true);

    try {
      await settlePlayerToPlayer({
        clubCode,
        ownerId,
        fromPlayerId: 'test',
        toPlayerId: playerId2,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await settlePlayerToPlayer({
        clubCode,
        ownerId,
        fromPlayerId: playerId,
        toPlayerId: 'test',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await settlePlayerToPlayer({
        clubCode,
        ownerId: 'test',
        fromPlayerId: playerId,
        toPlayerId: playerId2,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
    try {
      await settlePlayerToPlayer({
        clubCode,
        ownerId: playerId,
        fromPlayerId: playerId,
        toPlayerId: playerId2,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABC is not a host in club bbc';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await settlePlayerToPlayer({
        clubCode,
        ownerId,
        fromPlayerId: playerId3,
        toPlayerId: playerId2,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABCss is not a member in club bbc';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
    try {
      await settlePlayerToPlayer({
        clubCode,
        ownerId,
        fromPlayerId: playerId,
        toPlayerId: playerId3,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABCss is not a member in club bbc';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
    await Cache.setCache(`playerCache-test`, 'null');

    try {
      await settlePlayerToPlayer({
        clubCode,
        ownerId: 'test',
        fromPlayerId: playerId,
        toPlayerId: playerId2,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await settlePlayerToPlayer({
        clubCode,
        ownerId,
        fromPlayerId: 'test',
        toPlayerId: playerId2,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await settlePlayerToPlayer({
        clubCode,
        ownerId,
        fromPlayerId: playerId,
        toPlayerId: 'test',
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
    await Cache.setCache(`clubCache-test`, 'null');

    try {
      await settlePlayerToPlayer({
        clubCode: 'test',
        ownerId,
        fromPlayerId: playerId,
        toPlayerId: playerId2,
        amount: 1,
        notes: 'test',
      });
    } catch (error) {
      const expectedError = 'Club test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
