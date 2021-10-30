import {initializeSqlLite} from './utils';
import {createGameServer} from '@src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/dev/resolvers/reset';
import {createPlayer, getPlayerById} from '@src/resolvers/player';
import {createClub, updateClubMember, joinClub} from '@src/resolvers/club';
import {
  configureGame,
  startGame,
  endGame,
} from '../src/resolvers/game';
import {buyIn, joinGame, setBuyInLimit} from '../src/resolvers/playersingame';

import {approveMember, clubLeaderBoard} from '../src/resolvers/club';

const logger = getLogger('buy-in unit-test');
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
  buyInMin: 10,
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

describe('BuyIn APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('buyin_auto_approval_limit: auto-approve up to in-game limit', async () => {
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
    const player1 = playerUuids[0];
    const player2 = playerUuids[1];
    const player3 = playerUuids[2];

    // start a game
    const gameInput = holdemGameInput;
    const game = await configureGame(owner, club, gameInput);
    await startGame(owner, game.gameCode);

    // Join a game
    await joinGame(player1, game.gameCode, 1);
    await joinGame(player2, game.gameCode, 2);
    await joinGame(player3, game.gameCode, 3);

    // Only the host can set buy-in limit.
    const t = async () => {
      await setBuyInLimit(player1, game.gameCode, player2, 0, 100);
    };
    await expect(t).rejects.toThrowError();

    // Set buy-in limit
    await setBuyInLimit(owner, game.gameCode, player1, 0, 50);
    await setBuyInLimit(owner, game.gameCode, player2, 0, 100);
    await setBuyInLimit(owner, game.gameCode, player3, 0, 150);

    // Player 1 - exceeds limit (not auto approved)
    const resp1 = await buyIn(player1, game.gameCode, 100);
    expect(resp1.approved).toBe(false);
    expect(resp1.status).toBe('WAIT_FOR_BUYIN_APPROVAL');

    // Player 2 - below limit (auto approved)
    const resp2 = await buyIn(player2, game.gameCode, 100);
    expect(resp2.approved).toBe(true);
    expect(resp2.status).toBe('PLAYING');

    // Player 3 - below limit (auto approved)
    const resp3a = await buyIn(player3, game.gameCode, 100);
    expect(resp3a.approved).toBe(true);
    expect(resp3a.status).toBe('PLAYING');

    // Player 3 - additional buy-in exceeds limit (not auto approved)
    const resp3b = await buyIn(player3, game.gameCode, 100);
    expect(resp3b.approved).toBe(false);
    expect(resp3b.status).toBe('WAIT_FOR_BUYIN_APPROVAL');

    await endGame(owner, game.gameCode);
  });
});
