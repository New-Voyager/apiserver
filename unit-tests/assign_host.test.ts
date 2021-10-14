import {createClubWithMembers, initializeSqlLite, sleep, setupGameEnvironment} from './utils';
import {createGameServer} from '../src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '../src/resolvers/reset';
import {Cache} from '../src/cache/index';
import _ from 'lodash';
import { GameSettingsRepository } from '../src/repositories/gamesettings';
import { assignHost, startGame } from '../src/resolvers/game';
import { PokerGame } from '../src/entity/game/game';


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
    location: {
      lat: 42.3601,
      long: 71.0589,
    }
  },
  {
    name: 'player_3',
    deviceId: 'abc123456',
    location: {
      lat: 40.7128,
      long: 74.0060,
    }
  },
  {
    name: 'john',
    deviceId: 'abc1235',
    location: {
      lat: 34.0522,
      long: 118.2437,
    }
  },
  {
    name: 'brain',
    deviceId: 'brain',
    location: {
      lat: 32.7767,
      long: 96.7970,
    }
  },
 
];
const logger = getLogger('game unit-test');
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
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 600,
  actionTime: 30,
  muckLosingHand: true,
  rewardIds: [] as any,

  buyInApproval: false,
  breakLength: 20,
  breakAllowed: true,
  waitlistAllowed: true,
  waitlistSittingTimeout: 5,
  ipCheck: false,
  gpsCheck: true,
  allowRabbitHunt: false,
  showHandRank: false,

};

const gameServer1 = {
  ipAddress: '10.1.1.1',
  currentMemory: 100,
  status: 'ACTIVE',
  url: 'http://10.1.1.1:8080',
};

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Assign Game Host API', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('assign_host: assign new game host', async () => {
    await createGameServer(gameServer1);
    const playersInClub: Array<any> = new Array<any>();
    playersInClub.push(...playersInput);
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInClub);

    const playersInfo = _.keyBy(playersInput, 'deviceId')
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100,
      holdemGameInput,
      playersInfo,
    );
    
    const game = await Cache.getGame(gameCode);
    
    expect(game.hostId).toBeGreaterThan(0);
    expect(game.hostName).toEqual(ownerInput.name);
    expect(game.hostUuid).toEqual(ownerInput.deviceId);

    const originalHostId = game.hostId;
    await assignHost(owner, game.gameCode, playersInput[0].deviceId, originalHostId);
    const gameData: PokerGame = await Cache.getGame(game.gameCode);
    expect(gameData.hostId).not.toEqual(originalHostId);
    expect(gameData.hostUuid).toEqual(playersInput[0].deviceId);

    // The owner is no longer the host. Therefore, he should not be able to assign another host.
    const t = async () => {
      await assignHost(owner, game.gameCode, playersInput[0].deviceId, originalHostId);
    };
    await expect(t).rejects.toThrowError();

    // The new host (playersInput[0]) should be able to assign another host.
    await assignHost(playersInput[0].deviceId, game.gameCode, playersInput[1].deviceId, originalHostId);
    const gameData2: PokerGame = await Cache.getGame(game.gameCode);
    expect(gameData2.hostUuid).toEqual(playersInput[1].deviceId);
  });
});

