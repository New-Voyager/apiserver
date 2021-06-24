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

const GAMESERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

describe('Tests: seat change APIs', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('seat change functionality', async () => {
    // Create club and owner
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'player1',
        devId: 'test321',
      },
    ]);
    const player1 = ownerId;
    const player2 = players[0];

    // create gameserver and game
    const gameInput = holdemGameInput;
    gameInput.maxPlayers = 3;
    gameInput.minPlayers = 2;
    gameInput.buyInApproval = false;
    const game = await gameutils.configureGame(ownerId, clubCode, gameInput);

    // join a game
    await gameutils.joinGame(player1, game.gameCode, 1);
    await gameutils.joinGame(player2, game.gameCode, 2);

    // buyin
    await gameutils.buyin(player1, game.gameCode, 100);
    await gameutils.buyin(player2, game.gameCode, 100);

    await gameutils.startGame(ownerId, game.gameCode);

    // request seat change
    const resp1 = await gameutils.requestSeatChange(player1, game.gameCode);
    expect(resp1).not.toBeNull();
    const resp2 = await gameutils.requestSeatChange(player2, game.gameCode);
    expect(resp2).not.toBeNull();

    // get all requested seat changes
    const resp3 = await gameutils.seatChangeRequests(ownerId, game.gameCode);
    expect(resp3).toHaveLength(2);

    // confirm seat change
    const resp4 = await gameutils.confirmSeatChange(player1, game.gameCode, 3);
    expect(resp4).toBe(true);
    const resp5 = await gameutils.confirmSeatChange(player2, game.gameCode, 3);
    expect(resp5).toBe(true);

    // wait for 6 seconds
    await sleep(6000);

    // call waitlistTimeoutExpired
    const gameId = await gameutils.getGameById(game.gameCode);
    const hostId = await handutils.getPlayerById(ownerId);
    try {
      await axios.post(
        `${GAMESERVER_API}/timer-callback/gameId/${gameId}/playerId/${hostId}/purpose/SEATCHANGE_INPROGRESS`
      );
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }

    // get all requested seat changes
    const resp6 = await gameutils.seatChangeRequests(ownerId, game.gameCode);
    expect(resp6).toHaveLength(1);
    expect(resp6[0].playerUuid).toBe(player2);
  });
});
