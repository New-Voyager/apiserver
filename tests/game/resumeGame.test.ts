import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {
  configureGame,
  createGameServer,
  joinGame,
  pauseGame,
  resumeGame,
} from './utils';

describe('resumeGame APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('resumeGame', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
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
    await pauseGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
    });
    const data = await resumeGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
    });

    expect(data.resumeGame).toEqual('CONFIGURED');
  });
});
