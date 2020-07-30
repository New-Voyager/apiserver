import {initializeSqlLite} from './utils';
import {createGameServer} from '../src/internal/gameserver';
import {startGame, getGameById} from '../src/resolvers/game';
import {getClubById, createClub} from '../src/resolvers/club';
import {
  saveFavMsg,
  getClubFavMsg,
  getPlayerFavMsg,
} from '../src/resolvers/clubfreqmessage';
import {getPlayerById, createPlayer} from '../src/resolvers/player';
import {
  saveChipsData,
  buyChipsData,
  endGameData,
} from '../src/internal/chipstrack';
import {getLogger} from '../src/utils/log';
const logger = getLogger('clubfreqmsg-unit-test');
beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Club APIs', () => {
  test('save a club favourite message', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const messageInput = {
      text: 'Hi buddy',
      clubCode: clubCode,
    };
    try {
      const resp = await saveFavMsg(ownerId, messageInput);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('save a player favourite message', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const messageInput = {
      text: 'Hi buddy',
      playerId: ownerId,
    };
    try {
      const resp = await saveFavMsg(ownerId, messageInput);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('get club favourite message', async () => {
    const msgCount = 50;
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const messageInput = {
      text: 'Hi buddy',
      clubCode: clubCode,
    };
    for (let i = 0; i < msgCount; i++) {
      await saveFavMsg(ownerId, messageInput);
    }
    try {
      const resp = await getClubFavMsg(ownerId, clubCode);
      expect(resp).not.toBeNull();
      expect(resp).toHaveLength(20);
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('get player favourite message', async () => {
    const msgCount = 50;
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const messageInput = {
      text: 'Hi buddy',
      playerId: ownerId,
    };
    for (let i = 0; i < msgCount; i++) {
      await saveFavMsg(ownerId, messageInput);
    }
    try {
      const resp = await getPlayerFavMsg(ownerId);
      expect(resp).not.toBeNull();
      expect(resp).toHaveLength(20);
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });
});
