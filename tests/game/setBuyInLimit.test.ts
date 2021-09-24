import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {
  configureGame,
  createGameServer,
  joinGame,
  setBuyInLimit,
} from './utils';

describe('setBuyInLimit APIs', () => {
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
  test('setBuyInLimit', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    const playerId2 = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId2);
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});

    await joinGame({
      ownerId: playerId2,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 1,
      location: {
        lat: 100,
        long: 100,
      },
    });

    const data = await setBuyInLimit({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      limit: 100,
      playerId: playerId2,
    });

    expect(data.setBuyInLimit).toEqual(true);
  });
});
