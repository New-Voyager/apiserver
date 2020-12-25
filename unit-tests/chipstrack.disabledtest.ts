import {initializeSqlLite} from './utils';
import {createGameServer} from '../src/internal/gameserver';
import {
  configureGame,
  configureGameByPlayer,
  endGame,
} from '../src/resolvers/game';
import {
  getClubBalanceAmount,
  getRakeCollected,
  getPlayerBalanceAmount,
} from '../src/resolvers/chipstrack';
import {getClubById, createClub} from '../src/resolvers/club';
import {saveReward} from '../src/resolvers/reward';
import {getPlayerById, createPlayer} from '../src/resolvers/player';
import {getGame} from '../src/cache/index';

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
  rewardIds: [] as any,
};

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

async function createReward(playerId, clubCode) {
  const rewardInput = {
    amount: 100.4,
    endHour: 4,
    minRank: 1,
    name: 'brady',
    startHour: 4,
    type: 'HIGH_HAND',
    schedule: 'HOURLY',
  };
  const resp = await saveReward(playerId, clubCode, rewardInput);
  holdemGameInput.rewardIds.splice(0);
  holdemGameInput.rewardIds.push(resp);
}

describe('Player Chips tracking APIs', () => {
  // TODO:
  // 1. End game
  // 2. Player and club - game balance
  // 3. Player and club balance
  test.skip('End Game', async () => {
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
    await createReward(ownerId, clubCode);
    const game = await configureGame(ownerId, clubCode, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const clubID = await getClubById(ownerId, clubCode);
    const gameID = await getGame(game.gameCode);
    // const input = {
    //   clubId: clubID.id,
    //   playerId: playerID.id,
    //   gameId: gameID.id,
    //   buyIn: 100.0,
    //   status: 'PLAYING',
    //   seatNo: 5,
    // };
    // try {
    //   const resp = await saveChipsData(input);
    //   expect(resp).not.toBeNull();
    // } catch (e) {
    //   logger.error(JSON.stringify(e));
    //   expect(true).toBeFalsy();
    // }
    try {
      const resp = await endGame(ownerId, game.gameCode);
      logger.debug(resp);
      expect(resp).not.toBeNull();
      expect(resp).toBe(true);
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Track Club and Players game Balance', async () => {
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
    await createReward(ownerId, clubCode);
    const game = await configureGame(ownerId, clubCode, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const clubID = await getClubById(ownerId, clubCode);
    const gameID = await getGame(game.gameCode);
    // const input = {
    //   clubId: clubID.id,
    //   playerId: playerID.id,
    //   gameId: gameID.id,
    //   buyIn: 100.0,
    //   status: 'PLAYING',
    //   seatNo: 5,
    // };
    // try {
    //   const resp = await saveChipsData(input);
    //   expect(resp).not.toBeNull();
    // } catch (e) {
    //   logger.error(JSON.stringify(e));
    //   expect(true).toBeFalsy();
    // }
    const rake = await getRakeCollected(ownerId, game.gameCode);
    expect(rake).not.toBeUndefined();
  });

  test.skip('Club and Player Balance', async () => {
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
    await createReward(ownerId, clubCode);
    const game = await configureGame(ownerId, clubCode, holdemGameInput);

    const playerID = await getPlayerById(ownerId);
    const clubID = await getClubById(ownerId, clubCode);
    const gameID = await getGame(game.gameCode);
    // const input = {
    //   clubId: clubID.id,
    //   playerId: playerID.id,
    //   gameId: gameID.id,
    //   buyIn: 100.0,
    //   status: 'PLAYING',
    //   seatNo: 5,
    // };
    // try {
    //   const resp = await saveChipsData(input);
    //   expect(resp).not.toBeNull();
    // } catch (e) {
    //   logger.error(JSON.stringify(e));
    //   expect(true).toBeFalsy();
    // }

    await endGame(ownerId, game.gameCode);
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

  test.skip('End game without club', async () => {
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
    // const input = {
    //   clubId: 0,
    //   playerId: playerID.id,
    //   gameId: gameID.id,
    //   buyIn: 100.0,
    //   status: 'PLAYING',
    //   seatNo: 5,
    // };
    // await saveChipsData(input);
    try {
      const resp = await endGame(ownerId, game.gameCode);
      logger.debug(resp);
      expect(resp).toBe(true);
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }
  });
});
