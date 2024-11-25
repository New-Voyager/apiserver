import {initializeSqlLite} from './utils';
import {getLogger} from '../src/utils/log';
import {resetDB} from '../src/dev/resolvers/reset';
import {GameRepository} from '../src/repositories/game';
import {AppCoinRepository} from '../src/repositories/appcoin';
import {processPendingUpdates} from '../src/repositories/pendingupdates';
import {createPlayer, getPlayerById} from '../src/resolvers/player';
import {
  approveMember,
  createClub,
  getClubById,
  joinClub,
} from '../src/resolvers/club';
import {createGameServer} from '../src/internal/gameserver';
import {configureGame, startGame} from '../src/resolvers/game';
import {buyIn, joinGame} from '../src/resolvers/playersingame';
import {saveReward} from '../src/resolvers/reward';
import {saveHand} from '../src/internal/hand';
import * as fs from 'fs';
import * as glob from 'glob';
import _ from 'lodash';
import {getAppSettings} from '../src/firebase/index';
import {BuyInApprovalLimit, GameStatus, TableStatus} from '../src/entity/types';

const logger = getLogger('Hand server unit-test');

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
    name: 'tom',
    deviceId: 'abc1234',
  },
  {
    name: 'yong',
    deviceId: 'abc123456',
  },
  {
    name: 'brian',
    deviceId: 'abc1234567',
  },
  {
    name: 'yong',
    deviceId: 'abc12345678',
  },
  {
    name: 'john',
    deviceId: 'abc1235',
  },
];

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
  buyInLimit: BuyInApprovalLimit.BUYIN_NO_LIMIT,
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
  rewardIds: [] as any,
  appCoinsNeeded: true,
};

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

async function createReward1(playerId, clubCode) {
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
  return resp;
}

async function createClubWithMembers(
  ownerInput: any,
  clubInput: any,
  players: Array<any>
): Promise<[string, string, number, Array<string>, Array<number>]> {
  const ownerUuid = await createPlayer({player: ownerInput});
  clubInput.ownerUuid = ownerUuid;
  const clubCode = await createClub(ownerUuid, clubInput);
  const clubId = await getClubById(ownerUuid, clubCode);
  const playerUuids = new Array<string>();
  const playerIds = new Array<number>();
  for (const playerInput of players) {
    const playerUuid = await createPlayer({player: playerInput});
    const playerId = (await getPlayerById(playerUuid)).id;
    await joinClub(playerUuid, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid);
    playerUuids.push(playerUuid);
    playerIds.push(playerId);
  }
  return [ownerUuid, clubCode, clubId, playerUuids, playerIds];
}

async function setupGameEnvironment(
  owner: string,
  club: string,
  players: Array<string>,
  buyin: number
): Promise<[string, number]> {
  const gameServer = {
    ipAddress: '10.1.1.1',
    currentMemory: 100,
    status: 'ACTIVE',
    url: 'htto://localhost:8080',
  };
  await createGameServer(gameServer);
  const game = await configureGame(owner, club, holdemGameInput);
  let i = 1;
  for await (const player of players) {
    await joinGame(player, game.gameCode, i);
    await buyIn(player, game.gameCode, buyin);
    i++;
  }
  await startGame(owner, game.gameCode);
  return [game.gameCode, game.id];
}

async function defaultHandData(
  file: string,
  gameId: number,
  //rewardId: any,
  playerIds: Array<number>
) {
  const obj = await fs.readFileSync(file, 'utf8');
  const data = JSON.parse(obj);
  data.gameId = gameId.toString();
  //data.rewardTrackingIds.splice(0);
  //data.rewardTrackingIds.push(rewardId);
  const players = data.result.playerInfo;
  const replacedIds: any = {};
  replacedIds[players['1'].id] = playerIds[0];
  players['1'].id = playerIds[0].toString();

  data.gameId = gameId.toString();
  replacedIds[players['5'].id] = playerIds[1];
  players['5'].id = playerIds[1].toString();

  data.gameId = gameId.toString();
  replacedIds[players['8'].id] = playerIds[2];
  players['8'].id = playerIds[2].toString();
  
  for (const oldId of Object.keys(replacedIds)) {
    const newId = replacedIds[oldId];
    data.result.playerStats[newId] = data.result.playerStats[oldId];
    delete data.result.playerStats[oldId];
  }
  return data;
}

