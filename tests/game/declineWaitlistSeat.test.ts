import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {
  configureGame,
  createGameServer,
  joinGame,
  declineWaitlistSeat,
} from './utils';

describe('declineWaitlistSeat APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('declineWaitlistSeat', async () => {
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
    const data = await declineWaitlistSeat({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
    });
    expect(data.declineWaitlistSeat).toEqual(true);
  });
});
