import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {configureGame, createGameServer, takeSeat} from './utils';

describe('takeSeat APIs', () => {
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
  test('takeSeat', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.1.1');
    const resp = await configureGame({clubCode, playerId});

    const data = await takeSeat({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 1,
      location: {
        lat: 100,
        long: 100,
      },
    });
    console.log(data);
    expect(data.takeSeat.name).toEqual('brady');
  });
});
