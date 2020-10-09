import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import * as clubutils from './utils/club.testutils';
import * as chipstrackutils from './utils/chipstrack.testutils';
import * as handutils from './utils/hand.testutils';
import {resetDatabase, getClient} from './utils/utils';
import * as gameutils from './utils/game.testutils';
import {getLogger} from '../src/utils/log';
const logger = getLogger('chipstrack');
import {ChipsTrackRepository} from '../src/repositories/chipstrack';

const SERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

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
  await resetDatabase();
  done();
});

afterAll(async done => {
  done();
});

describe('Player Chips tracking APIs', () => {
  test('Create a player chips tracker when player sits in', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    let game, resp;

    game = await gameutils.startGame(playerId, clubCode, holdemGameInput);

    const playerID = await handutils.getPlayerById(playerId);
    const clubID = await clubutils.getClubById(clubCode);
    const gameID = await gameutils.getGameById(game.gameCode);

    const messageInput = {
      clubId: clubID,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };

    try {
      resp = await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
    } catch (err) {
      console.error(JSON.stringify(err));
    }
    expect(resp.status).toBe(200);
    const id = resp.data.id;
    expect(id).not.toBe(null);
    expect(id).not.toBe(undefined);
    expect(id.buyIn).toBe(100.0);
    expect(id.status).toBe(1);
    expect(id.stack).toBe(100.0);
    expect(id.seatNo).toBe(5);
    expect(id.hhRank).toBe(0);
    expect(id.hhHandNum).toBe(0);
  });

  test('Player sits in without club', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.2',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    } catch (err) {
      console.log(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const playerUuid = await clubutils.createPlayer('player1', 'abc123');

    let resp;

    const game = await gameutils.startFriendsGame(playerUuid, holdemGameInput);

    const playerID = await handutils.getPlayerById(playerUuid);
    const gameID = await gameutils.getGameById(game.gameCode);

    const messageInput = {
      clubId: 0,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };

    try {
      resp = await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
    } catch (err) {
      console.log(JSON.stringify(err));
    }
    expect(resp.status).toBe(200);
    const id = resp.data.id;
    expect(id).not.toBe(null);
    expect(id).not.toBe(undefined);
    expect(id.buyIn).toBe(100.0);
    expect(id.status).toBe(1);
    expect(id.stack).toBe(100.0);
    expect(id.seatNo).toBe(5);
    expect(id.hhRank).toBe(0);
    expect(id.hhHandNum).toBe(0);
  });

  test('Buy chips', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.3',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    let game, resp, response;

    game = await gameutils.startGame(playerId, clubId, holdemGameInput);

    const playerID = await handutils.getPlayerById(playerId);
    const clubID = await clubutils.getClubById(clubId);
    const gameID = await gameutils.getGameById(game.gameCode);

    const messageInput = {
      clubId: clubID,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };

    const buyChips = {
      clubId: clubID,
      playerId: playerID,
      gameId: gameID,
      buyChips: 100.0,
    };

    try {
      resp = await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
      response = await axios.post(`${SERVER_API}/buy-chips`, buyChips);
    } catch (err) {
      logger.error(JSON.stringify(err));
    }

    expect(response.status).toBe(200);
    const id = response.data.id;
    expect(id).not.toBe(null);
    expect(id).not.toBe(undefined);
    expect(id.buyIn).toBe(200.0);
    expect(id.status).toBe(1);
    expect(id.stack).toBe(200.0);
    expect(id.noOfBuyins).toBe(2);
    expect(id.seatNo).toBe(5);
    expect(id.hhRank).toBe(0);
    expect(id.hhHandNum).toBe(0);
  });

  test('Buy chips without club', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.4',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const playerUuid = await clubutils.createPlayer('player1', 'abc123');

    let resp, response;

    const game = await gameutils.startFriendsGame(playerUuid, holdemGameInput);

    const playerID = await handutils.getPlayerById(playerUuid);
    const gameID = await gameutils.getGameById(game.gameCode);

    const messageInput = {
      clubId: 0,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };

    const buyChips = {
      clubId: 0,
      playerId: playerID,
      gameId: gameID,
      buyChips: 100.0,
    };

    try {
      resp = await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
      response = await axios.post(`${SERVER_API}/buy-chips`, buyChips);
    } catch (err) {
      logger.error(JSON.stringify(err));
    }

    expect(response.status).toBe(200);
    const id = response.data.id;
    expect(id).not.toBe(null);
    expect(id).not.toBe(undefined);
    expect(id.buyIn).toBe(200.0);
    expect(id.status).toBe(1);
    expect(id.stack).toBe(200.0);
    expect(id.noOfBuyins).toBe(2);
    expect(id.seatNo).toBe(5);
    expect(id.hhRank).toBe(0);
    expect(id.hhHandNum).toBe(0);
  });

  test('End Game', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.5',
      currentMemory: 100,
      status: 'ACTIVE',
    };

    await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    const game = await gameutils.startGame(playerId, clubCode, holdemGameInput);
    const playerID = await handutils.getPlayerById(playerId);
    const clubID = await clubutils.getClubById(clubCode);
    const gameID = await gameutils.getGameById(game.gameCode);

    const messageInput = {
      clubId: clubID,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };
    await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
    const res = await axios.post(`${SERVER_API}/game-ended`, {
      club_id: clubID,
      game_id: gameID,
    });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('OK');
    expect(res.data.data).toBe(true);
  });

  test('Track Club and Players game Balance', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.6',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    let game;

    game = await gameutils.startGame(playerId, clubCode, holdemGameInput);

    const playerID = await handutils.getPlayerById(playerId);
    const clubID = await clubutils.getClubById(clubCode);
    const gameID = await gameutils.getGameById(game.gameCode);

    const messageInput = {
      clubId: clubID,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };

    await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
    const playertrack = await chipstrackutils.getPlayerTrack(
      playerId,
      clubCode,
      game.gameCode
    );
    const clubTrack = await chipstrackutils.getClubTrack(
      playerId,
      clubCode,
      game.gameCode
    );
    expect(playertrack).not.toBeNull();
    expect(playertrack).not.toBeUndefined();
    expect(playertrack).toBe(100);
    expect(clubTrack).not.toBeNull();
    expect(clubTrack).not.toBeUndefined();
    expect(clubTrack).toBe(0);
  });

  test('Club and Player Balance', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.7',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    let game;

    game = await gameutils.startGame(playerId, clubCode, holdemGameInput);

    const playerID = await handutils.getPlayerById(playerId);
    const clubID = await clubutils.getClubById(clubCode);
    const gameID = await gameutils.getGameById(game.gameCode);

    const messageInput = {
      clubId: clubID,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };

    await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
    const res = await axios.post(`${SERVER_API}/game-ended`, {
      club_id: clubID,
      game_id: gameID,
    });
    const clubBalance = await chipstrackutils.getClubBalance(
      playerId,
      clubCode
    );
    const playerBalance = await chipstrackutils.getClubPlayerBalance(
      playerId,
      clubCode
    );
    expect(clubBalance).not.toBeNull();
    expect(clubBalance).not.toBeUndefined();
    expect(clubBalance).toBe(0);
    expect(playerBalance).not.toBeNull();
    expect(playerBalance).not.toBeUndefined();
    expect(playerBalance).toBe(0);
  });

  test('Track Club and Players game Balance without club', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.8',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    const playerUuid = await clubutils.createPlayer('player1', 'abc123');
    const game = await gameutils.startFriendsGame(playerUuid, holdemGameInput);
    const playerID = await handutils.getPlayerById(playerUuid);
    const gameID = await gameutils.getGameById(game.gameCode);

    const messageInput = {
      clubId: 0,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };

    await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
    const playertrack = await chipstrackutils.getPlayerTrack(
      playerUuid,
      '000000',
      game.gameCode
    );
    const clubTrack = await chipstrackutils.getClubTrack(
      playerUuid,
      '000000',
      game.gameCode
    );
    expect(playertrack).not.toBeNull();
    expect(playertrack).not.toBeUndefined();
    expect(playertrack).toBe(100);
    expect(clubTrack).not.toBeNull();
    expect(clubTrack).not.toBeUndefined();
    expect(clubTrack).toBe(0);
  });

  test('End Game without club', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.9',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    const playerUuid = await clubutils.createPlayer('player1', 'abc123');
    const game = await gameutils.startFriendsGame(playerUuid, holdemGameInput);
    const playerID = await handutils.getPlayerById(playerUuid);
    const gameID = await gameutils.getGameById(game.gameCode);

    const messageInput = {
      clubId: 0,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };

    await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
    const res = await axios.post(`${SERVER_API}/game-ended`, {
      club_id: 0,
      game_id: gameID,
    });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('OK');
    expect(res.data.data).toBe(true);
  });
});
