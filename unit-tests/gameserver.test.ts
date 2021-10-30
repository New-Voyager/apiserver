import {initializeSqlLite} from './utils';
import {
  createGameServer,
  editGameServer,
  getAllGameServers,
} from '@src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/dev/resolvers/reset';
import {createPlayer} from '@src/resolvers/player';
import {saveReward} from '../src/resolvers/reward';
import {createClub} from '@src/resolvers/club';
import {configureGame, configureGameByPlayer} from '@src/resolvers/game';

const logger = getLogger('gameserver unit-test');
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
}

describe('Game server APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Create a game server', async () => {
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'htto://10.1.1.1:8080',
    };
    try {
      const [resp, _] = await createGameServer(gameServer);
      expect(resp).not.toBeNull();
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Update a game server', async () => {
    const gameServer = {
      ipAddress: '10.1.1.2',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'htto://localhost:8080',
    };
    const gameServerUpdate1 = {
      ipAddress: '10.1.1.2',
      currentMemory: 200,
      noActiveGames: 2,
      noGamesHandled: 1,
      noActivePlayers: 2,
      noPlayersHandled: 3,
      status: 'ACTIVE',
    };
    const gameServerUpdate2 = {
      ipAddress: '10.1.2.2',
      currentMemory: 200,
      noActiveGames: 2,
      url: 'htto://localhost:8080',
    };
    try {
      const [resp, error] = await createGameServer(gameServer);
      expect(error).toBeNull();
      const edited1 = await editGameServer(gameServerUpdate1);
      const edited2 = await editGameServer(gameServerUpdate2);
      expect(edited1).toBe(true);
      expect(edited2).toBe('gameserver 10.1.2.2 is not found');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get all game servers', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.3',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'htto://10.1.1.3:8080',
    };
    const gameServer2 = {
      ipAddress: '10.1.1.4',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'htto://10.1.1.4:8080',
    };
    const [resp1, error] = await createGameServer(gameServer1);
    const [resp2, error2] = await createGameServer(gameServer2);
    expect(error).toBeNull();
    expect(resp1).toBeDefined();
    expect(resp1.serverNumber).toBeDefined();
    expect(resp2).toBeDefined();
    expect(resp2.serverNumber).toBeGreaterThan(resp1.serverNumber);

    const servers = await getAllGameServers();
    expect(servers).toHaveLength(2);
    expect(servers[0].ipAddress).toBe('10.1.1.3');
    expect(servers[1].ipAddress).toBe('10.1.1.4');
  });

  test('Get specific game server 1', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.5',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'htto://10.1.1.5:8080',
    };
    const gameServer2 = {
      ipAddress: '10.1.1.6',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'htto://10.1.1.6:8080',
    };
    const [resp1, error1] = await createGameServer(gameServer1);
    const [resp2, error2] = await createGameServer(gameServer2);
    expect(error1).toBeNull();
    expect(error2).toBeNull();
    const player = await createPlayer({
      player: {
        name: 'player_name',
        deviceId: 'abc123',
      },
    });
    const club = await createClub(player, {
      name: 'club_name',
      description: 'poker players gather',
      ownerUuid: player,
    });
    //await createReward(player, club);
    const game = await configureGame(player, club, holdemGameInput);
    expect(game).not.toBeNull();
  });

  test('Get specific game server 2', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.5',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'htto://localhost-1:8080',
    };
    const gameServer2 = {
      ipAddress: '10.1.1.6',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'htto://localhost-2:8080',
    };
    const [resp1, error1] = await createGameServer(gameServer1);
    const [resp2, error2] = await createGameServer(gameServer2);
    expect(error1).toBeNull();
    expect(error2).toBeNull();
    const player = await createPlayer({
      player: {
        name: 'player_name',
        deviceId: 'abc123',
      },
    });

    const game = await configureGameByPlayer(player, holdemGameInput);
    expect(game).not.toBeNull();
  });
});
