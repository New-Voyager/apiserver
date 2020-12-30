import {resetDatabase, getClient, PORT_NUMBER} from './utils/utils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import * as handutils from './utils/hand.testutils';
import * as rewardutils from './utils/reward.testutils';
import {default as axios} from 'axios';
import {getLogger} from '../src/utils/log';
const logger = getLogger('game');

beforeAll(async done => {
  await resetDatabase();
  done();
});

afterAll(async done => {
  //await server.stop();
  done();
});

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
  waitlistSittingTimeout: 5,
  rewardIds: [] as any,
};

async function saveReward(playerId, clubCode) {
  const rewardInput = {
    amount: 100.4,
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

const GAMESERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

describe('Tests: waitlist seating APIs', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('wait list seating APIs', async () => {
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

    // add player 4&5 to waitlist
    const resp1 = await gameutils.addToWaitingList(players[3], game.gameCode);
    expect(resp1).toBe(true);
    const resp2 = await gameutils.addToWaitingList(players[4], game.gameCode);
    expect(resp2).toBe(true);

    // verify waitlist count
    const waitlist1 = await gameutils.waitingList(ownerId, game.gameCode);
    expect(waitlist1).toHaveLength(2);
    waitlist1.forEach(element => {
      expect(element.status).toBe('IN_QUEUE');
    });

    // remove player 4 from wailist
    const resp3 = await gameutils.removeFromWaitingList(
      players[4],
      game.gameCode
    );
    expect(resp3).toBe(true);

    // verify waitlist count
    const waitlist2 = await gameutils.waitingList(ownerId, game.gameCode);
    expect(waitlist2).toHaveLength(1);
    expect(waitlist2[0].status).toBe('IN_QUEUE');
  });

  test('wait list seating - success case', async () => {
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

    // add player 4&5 to waitlist
    const resp1 = await gameutils.addToWaitingList(players[3], game.gameCode);
    expect(resp1).toBe(true);
    const resp2 = await gameutils.addToWaitingList(players[4], game.gameCode);
    expect(resp2).toBe(true);

    // verify waitlist count
    const waitlist1 = await gameutils.waitingList(ownerId, game.gameCode);
    expect(waitlist1).toHaveLength(2);
    waitlist1.forEach(element => {
      expect(element.status).toBe('IN_QUEUE');
    });

    const resp3 = await gameutils.leaveGame(players[0], game.gameCode);
    expect(resp3).toBe(true);

    try {
      const gameId = await gameutils.getGameById(game.gameCode);
      await axios.post(
        `${GAMESERVER_API}/process-pending-updates/gameId/${gameId}`
      );
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }

    // verify waitlist count
    const waitlist2 = await gameutils.waitingList(ownerId, game.gameCode);
    expect(waitlist2).toHaveLength(2);
    waitlist2.forEach(element => {
      if (element.playerUuid === players[3]) {
        expect(element.status).toBe('WAITLIST_SEATING');
      } else {
        expect(element.status).toBe('IN_QUEUE');
      }
    });

    try {
      await gameutils.joinGame(players[4], game.gameCode, 1);
      expect(true).toBeFalsy();
    } catch (error) {
      logger.error(JSON.stringify(error));
    }

    const resp = await gameutils.joinGame(players[3], game.gameCode, 1);
    expect(resp).toBe('WAIT_FOR_BUYIN');
  });

  test('wait list seating - timeout case', async () => {
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

    // add player 4&5 to waitlist
    const resp1 = await gameutils.addToWaitingList(players[3], game.gameCode);
    expect(resp1).toBe(true);
    const resp2 = await gameutils.addToWaitingList(players[4], game.gameCode);
    expect(resp2).toBe(true);

    // verify waitlist count
    const waitlist1 = await gameutils.waitingList(ownerId, game.gameCode);
    expect(waitlist1).toHaveLength(2);
    waitlist1.forEach(element => {
      expect(element.status).toBe('IN_QUEUE');
    });

    const resp3 = await gameutils.leaveGame(players[0], game.gameCode);
    expect(resp3).toBe(true);

    const gameId = await gameutils.getGameById(game.gameCode);
    try {
      await axios.post(
        `${GAMESERVER_API}/process-pending-updates/gameId/${gameId}`
      );
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }

    // verify waitlist count
    const waitlist2 = await gameutils.waitingList(ownerId, game.gameCode);
    expect(waitlist2).toHaveLength(2);
    waitlist2.forEach(element => {
      if (element.playerUuid === players[3]) {
        expect(element.status).toBe('WAITLIST_SEATING');
      } else {
        expect(element.status).toBe('IN_QUEUE');
      }
    });

    // wait for 6 seconds
    await sleep(6000);

    // call waitlistTimeoutExpired
    const hostId = await handutils.getPlayerById(ownerId);
    try {
      await axios.post(
        `${GAMESERVER_API}/timer-callback/gameId/${gameId}/playerId/${hostId}/purpose/WAITLIST_SEATING`
      );
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }

    // verify wailist count and status
    const waitlist3 = await gameutils.waitingList(ownerId, game.gameCode);
    expect(waitlist3).toHaveLength(1);
    expect(waitlist3[0].playerUuid).not.toBe(players[3]);
    expect(waitlist3[0].playerUuid).toBe(players[4]);
    expect(waitlist3[0].status).toBe('WAITLIST_SEATING');
  });
});
