import {createClubWithMembers, initializeSqlLite, sleep, setupGameEnvironment} from './utils';
import {createGameServer} from '../src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '../src/resolvers/reset';
import {Cache} from '../src/cache/index';
import _ from 'lodash';
import {PlayersInGameRepository} from '../src/repositories/playersingame';
import { GamePlayerSettings } from '../src/repositories/types';
// import {GamePlayerSettings} from '../src/repositories/types';


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

describe('Game APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('gameplayersettings: get game player settings', async () => {
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
    const player = await Cache.getPlayer('abc1234');
    console.log(`Player: ${player.deviceId} game: ${game.gameCode}`);

    const oldSettings = await PlayersInGameRepository.getPlayerGameSettings(
       player,
       game
     );
    console.log(`oldSettings: ${oldSettings}`);
    expect(oldSettings).not.toBeNull();
    expect(oldSettings.autoStraddle).toEqual(false);
    expect(oldSettings.runItTwiceEnabled).toEqual(false);
    expect(oldSettings.muckLosingHand).toEqual(true);
    expect(oldSettings.bombPotEnabled).toEqual(true);
    expect(oldSettings.buttonStraddle).toEqual(false);
  });

  test('gameplayersettings: change game player settings', async () => {
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
    const player = await Cache.getPlayer('abc1234');
    console.log(`Player: ${player.deviceId} game: ${game.gameCode}`);
    
    const newSettings: GamePlayerSettings = {
      autoStraddle: true,
      runItTwiceEnabled: true,
    }
    await PlayersInGameRepository.updatePlayerGameSettings(
       player,
       game,
      newSettings
     );

     const settings = await PlayersInGameRepository.getPlayerGameSettings(
      player,
      game,
    );

    expect(settings).not.toBeNull();
    expect(settings.autoStraddle).toEqual(true);
    expect(settings.runItTwiceEnabled).toEqual(true);
    expect(settings.muckLosingHand).toEqual(true);
    expect(settings.bombPotEnabled).toEqual(true);
    expect(settings.buttonStraddle).toEqual(false);
  });
});
