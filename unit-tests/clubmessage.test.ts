import {initializeSqlLite} from './utils';
import {createGameServer} from '../src/internal/gameserver';
import {startGame} from '../src/resolvers/game';
import {getClubById, createClub} from '../src/resolvers/club';
import {getPlayerById, createPlayer} from '../src/resolvers/player';
import {sendClubMsg, getClubMsg} from '../src/resolvers/clubmessage';
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
  test('send a text message', async () => {
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
      messageType: 'TEXT',
      text: 'Hi buddy',
      playerTags: ownerId,
    };

    try {
      const resp = await sendClubMsg(ownerId, clubCode, messageInput);
      expect(resp).not.toBeNull();
      expect(resp).not.toBeUndefined();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('send a GIPHY message', async () => {
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
      messageType: 'GIPHY',
      giphyLink: 'test.com',
      playerTags: ownerId,
    };

    try {
      const resp = await sendClubMsg(ownerId, clubCode, messageInput);
      expect(resp).not.toBeNull();
      expect(resp).not.toBeUndefined();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('send a hand message', async () => {
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
      messageType: 'HAND',
      handNum: 0,
      gameNum: 0,
      playerTags: ownerId,
    };

    try {
      const resp = await sendClubMsg(ownerId, clubCode, messageInput);
      expect(resp).not.toBeNull();
      expect(resp).not.toBeUndefined();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('get message', async () => {
    const msgCount = 60;
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
      messageType: 'TEXT',
      text: 'Hi buddy',
      playerTags: ownerId,
    };
    for (let i = 0; i < msgCount; i++) {
      await sendClubMsg(ownerId, clubCode, messageInput);
    }
    try {
      const resp = await getClubMsg(ownerId, clubCode);
      expect(resp).not.toBeNull();
      expect(resp).not.toBeUndefined();
      expect(resp).toHaveLength(50);
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('get message pagination', async () => {
    const msgCount = 60;
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
      messageType: 'TEXT',
      text: 'Hi buddy',
      playerTags: ownerId,
    };
    for (let i = 0; i < msgCount; i++) {
      await sendClubMsg(ownerId, clubCode, messageInput);
    }
    try {
      let message = await getClubMsg(ownerId, clubCode);
      expect(message).toHaveLength(50);
      message = await getClubMsg(ownerId, clubCode, {
        count: 25,
        next: 5,
      });
      expect(message).toHaveLength(25);
      expect(message).not.toBeNull();
      expect(message).not.toBeUndefined();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });
});
