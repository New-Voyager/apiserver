import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {playerGameStats} from './utils';
import {configureGame, createGameServer, joinGame} from '../game/utils';

describe('playerGameStats APIs', () => {
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
  test('playerGameStats', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId: ownerId});
    await joinGame({
      ownerId: ownerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 1,
      location: {
        lat: 100,
        long: 100,
      },
    });
    const data = await playerGameStats({
      ownerId,
      gameCode: resp.data.configuredGame.gameCode,
    });
    expect(data.playerGameStats.inPreflop).toEqual(0);
  });
});
