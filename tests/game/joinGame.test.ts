import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {
  configureGame,
  createGameServer,
  holdemGameInput,
  joinGame,
} from './utils';

describe('joinGame APIs', () => {
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
  test('joinGame', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});

    const data = await joinGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 1,
      location: {
        lat: 100,
        long: 100,
      },
    });
    console.log(data);
    expect(data.joinGame).not.toBeNull();
    expect(data.joinGame.missedBlind).toEqual(false);
    expect(data.joinGame.status).toEqual('WAIT_FOR_BUYIN');
  });
});
