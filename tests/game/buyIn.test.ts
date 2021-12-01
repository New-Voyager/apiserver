import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {configureGame, createGameServer, joinGame, buyIn} from './utils';

describe('buyIn APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
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

    try {
      await buyIn({
        ownerId: null,
        gameCode: resp.data.configuredGame.gameCode,
        amount: 100,
      });
    } catch (error) {
      const expectedError = 'Unauthorized user';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await buyIn({
        ownerId: playerId,
        gameCode: 'test',
        amount: 100,
      });
    } catch (error) {
      const expectedError =
        'Failed to buyin';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await buyIn({
        ownerId: playerId2,
        gameCode: resp.data.configuredGame.gameCode,
        amount: 100,
      });
    } catch (error) {
      expect((error as any).graphQLErrors[0].message).toEqual('Failed to buyin');
    }
  });
});
