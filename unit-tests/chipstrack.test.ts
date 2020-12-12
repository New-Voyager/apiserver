import {initializeSqlLite} from './utils';
import {createGameServer} from '../src/internal/gameserver';
import {configureGame, configureGameByPlayer} from '../src/resolvers/game';
import {
  getClubBalanceAmount,
  getRakeCollected,
  getPlayerTrack,
  getPlayerBalanceAmount,
} from '../src/resolvers/chipstrack';
import {getClubById, createClub} from '../src/resolvers/club';
import {getPlayerById, createPlayer} from '../src/resolvers/player';
import {
  saveChipsData,
  buyChipsData,
  endGameData,
} from '../src/internal/chipstrack';
import {getGame} from '@src/cache/index';

import {getLogger} from '../src/utils/log';
const logger = getLogger('chipstrack-unit-test');

const SERVER_API = 'http://localhost:9501/internal';

const holdemGameInput = {
  gameType: 'HOLDEM',
  title: 'Friday game',
  smallBlind: 1.0,
  bigBlind: 2.0,
  straddleBet: 4.0,
  utgStraddleAllowed: true,
  buttonStraddleAllowed: false,
  minPlayers: 3,
  maxPlayers: 9,
  gameLength: 60,
  buyInApproval: true,
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistSupported: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 600,
  actionTime: 30,
  muckLosingHand: true,
};

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Player Chips tracking APIs', () => {
  test('Create a player chips tracker when player sits in', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    const game = await configureGame(ownerId, clubCode, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const clubID = await getClubById(ownerId, clubCode);
    const gameID = await getGame(game.gameCode);
    const input = {
      clubId: clubID.id,
      playerId: playerID.id,
      gameId: gameID.id,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    try {
      const resp = await saveChipsData(input);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('Player sits in without club', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    const game = await configureGameByPlayer(ownerId, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const gameID = await getGame(game.gameCode);
    const input = {
      clubId: 0,
      playerId: playerID.id,
      gameId: gameID.id,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    try {
      const resp = await saveChipsData(input);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('Buy chips', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    const game = await configureGame(ownerId, clubCode, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const clubID = await getClubById(ownerId, clubCode);
    const gameID = await getGame(game.gameCode);
    const buyChips = {
      clubId: clubID.id,
      playerId: playerID.id,
      gameId: gameID.id,
      buyChips: 100.0,
    };
    //Try to buy chips without being a member
    try {
      const resp = await buyChipsData(buyChips);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(e.message).toBe('No data found');
    }
    const input = {
      clubId: clubID.id,
      playerId: playerID.id,
      gameId: gameID.id,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    //Creating a member
    try {
      const resp = await saveChipsData(input);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
    //Buy chips
    try {
      const resp = await buyChipsData(buyChips);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(e.message).toBe('No data found');
    }
  });

  test('Buy chips without club', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    const game = await configureGameByPlayer(ownerId, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const gameID = await getGame(game.gameCode);
    const buyChips = {
      clubId: 0,
      playerId: playerID.id,
      gameId: gameID.id,
      buyChips: 100.0,
    };
    //Try to buy chips without being a member
    try {
      const resp = await buyChipsData(buyChips);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(e.message).toBe('No data found');
    }
    const input = {
      clubId: 0,
      playerId: playerID.id,
      gameId: gameID.id,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    //Creating a member
    try {
      const resp = await saveChipsData(input);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
    //Buy chips
    try {
      const resp = await buyChipsData(buyChips);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(e.message).toBe('No data found');
    }
  });

  test('End Game', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    const game = await configureGame(ownerId, clubCode, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const clubID = await getClubById(ownerId, clubCode);
    const gameID = await getGame(game.gameCode);
    const input = {
      clubId: clubID.id,
      playerId: playerID.id,
      gameId: gameID.id,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    try {
      const resp = await saveChipsData(input);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
    try {
      const resp = await endGameData({club_id: clubID.id, game_id: gameID.id});
      logger.debug(resp);
      expect(resp).not.toBeNull();
      expect(resp).toBe(true);
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test('Track Club and Players game Balance', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    const game = await configureGame(ownerId, clubCode, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const clubID = await getClubById(ownerId, clubCode);
    const gameID = await getGame(game.gameCode);
    const input = {
      clubId: clubID.id,
      playerId: playerID.id,
      gameId: gameID.id,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    try {
      const resp = await saveChipsData(input);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
    const rake = await getRakeCollected(ownerId, game.gameCode);
    expect(rake).not.toBeUndefined();
  });

  test('Club and Player Balance', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    const game = await configureGame(ownerId, clubCode, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const clubID = await getClubById(ownerId, clubCode);
    const gameID = await getGame(game.gameCode);
    const input = {
      clubId: clubID.id,
      playerId: playerID.id,
      gameId: gameID.id,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    try {
      const resp = await saveChipsData(input);
      expect(resp).not.toBeNull();
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }

    await endGameData({club_id: clubID.id, game_id: gameID.id});
    const clubBalance = await getClubBalanceAmount(ownerId, {
      clubCode: clubCode,
    });
    const playerBalance = await getPlayerBalanceAmount(ownerId, {
      clubCode: clubCode,
      playerId: ownerId,
    });
    expect(clubBalance.balance).not.toBeNull();
    expect(clubBalance.balance).not.toBeUndefined();
    expect(clubBalance.balance).toBe(0);
    expect(playerBalance.balance).not.toBeNull();
    expect(playerBalance.balance).not.toBeUndefined();
    expect(playerBalance.balance).toBe(0);
  });

  test('Track Club and Players game Balance without club', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    const game = await configureGameByPlayer(ownerId, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const gameID = await getGame(game.gameCode);
    const input = {
      clubId: 0,
      playerId: playerID.id,
      gameId: gameID.id,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    await saveChipsData(input);

    const playerTrack = await getPlayerTrack(ownerId, {
      clubCode: '000000',
      playerId: ownerId,
      gameCode: game.gameCode,
    });
    const clubTrack = await getClubTrack(ownerId, {
      clubCode: '000000',
      gameCode: game.gameCode,
    });
    expect(playerTrack.stack).not.toBeUndefined();
    expect(playerTrack.stack).toBe(100);
    expect(clubTrack.rake).not.toBeNull();
    expect(clubTrack.rake).not.toBeUndefined();
    expect(clubTrack.rake).toBe(0);
  });

  test('End game without club', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    const game = await configureGameByPlayer(ownerId, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const gameID = await getGame(game.gameCode);
    const input = {
      clubId: 0,
      playerId: playerID.id,
      gameId: gameID.id,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    await saveChipsData(input);
    try {
      const resp = await endGameData({club_id: 0, game_id: gameID.id});
      logger.debug(resp);
      expect(resp).toBe(true);
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });
});
