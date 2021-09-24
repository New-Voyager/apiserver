import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {
  configureGame,
  createGameServer,
  joinGame,
  approveRequest,
} from './utils';

describe('approveRequest APIs', () => {
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
  test('approveRequest', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    const playerId2 = await clubutils.createPlayer('adam', '1243ABC');
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
    const data = await approveRequest({
      ownerId: playerId,
      playerId: playerId2,
      gameCode: resp.data.configuredGame.gameCode,
      status: 'APPROVED',
      type: 'BUYIN_REQUEST',
    });
    expect(data.status).toEqual(false);

    try {
      await approveRequest({
        ownerId: null,
        playerId: playerId2,
        gameCode: resp.data.configuredGame.gameCode,
        status: 'APPROVED',
        type: 'BUYIN_REQUEST',
      });
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
