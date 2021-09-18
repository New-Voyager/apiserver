import {resetDatabase, getClient, INTERNAL_PORT, startGqlServer} from './utils/utils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import * as handutils from './utils/hand.testutils';
import * as rewardutils from './utils/reward.testutils';
import {default as axios} from 'axios';
import {getLogger} from '../src/utils/log';
const logger = getLogger('game');

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
  buyInApproval: false,
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistAllowed: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 600,
  actionTime: 30,
  muckLosingHand: true,
  waitlistSittingTimeout: 5,
  rewardIds: [] as any,
};

async function saveReward(playerId, clubCode) {
  const rewardInput = {
    amount: 100,
    endHour: 4,
    minRank: 1,
    name: 'brady',
    startHour: 4,
    type: 'HIGH_HAND',
    schedule: 'HOURLY',
  };
  const rewardId = await getClient(playerId).mutate({
    variables: {
      clubCode: clubCode,
      input: rewardInput,
    },
    mutation: rewardutils.createReward,
  });
  holdemGameInput.rewardIds.splice(0);
  holdemGameInput.rewardIds.push(rewardId.data.rewardId);
}

async function createGameServer(ipAddress: string) {
  const gameServer1 = {
    ipAddress: ipAddress,
    currentMemory: 100,
    status: 'ACTIVE',
    url: `http://${ipAddress}:8080/`,
  };
  try {
    await axios.post(`${GAMESERVER_API}/register-game-server`, gameServer1);
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

async function createClubWithMembers(
  players: Array<any>
): Promise<[string, string, Array<string>]> {
  const [clubCode, ownerUuid] = await clubutils.createClub('brady', 'yatzee');
  await createGameServer('1.2.0.7');
  await saveReward(ownerUuid, clubCode);
  const playerUuids = new Array<string>();
  for (const playerInput of players) {
    const playerUuid = await clubutils.createPlayer(
      playerInput.name,
      playerInput.devId
    );
    await clubutils.playerJoinsClub(clubCode, playerUuid);
    await clubutils.approvePlayer(clubCode, ownerUuid, playerUuid);
    playerUuids.push(playerUuid);
  }
  return [ownerUuid, clubCode, playerUuids];
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const GAMESERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

describe('Tests: Reload API', () => {
  let stop, graphql;

  beforeAll(async done => {
    const testServer = await startGqlServer();
    stop = testServer.stop;
    graphql = testServer.graphql;
    await resetDatabase();
    done();
  });
  
  afterAll(async done => {
     stop();
     done();
  });

  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test.skip('reload-test1', async () => {
    //    test('reload auto approval, game did not start', async () => {
    // Create club and owner
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'player1',
        devId: 'test321',
      },
      {
        name: 'player2',
        devId: 'test322',
      },
      {
        name: 'player3',
        devId: 'test323',
      },
      {
        name: 'player4',
        devId: 'test324',
      },
      {
        name: 'player5',
        devId: 'test325',
      },
    ]);

    // create gameserver and game
    const gameInput = holdemGameInput;
    gameInput.maxPlayers = 3;
    gameInput.minPlayers = 2;
    const game = await gameutils.configureGame(ownerId, clubCode, gameInput);
    //await gameutils.startGame(ownerId, game.gameCode);

    // join a game
    await gameutils.joinGame(players[0], game.gameCode, 1);
    await gameutils.joinGame(players[1], game.gameCode, 2);
    await gameutils.joinGame(players[2], game.gameCode, 3);

    // buyin
    await gameutils.buyin(players[0], game.gameCode, 100);
    await gameutils.buyin(players[1], game.gameCode, 100);
    await gameutils.buyin(players[2], game.gameCode, 100);

    // reload game
    await gameutils.reload(players[0], game.gameCode, 50);
    const gameInfo = await gameutils.gameInfo(players[0], game.gameCode);
    console.log(JSON.stringify(gameInfo));

    const seats = gameInfo.seatInfo.playersInSeats;
    for (const seat of seats) {
      if (seat.seatNo === 1) {
        expect(seat.stack).toBe(600);
      }
    }
  });

  // reload should not exceed the max buyin
  test('reload-test2', async () => {
    //    test('reload auto approval, game did not start', async () => {
    // Create club and owner
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'player1',
        devId: 'test321',
      },
      {
        name: 'player2',
        devId: 'test322',
      },
      {
        name: 'player3',
        devId: 'test323',
      },
      {
        name: 'player4',
        devId: 'test324',
      },
      {
        name: 'player5',
        devId: 'test325',
      },
    ]);

    // create gameserver and game
    const gameInput = holdemGameInput;
    gameInput.maxPlayers = 3;
    gameInput.minPlayers = 2;
    const game = await gameutils.configureGame(ownerId, clubCode, gameInput);

    // join a game
    await gameutils.joinGame(players[0], game.gameCode, 1);
    await gameutils.joinGame(players[1], game.gameCode, 2);
    await gameutils.joinGame(players[2], game.gameCode, 3);

    // buyin
    await gameutils.buyin(players[0], game.gameCode, 100);
    await gameutils.buyin(players[1], game.gameCode, 100);
    await gameutils.buyin(players[2], game.gameCode, 100);

    // reload game
    await gameutils.reload(players[0], game.gameCode, 800);
    const gameInfo = await gameutils.gameInfo(players[0], game.gameCode);
    console.log(JSON.stringify(gameInfo));

    const seats = gameInfo.seatInfo.playersInSeats;
    for (const seat of seats) {
      if (seat.seatNo === 1) {
        expect(seat.stack).toBe(600);
      }
    }
  });

  // game is started, the approval happens in the pending process workflow
  test('reload-test3', async () => {
    //    test('reload auto approval, game did not start', async () => {
    // Create club and owner
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'player1',
        devId: 'test321',
      },
      {
        name: 'player2',
        devId: 'test322',
      },
      {
        name: 'player3',
        devId: 'test323',
      },
      {
        name: 'player4',
        devId: 'test324',
      },
      {
        name: 'player5',
        devId: 'test325',
      },
    ]);

    // create gameserver and game
    const gameInput = holdemGameInput;
    gameInput.maxPlayers = 3;
    gameInput.minPlayers = 2;
    const game = await gameutils.configureGame(ownerId, clubCode, gameInput);
    await gameutils.startGame(ownerId, game.gameCode);

    // join a game
    await gameutils.joinGame(players[0], game.gameCode, 1);
    await gameutils.joinGame(players[1], game.gameCode, 2);
    await gameutils.joinGame(players[2], game.gameCode, 3);

    // buyin
    await gameutils.buyin(players[0], game.gameCode, 100);
    await gameutils.buyin(players[1], game.gameCode, 100);
    await gameutils.buyin(players[2], game.gameCode, 100);
    await gameutils.startGame(ownerId, game.gameCode);

    // reload
    await gameutils.reload(players[0], game.gameCode, 100);
    let gameInfo = await gameutils.gameInfo(players[0], game.gameCode);
    console.log(JSON.stringify(gameInfo));

    // the stack should be still 100
    let seats = gameInfo.seatInfo.playersInSeats;
    for (const seat of seats) {
      if (seat.seatNo === 1) {
        expect(seat.stack).toBe(100);
      }
    }

    // process pending updates
    try {
      const gameId = await gameutils.getGameById(game.gameCode);
      await axios.post(
        `${GAMESERVER_API}/process-pending-updates/gameId/${gameId}`
      );
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }

    gameInfo = await gameutils.gameInfo(players[0], game.gameCode);
    console.log(JSON.stringify(gameInfo));

    // the stack will be 200
    seats = gameInfo.seatInfo.playersInSeats;
    for (const seat of seats) {
      if (seat.seatNo === 1) {
        expect(seat.stack).toBe(200);
      }
    }
  });
});
