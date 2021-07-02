import {initializeSqlLite} from './utils';
import {createGameServer} from '@src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {createPlayer, getPlayerById} from '@src/resolvers/player';
import {createClub, updateClubMember, joinClub} from '@src/resolvers/club';
import {
  configureGame,
  joinGame,
  startGame,
  buyIn,
  endGame,
} from '@src/resolvers/game';
import {gameHistory, playersInGame} from '../src/resolvers/history';
import {Cache} from '@src/cache/index';
import {saveReward} from '../src/resolvers/reward';
import {approveMember} from '../src/resolvers/club';
import exp from 'constants';

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

async function createReward(playerId, clubCode) {
  const rewardInput = {
    amount: 100,
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

async function createClubWithMembers(
  ownerInput: any,
  clubInput: any,
  players: Array<any>
): Promise<[string, string, Array<string>]> {
  const ownerUuid = await createPlayer({player: ownerInput});
  clubInput.ownerUuid = ownerUuid;
  const clubCode = await createClub(ownerUuid, clubInput);
  const playerUuids = new Array<string>();
  for (const playerInput of players) {
    const playerUuid = await createPlayer({player: playerInput});
    await joinClub(playerUuid, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid);
    playerUuids.push(playerUuid);
  }
  return [ownerUuid, clubCode, playerUuids];
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

describe('History APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('history test: get game history', async () => {
    await createGameServer(gameServer1);

    // create players
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
      {
        name: 'bob',
        deviceId: 'abc1236',
      },
    ];
    const [owner, club, playerUuids] = await createClubWithMembers(
      ownerInput,
      clubInput,
      playersInput
    );
    const player1 = owner;
    const player2 = playerUuids[0];
    const player3 = playerUuids[1];
    const john = playerUuids[2];
    const bob = playerUuids[3];

    // start a game
    const gameInput = holdemGameInput;
    gameInput.maxPlayers = 3;
    gameInput.minPlayers = 2;
    await createReward(owner, club);
    const game = await configureGame(owner, club, gameInput);
    await startGame(owner, game.gameCode);

    // Join a game
    await joinGame(player1, game.gameCode, 1);
    await joinGame(player2, game.gameCode, 2);
    await joinGame(player3, game.gameCode, 3);

    // buyin
    await buyIn(player1, game.gameCode, 100);
    await buyIn(player2, game.gameCode, 100);
    await buyIn(player3, game.gameCode, 100);

    await endGame(owner, game.gameCode);

    const resp = await gameHistory(owner, game.gameCode);
    resp.forEach(data => {
      expect(data.smallBlind).toBe(holdemGameInput.smallBlind);
      expect(data.bigBlind).toBe(holdemGameInput.bigBlind);
      expect(data.gameCode).toBe(game.gameCode);
      expect(data.gameId).toBe(game.id);
    });
  });

  test('history test: get players in game', async () => {
    await createGameServer(gameServer1);

    // create players
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
      {
        name: 'bob',
        deviceId: 'abc1236',
      },
    ];
    const [owner, club, playerUuids] = await createClubWithMembers(
      ownerInput,
      clubInput,
      playersInput
    );
    const player1 = owner;
    const player2 = playerUuids[0];
    const player3 = playerUuids[1];
    const john = playerUuids[2];
    const bob = playerUuids[3];
    // start a game
    const gameInput = holdemGameInput;
    gameInput.maxPlayers = 3;
    gameInput.minPlayers = 2;
    await createReward(owner, club);
    const game = await configureGame(owner, club, gameInput);
    await startGame(owner, game.gameCode);

    // Join a game
    await joinGame(player1, game.gameCode, 1);
    await joinGame(player2, game.gameCode, 2);
    await joinGame(player3, game.gameCode, 3);

    // buyin
    await buyIn(player1, game.gameCode, 100);
    await buyIn(player2, game.gameCode, 100);
    await buyIn(player3, game.gameCode, 100);

    await endGame(owner, game.gameCode);

    const resp = await playersInGame(owner, game.gameCode);
    expect(resp[0].playerUuid).toBe(player1);
    expect(resp[1].playerUuid).toBe(player2);
    expect(resp[2].playerUuid).toBe(player3);
  });
});
