import {createClubWithMembers, initializeSqlLite, sleep, setupGameEnvironment} from './utils';
import {createGameServer} from '../src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '../src/resolvers/reset';
import {updateLocation} from '../src/resolvers/player';
import {GameRepository} from '../src/repositories/game';
import {
   joinGame, sitBack, takeBreak,
} from '../src/resolvers/game';
import {Cache} from '../src/cache/index';
import {getGameInfo} from '../src/resolvers/game';
import { PlayerStatus } from '../src/entity/types';
import _ from 'lodash';
import { processPendingUpdates } from '../src/repositories/pendingupdates';
import {getAppSettings, resetAppSettings} from '../src/firebase';

// Create a game with double board bomb pot
// setup to run a bomb pot every 10 seconds
// move to next hand
// get next hand and verify bomb pot flag is set in the NextHandimport {initializeSqlLite} from './utils';

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

  ipCheck: false,
  gpsCheck: true,
};

const gameServer1 = {
  ipAddress: '10.1.1.1',
  currentMemory: 100,
  status: 'ACTIVE',
  url: 'http://10.1.1.1:8080',
};

enum ClubMemberStatus {
  UNKNOWN,
  INVITED,
  PENDING,
  DENIED,
  ACTIVE,
  LEFT,
  KICKEDOUT,
}

export enum ApprovalType {
  BUYIN_REQUEST,
  RELOAD_REQUEST,
}

export enum ApprovalStatus {
  APPROVED,
  DENIED,
}

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

  /*
    {
    name: 'arya',
    deviceId: 'arya',
    location: {
      lat: 42.3601,
      long: 71.0592,
    }
  },*/
  test('gpstest: Join game players are apart', async () => {
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
  });

  test('gpstest: Join game one player is in proximity', async () => {
    let proximityPlayer = {
      name: 'arya',
      deviceId: 'arya',
      location: {
        lat: 42.3601,
        long: 71.0592,
      }
    };
    const playersInClub: Array<any> = new Array<any>();
    playersInClub.push(...playersInput);
    playersInClub.push(proximityPlayer);

    await createGameServer(gameServer1);
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
    try {
      await joinGame(proximityPlayer.deviceId, game.gameCode, 5, 
        {ip: '', location: proximityPlayer.location});
      expect(true).toBe(false);
    } catch (e) {
      expect(e).not.toBeNull();
      //expect(e.message).toBe("UNKNOWN ERROR");
    }

    // move the player bit
    proximityPlayer = {
      name: 'arya',
      deviceId: 'arya',
      location: {
        lat: 42.3601,
        long: 71.0600,
      }
    }    

    try {
      await joinGame(proximityPlayer.deviceId, game.gameCode, 5, 
        {ip: '', location: proximityPlayer.location});
      expect(true).toBe(true);
    } catch (e) {
      expect(true).toBe(false);
      //expect(e.message).toBe("UNKNOWN ERROR");
    }
  });  

  test('gpstest: break/sitback proximity', async () => {
    let proximityPlayer = {
      name: 'arya',
      deviceId: 'arya',
      location: {
        lat: 42.3601,
        long: 74.0592,
      }
    };
    const playersInClub: Array<any> = new Array<any>();
    playersInClub.push(...playersInput);
    playersInClub.push(proximityPlayer);

    await createGameServer(gameServer1);
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInClub);

    const playersInfo = _.keyBy(playersInClub, 'deviceId')
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100,
      holdemGameInput,
      playersInfo,
    );
    let gameInfoBefore = await getGameInfo('arya', gameCode);
    const playersInSeatsBefore = await GameRepository.getPlayersInSeats(gameId);
    const seat5PlayerBefore = _.filter(playersInSeatsBefore, (e) => e.seatNo == 5)[0];
    expect(seat5PlayerBefore.status).toEqual(PlayerStatus.PLAYING);
    console.log(JSON.stringify(gameInfoBefore));
    console.log(JSON.stringify(playersInSeatsBefore));
    await takeBreak('arya', gameCode);
    await processPendingUpdates(gameId);
    const playersInSeatsAfter = await GameRepository.getPlayersInSeats(gameId);
    let gameInfoAfter = await getGameInfo('arya', gameCode);
    const seat5PlayerAfter = _.filter(playersInSeatsAfter, (e) => e.seatNo == 5)[0];
    expect(seat5PlayerAfter.status).toEqual(PlayerStatus.IN_BREAK);
    console.log(JSON.stringify(playersInSeatsAfter));

    try {
      // sit back in the seat proximity to another player
      await sitBack('arya', gameCode, {
        ip: '',
        location: {
          lat: 42.3601,
          long: 71.0592,
        }
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(true).toBe(true);
    }

    // sit somewhere bit far
    try {
      await sitBack('arya', gameCode, {
        ip: '',
        location: {
          lat: 42.3601,
          long: 71.0600,
        }
      });
      expect(true).toBe(true);
    } catch (err) {
      expect(false).toBe(true);
    }
  });

  test('gpstest: update location', async () => {
    let proximityPlayer = {
      name: 'arya',
      deviceId: 'arya',
      location: {
        lat: 42.3601,
        long: 74.0592,
      }
    };
    const playersInClub: Array<any> = new Array<any>();
    playersInClub.push(...playersInput);
    playersInClub.push(proximityPlayer);

    await createGameServer(gameServer1);
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInClub);

    const playersInfo = _.keyBy(playersInClub, 'deviceId')
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100,
      holdemGameInput,
      playersInfo,
    );
    let gameInfoBefore = await getGameInfo('arya', gameCode);
    const playersInSeatsBefore = await GameRepository.getPlayersInSeats(gameId);
    const seat5PlayerBefore = _.filter(playersInSeatsBefore, (e) => e.seatNo == 5)[0];
    expect(seat5PlayerBefore.status).toEqual(PlayerStatus.PLAYING);
    await updateLocation('arya', '', {
      lat: 42.3601,
      long: 71.0592
    });
    const settings = getAppSettings();
    settings.ipGpsCheckInterval = 5;
    await sleep(6000);
    // save a new hand
    // process pending updates
    await processPendingUpdates(gameId);

    // recently joined player should be in break
    const playersInSeatsAfter = await GameRepository.getPlayersInSeats(gameId);
    let gameInfoAfter = await getGameInfo('arya', gameCode);
    const seat5PlayerAfter = _.filter(playersInSeatsAfter, (e) => e.seatNo == 5)[0];
    expect(seat5PlayerAfter.status).toEqual(PlayerStatus.IN_BREAK);
  });

});
