import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {configureGame, createGameServer, joinGame, buyIn} from './utils';

describe('buyIn APIs', () => {
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
  test('buyIn', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    const playerId2 = await clubutils.createPlayer('adam', '1243ABC');
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
    const data = await buyIn({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      amount: 100,
    });
    expect(data.status.approved).toEqual(true);
    expect(data.status.expireSeconds).toEqual(60);

    try {
      await buyIn({
        ownerId: null,
        gameCode: resp.data.configuredGame.gameCode,
        amount: 100,
      });
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await buyIn({
        ownerId: playerId,
        gameCode: 'test',
        amount: 100,
      });
    } catch (error) {
      const expectedError =
        'Failed to update buyin. Error: Cannot find game code [test] in poker game repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await buyIn({
        ownerId: playerId2,
        gameCode: resp.data.configuredGame.gameCode,
        amount: 100,
      });
    } catch (error) {
      const expectedError = `Failed to update buyin. Error: Player: 1243ABC is not authorized to play game ${resp.data.configuredGame.gameCode}`;
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
