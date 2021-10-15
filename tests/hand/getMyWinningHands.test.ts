import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {configureGame, createGameServer,  takeSeat} from '../game/utils';
import { getMyWinningHands } from '../utils/hand.testutils';


describe('getBookmarkedHandsByGame APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('getBookmarkedHandsByGame', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.1.1');
    const resp = await configureGame({clubCode, playerId});

    const data = await getMyWinningHands(playerId, resp.data.configuredGame.gameCode)
    expect(data).toEqual([]);
  });
});
