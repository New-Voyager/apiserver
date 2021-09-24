import {Cache} from '../../src/cache';

import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {
  configureGame,
  createGameServer,
  joinGame,
  approveRequest,
  applyWaitlistOrder,
} from './utils';

describe('applyWaitlistOrder APIs', () => {
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
  test('applyWaitlistOrder', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    const playerId2 = await clubutils.createPlayer('adam', '1243ABC');
    const playerId3 = await clubutils.createPlayer('adam', '1243ABCs');
    await clubutils.playerJoinsClub(clubCode, playerId2);
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});

    await joinGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 1,
      location: {
        lat: 100,
        long: 100,
      },
    });
    const data = await applyWaitlistOrder({
      ownerId: playerId,
      playerIds: [],
      gameCode: resp.data.configuredGame.gameCode,
    });
    expect(data.applyWaitlistOrder).toEqual(true);

    try {
      await applyWaitlistOrder({
        ownerId: null,
        playerIds: [],
        gameCode: resp.data.configuredGame.gameCode,
      });
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await applyWaitlistOrder({
        ownerId: playerId,
        playerIds: [],
        gameCode: 'test',
      });
    } catch (error) {
      const expectedError = 'Failed to change waitlist order';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await applyWaitlistOrder({
        ownerId: playerId2,
        playerIds: [],
        gameCode: 'test',
      });
    } catch (error) {
      const expectedError = 'Failed to change waitlist order';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`playerCache-test`, 'null');
  });
});
