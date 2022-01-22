import {
  resetDatabase,
  getClient,
  INTERNAL_PORT,
  startGqlServer,
  setupGameEnvironment,
  createClubWithMembers,
} from '../utils/utils';
import * as glob from 'glob';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils';
import * as handutils from '../utils/hand.testutils';
import * as rewardutils from '../utils/reward.testutils';
import {default as axios} from 'axios';
import {getLogger} from '../../src/utils/log';
import {autoReload, buyIn, reload, startGame} from '../game/utils';
import { defaultHandData } from '../utils/hand.testutils';
import _ from 'lodash';
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

// default player, game and club inputs
const ownerInput = {
  name: 'player_name',
  deviceId: 'abc123',
};

const clubInput = {
  name: 'club_name',
  description: 'poker players gather',
};

const playersInput = [
  {
    name: 'player_name1',
    deviceId: 'abc1234',
  },
  {
    name: 'player_3',
    deviceId: 'abc123456',
  },
  {
    name: 'john',
    deviceId: 'abc1235',
  },
];

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

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const GAMESERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

describe('Tests: Reload API', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });

  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  // game is started, the approval happens in the pending process workflow
  test('auto-reload-test', async () => {
    //    test('reload auto approval, game did not start', async () => {
    // Create club and owner
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      GAMESERVER_API,
      owner,
      clubCode,
      playerUuids,
      holdemGameInput,
    );


    await autoReload({playerId: playerUuids[0], gameCode: gameCode, lowThreshold: 50, reloadTo: 100});

    // post a hand
    const directory = 'hand-results/reload';
    const files = await glob.sync('**/*.json', {
      onlyFiles: false,
      cwd: 'hand-results/reload',
      deep: 5,
    });

    for await (const file of files) {
      const filename = directory + '/' + file;
      const data = await defaultHandData(
        filename,
        gameId,
        //rewardTrackId,
        playerIds
      );
      await axios.post(
        `${GAMESERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
        data
      );
    }
    // verify player's stack
    let gameInfo = await gameutils.gameInfo(owner, gameCode);
    let playersByIds = _.keyBy(gameInfo.seatInfo.playersInSeats, 'playerId');
    console.log(JSON.stringify(gameInfo));
    let reloadPlayer = playersByIds[playerIds[0]];
    expect(reloadPlayer.stack).toEqual(49);

    // // the stack should be still 100
    // let seats = gameInfo.seatInfo.playersInSeats;
    // for (const seat of seats) {
    //   if (seat.seatNo === 1) {
    //     expect(seat.stack).toBe(100);
    //   }
    // }


    // process pending updates
    try {
      const gameId = await gameutils.getGameById(gameCode);
      await axios.post(
        `${GAMESERVER_API}/process-pending-updates/gameId/${gameId}`
      );
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    gameInfo = await gameutils.gameInfo(owner, gameCode);
    playersByIds = _.keyBy(gameInfo.seatInfo.playersInSeats, 'playerId');
    console.log(JSON.stringify(gameInfo));
    reloadPlayer = playersByIds[playerIds[0]];
    expect(reloadPlayer.stack).toEqual(100);

    // gameInfo = await gameutils.gameInfo(players[0], game.gameCode);
    // console.log(JSON.stringify(gameInfo));

    // // the stack will be 200
    // seats = gameInfo.seatInfo.playersInSeats;
    // for (const seat of seats) {
    //   if (seat.seatNo === 1) {
    //     expect(seat.stack).toBe(200);
    //   }
    // }
  });
});
