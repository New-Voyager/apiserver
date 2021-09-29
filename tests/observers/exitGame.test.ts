import {Cache} from '../../src/cache';

import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {observeGame, exitGame} from './utils';
import {configureGame, createGameServer} from '../game/utils';

describe('exitGame APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('exitGame', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const playerId2 = await clubutils.createPlayer('adam', '1243ABCs');
    await clubutils.playerJoinsClub(clubCode, playerId);

    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});

    const gameCode = resp.data.configuredGame.gameCode;

    await observeGame({
      ownerId: playerId,
      gameCode,
    });
    const data = await exitGame({
      ownerId: playerId,
      gameCode,
    });
    expect(data.exitGame).toEqual(true);

    try {
      await exitGame({
        ownerId: 'test',
        gameCode,
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache('playerCache-test', 'null');

    try {
      await exitGame({
        ownerId: 'test',
        gameCode,
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await exitGame({
        ownerId: playerId,
        gameCode: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find game code [test] in poker game repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache('gameCache-test', 'null');

    try {
      await exitGame({
        ownerId: playerId,
        gameCode: 'test',
      });
    } catch (error) {
      const expectedError = 'Game test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await exitGame({
        ownerId: playerId2,
        gameCode,
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABCs is not a club member in club bbc';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