describe.skip('Appcoin tests', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  // coin consumption time: 15 seconds
  // free time: 15 seconds
  // after free time, we give extra free 15 seconds to let the host buy coins
  // in this case, the host does not buy any app coins
  test.skip('AppCoin: host does not buy coins', async () => {
    // setup server configuration
    const config = getAppSettings();
    config.consumeTime = 15; // charge every 15 seconds
    config.newUserFreeCoins = 0;
    let nextHandNum = 1;

    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100
    );

    const dir = 'hand-results/app-coin';
    const files = await glob.sync('**/*.json', {
      onlyFiles: false,
      cwd: dir,
      deep: 1,
    });
    const firstFile = files[0];
    const data = await defaultHandData(
      dir + '/' + firstFile,
      gameId,
      //rewardTrackId,
      playerIds
    );
    // we are going to post multiple hands
    data.handNum = nextHandNum++;
    let resp = await saveHand(gameId, data.handNum, data);
    let pendingUpdates = await GameRepository.anyPendingUpdates(gameId);
    expect(pendingUpdates).toBeFalsy();
    await sleep(10000);
    data.handNum = nextHandNum++;
    resp = await saveHand(gameId, data.handNum, data);
    pendingUpdates = await GameRepository.anyPendingUpdates(gameId);
    expect(pendingUpdates).toBeFalsy();        
    await sleep(10000);
    data.handNum = nextHandNum++;
    resp = await saveHand(gameId, data.handNum, data);
    pendingUpdates = await GameRepository.anyPendingUpdates(gameId);
    expect(pendingUpdates).toBeFalsy();        
    await sleep(10000);

    data.handNum = nextHandNum++;
    resp = await saveHand(gameId, data.handNum, data);
    pendingUpdates = await GameRepository.anyPendingUpdates(gameId);
    expect(pendingUpdates).toBeTruthy();
    // game should have ended here
    await processPendingUpdates(gameId);

    // get game status
    const game = await GameRepository.getGameByCode(gameCode);
    if (game) {
      const gameStatus = game.status;
      expect(gameStatus).toEqual(GameStatus.ENDED);
    }
    expect(game).not.toBeUndefined();
    expect(game).not.toBeNull();
  });

  test.skip('AppCoin: host buys coins after warning', async () => {
    // setup server configuration
    const config = getAppSettings();
    config.consumeTime = 5; // charge every 15 seconds
    config.gameCoinsPerBlock = 3; // charge 3 coins per block of game time
    config.notifyHostTimeWindow = 8; // notify host window after 5 seconds
    let nextHandNum = 1;

    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100
    );
    
    const dir = 'hand-results/app-coin';
    const files = await glob.sync('**/*.json', {
      onlyFiles: false,
      cwd: dir,
      deep: 1,
    });
    const firstFile = files[0];
    const data = await defaultHandData(
      dir + '/' + firstFile,
      gameId,
      //rewardTrackId,
      playerIds
    );
    // we are going to post multiple hands
    data.handNum = nextHandNum++;
    let resp = await saveHand(gameId, data.handNum, data);
    let pendingUpdates = await GameRepository.anyPendingUpdates(gameId);
    expect(pendingUpdates).toBeFalsy();
    await sleep(5000);
    data.handNum = nextHandNum++;
    resp = await saveHand(gameId, data.handNum, data);
    pendingUpdates = await GameRepository.anyPendingUpdates(gameId);
    expect(pendingUpdates).toBeFalsy();
    await sleep(5000);
    await AppCoinRepository.buyCoins(owner, 10);
    data.handNum = nextHandNum++;
    resp = await saveHand(gameId, data.handNum, data);
    pendingUpdates = await GameRepository.anyPendingUpdates(gameId);
    expect(pendingUpdates).toBeFalsy();
    await sleep(5000);
    resp = await saveHand(gameId, data.handNum, data);
    pendingUpdates = await GameRepository.anyPendingUpdates(gameId);
    // get game status
    const game = await GameRepository.getGameByCode(gameCode);
    expect(game).not.toBeUndefined();
    expect(game).not.toBeNull();
    if (game) {
      const gameStatus = game.status;
      const tableStatus = game.tableStatus;
      expect(gameStatus).toEqual(GameStatus.ACTIVE);
      expect(tableStatus).toEqual(TableStatus.GAME_RUNNING);
    }
    const availableCoins = await AppCoinRepository.availableCoins(owner);
    expect(availableCoins).toEqual(7);
  });
});

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
