import {initializeSqlLite} from './utils';
import {createGameServer} from '@src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {createPlayer, getPlayerById} from '@src/resolvers/player';
import {createClub, updateClubMember, joinClub} from '@src/resolvers/club';
import {
  configureGame,
  configureGameByPlayer,
  joinGame,
  startGame,
  buyIn,
  pendingApprovalsForClub,
  pendingApprovalsForGame,
  reload,
  approveRequest,
  myGameState,
  tableGameState,
  takeBreak,
  sitBack,
  leaveGame,
  addToWaitingList,
  removeFromWaitingList,
  waitingList,
} from '@src/resolvers/game';
import {Cache} from '@src/cache/index';
import {saveReward} from '../src/resolvers/reward';
import {processPendingUpdates} from '@src/repositories/pendingupdates';
import {waitlistTimeoutExpired} from '@src/repositories/timer';
import {approveMember} from '../src/resolvers/club';

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

describe('Game APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('gametest: Start a new game', async () => {
    try {
      await createGameServer(gameServer1);
      const [owner, club] = await createClubWithMembers(
        {
          name: 'player_name',
          deviceId: 'abc123',
        },
        {
          name: 'club_name',
          description: 'poker players gather',
        },
        []
      );
      await createReward(owner, club);
      const startedGame = await configureGame(owner, club, holdemGameInput);
      expect(startedGame).not.toBeNull();
      expect(startedGame.gameType).toEqual('HOLDEM');
      expect(startedGame.title).toEqual('Friday game');
      expect(startedGame.smallBlind).toEqual(1.0);
      expect(startedGame.bigBlind).toEqual(2.0);
      expect(startedGame.straddleBet).toEqual(4.0);
      expect(startedGame.utgStraddleAllowed).toEqual(true);
      expect(startedGame.buttonStraddleAllowed).toEqual(false);
      expect(startedGame.minPlayers).toEqual(3);
      expect(startedGame.maxPlayers).toEqual(9);
      expect(startedGame.gameLength).toEqual(60);
      expect(startedGame.buyInApproval).toEqual(false);
      expect(startedGame.breakLength).toEqual(20);
      expect(startedGame.autoKickAfterBreak).toEqual(true);
      expect(startedGame.waitForBigBlind).toEqual(true);
      expect(startedGame.sitInApproval).toEqual(true);
      expect(startedGame.rakePercentage).toEqual(5.0);
      expect(startedGame.rakeCap).toEqual(5.0);
      expect(startedGame.buyInMin).toEqual(100);
      expect(startedGame.buyInMax).toEqual(600);
      expect(startedGame.actionTime).toEqual(30);
      expect(startedGame.muckLosingHand).toEqual(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('gametest: Start a new game by player', async () => {
    try {
      await createGameServer(gameServer1);
      const player = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const startedGame = await configureGameByPlayer(player, holdemGameInput);
      expect(startedGame).not.toBeNull();
      expect(startedGame.gameType).toEqual('HOLDEM');
      expect(startedGame.title).toEqual('Friday game');
      expect(startedGame.smallBlind).toEqual(1.0);
      expect(startedGame.bigBlind).toEqual(2.0);
      expect(startedGame.straddleBet).toEqual(4.0);
      expect(startedGame.utgStraddleAllowed).toEqual(true);
      expect(startedGame.buttonStraddleAllowed).toEqual(false);
      expect(startedGame.minPlayers).toEqual(3);
      expect(startedGame.maxPlayers).toEqual(9);
      expect(startedGame.gameLength).toEqual(60);
      expect(startedGame.buyInApproval).toEqual(false);
      expect(startedGame.breakLength).toEqual(20);
      expect(startedGame.autoKickAfterBreak).toEqual(true);
      expect(startedGame.waitForBigBlind).toEqual(true);
      expect(startedGame.sitInApproval).toEqual(true);
      expect(startedGame.rakePercentage).toEqual(5.0);
      expect(startedGame.rakeCap).toEqual(5.0);
      expect(startedGame.buyInMin).toEqual(100);
      expect(startedGame.buyInMax).toEqual(600);
      expect(startedGame.actionTime).toEqual(30);
      expect(startedGame.muckLosingHand).toEqual(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('gametest: Get game by uuid', async () => {
    try {
      await createGameServer(gameServer1);
      const [owner, club] = await createClubWithMembers(
        {
          name: 'player_name',
          deviceId: 'abc123',
        },
        {
          name: 'club_name',
          description: 'poker players gather',
        },
        []
      );
      await createReward(owner, club);
      const startedGame = await configureGame(owner, club, holdemGameInput);
      const gameData = await Cache.getGame(startedGame.gameCode);
      expect(gameData.id).not.toBe(null);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('gametest: Join a game', async () => {
    await createGameServer(gameServer1);
    const [owner, club, players] = await createClubWithMembers(
      {
        name: 'player_name',
        deviceId: 'abc123',
      },
      {
        name: 'club_name',
        description: 'poker players gather',
      },
      [
        {
          name: 'player_name',
          deviceId: 'abc1234',
        },
        {
          name: 'player_name',
          deviceId: 'abc1235',
        },
      ]
    );
    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);

    // Join a game
    const data = await joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // change seat before buyin
    const data3 = await joinGame(players[0], game.gameCode, 3);
    expect(data3).toBe('WAIT_FOR_BUYIN');

    // buyin
    const resp = await buyIn(players[0], game.gameCode, 100);
    expect(resp.approved).toBe(true);

    // change seat after buyin
    const data4 = await joinGame(players[0], game.gameCode, 1);
    expect(data4).toBe('PLAYING');
  });

  test('gametest: Buyin for a game', async () => {
    await createGameServer(gameServer1);
    const [owner, club, players] = await createClubWithMembers(
      {
        name: 'player_name',
        deviceId: 'abc123',
      },
      {
        name: 'club_name',
        description: 'poker players gather',
      },
      [
        {
          name: 'player_name',
          deviceId: 'abc1234',
        },
        {
          name: 'player_name',
          deviceId: 'abc1235',
        },
      ]
    );
    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);

    // Join a game
    const data = await joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // Buyin with autoBuyinApproval true
    const resp = await buyIn(players[0], game.gameCode, 100);
    expect(resp.approved).toBe(true);

    // setting autoBuyinApproval false and creditLimit
    const resp1 = await updateClubMember(owner, players[0], club, {
      balance: 10,
      creditLimit: 200,
      notes: 'Added credit limit',
      status: ClubMemberStatus['ACTIVE'],
      isManager: false,
      autoBuyinApproval: false,
    });
    expect(resp1).toBe(ClubMemberStatus['ACTIVE']);

    // Buyin within credit limit and autoBuyinApproval false
    const resp2 = await buyIn(players[0], game.gameCode, 100);
    expect(resp2.approved).toBe(true);

    // Buyin more than credit limit and autoBuyinApproval false
    const resp3 = await buyIn(players[0], game.gameCode, 100);
    expect(resp3.approved).toBe(false);
  });

  test('gametest: Reload for a game', async () => {
    await createGameServer(gameServer1);
    const [owner, club, players] = await createClubWithMembers(
      {
        name: 'player_name',
        deviceId: 'abc123',
      },
      {
        name: 'club_name',
        description: 'poker players gather',
      },
      [
        {
          name: 'player_name',
          deviceId: 'abc1234',
        },
        {
          name: 'player_name',
          deviceId: 'abc1235',
        },
      ]
    );
    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);

    // Join a game
    const data = await joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // reload with autoBuyinApproval true
    const resp = await reload(players[0], game.gameCode, 100);
    expect(resp.approved).toBe(true);

    // setting autoBuyinApproval false and creditLimit
    const resp1 = await updateClubMember(owner, players[0], club, {
      balance: 10,
      creditLimit: 200,
      notes: 'Added credit limit',
      status: ClubMemberStatus['ACTIVE'],
      isManager: false,
      autoBuyinApproval: false,
    });
    expect(resp1).toBe(ClubMemberStatus['ACTIVE']);

    // reload within credit limit and autoBuyinApproval false
    const resp2 = await reload(players[0], game.gameCode, 100);
    expect(resp2.approved).toBe(true);

    // reload more than credit limit and autoBuyinApproval false
    const resp3 = await reload(players[0], game.gameCode, 100);
    expect(resp3.approved).toBe(false);
  });

  test('gametest: Approve Buyin for a game', async () => {
    await createGameServer(gameServer1);
    const [owner, club, players] = await createClubWithMembers(
      {
        name: 'player_name',
        deviceId: 'abc123',
      },
      {
        name: 'club_name',
        description: 'poker players gather',
      },
      [
        {
          name: 'player_name',
          deviceId: 'abc1234',
        },
        {
          name: 'player_name',
          deviceId: 'abc1235',
        },
      ]
    );
    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);

    // Join a game
    const data = await joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // setting autoBuyinApproval false and creditLimit
    const resp1 = await updateClubMember(owner, players[0], club, {
      balance: 0,
      creditLimit: 0,
      notes: 'Added credit limit',
      status: ClubMemberStatus['ACTIVE'],
      isManager: false,
      autoBuyinApproval: false,
    });
    expect(resp1).toBe(ClubMemberStatus['ACTIVE']);

    // Buyin more than credit limit and autoBuyinApproval false
    const resp2 = await buyIn(players[0], game.gameCode, 100);
    expect(resp2.approved).toBe(false);

    // Approve a buyin as host
    const resp3 = await approveRequest(
      owner,
      players[0],
      game.gameCode,
      ApprovalType.BUYIN_REQUEST,
      ApprovalStatus.APPROVED
    );
    expect(resp3).toBe(true);
  });

  test('gametest: Get my game state', async () => {
    await createGameServer(gameServer1);
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
    ];

    const [owner, club, playerUuids] = await createClubWithMembers(
      ownerInput,
      clubInput,
      playersInput
    );
    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);
    const player1 = owner;
    const player2 = playerUuids[0];
    // Join a game
    const data = await joinGame(player1, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await joinGame(player2, game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    const resp = await myGameState(player1, game.gameCode);
    expect(resp.buyInStatus).toBeUndefined();
    expect(resp.playerUuid).toBe(player1);
    expect(resp.buyIn).toBe(0);
    expect(resp.stack).toBe(0);
    expect(resp.status).toBe('WAIT_FOR_BUYIN');
    expect(resp.playingFrom).toBeNull();
    expect(resp.seatNo).toBe(1);

    const resp1 = await buyIn(player1, game.gameCode, 100);
    expect(resp1.approved).toBe(true);

    const resp2 = await myGameState(player1, game.gameCode);
    expect(resp2.buyInStatus).toBe('APPROVED');
    expect(resp2.playerUuid).toBe(player1);
    expect(resp2.buyIn).toBe(100);
    expect(resp2.stack).toBe(100);
    expect(resp2.status).toBe('PLAYING');
    expect(resp2.playingFrom).toBeNull();
    expect(resp2.seatNo).toBe(1);
  });

  test('gametest: Get table game state', async () => {
    await createGameServer(gameServer1);
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
    ];

    const [owner, club, playerUuids] = await createClubWithMembers(
      ownerInput,
      clubInput,
      playersInput
    );
    const player1 = owner;
    const player2 = playerUuids[0];
    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);
    // Join a game
    const data = await joinGame(player1, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await joinGame(player2, game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    const data2 = await tableGameState(player1, game.gameCode);
    data2.map(resp => {
      expect(resp.buyInStatus).toBeUndefined();
      expect(
        resp.playerUuid === player1 || resp.playerUuid === player2
      ).toBeTruthy();
      expect(resp.buyIn).toBe(0);
      expect(resp.stack).toBe(0);
      expect(resp.status).toBe('WAIT_FOR_BUYIN');
      expect(resp.playingFrom).toBeNull();
      expect(resp.seatNo === 1 || resp.seatNo === 2).toBeTruthy();
    });
  });

  test('gametest: Take a break', async () => {
    await createGameServer(gameServer1);
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
    ];
    const [owner, club, playerUuids] = await createClubWithMembers(
      ownerInput,
      clubInput,
      playersInput
    );
    const player1 = owner;
    const player2 = playerUuids[0];
    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);

    const data2 = await startGame(player1, game.gameCode);
    expect(data2).toBe('ACTIVE');

    // Join a game
    const data = await joinGame(player1, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await buyIn(player1, game.gameCode, 100);
    expect(data1.approved).toBe(true);

    const resp3 = await takeBreak(player1, game.gameCode);
    expect(resp3).toBe(true);
  });

  test('gametest: Sit back after break', async () => {
    await createGameServer(gameServer1);
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
    ];
    const [owner, club, playerUuids] = await createClubWithMembers(
      ownerInput,
      clubInput,
      playersInput
    );
    const player1 = owner;
    const player2 = playerUuids[0];
    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);

    // Sit back with player status = IN_BREAK & game status != ACTIVE
    await joinGame(player1, game.gameCode, 1);
    await buyIn(player1, game.gameCode, 100);
    await takeBreak(player1, game.gameCode);
    const resp1 = await sitBack(player1, game.gameCode);
    expect(resp1).toBe(true);

    // Sit back with player status = IN_BREAK & game status = ACTIVE
    await joinGame(player1, game.gameCode, 1);
    await buyIn(player1, game.gameCode, 100);
    await takeBreak(player1, game.gameCode);
    await startGame(player1, game.gameCode);
    const resp2 = await sitBack(player1, game.gameCode);
    expect(resp2).toBe(true);

    // Sit back with player status != IN_BREAK
    await startGame(player1, game.gameCode);
    await joinGame(player1, game.gameCode, 1);
    await buyIn(player1, game.gameCode, 100);
    await takeBreak(player1, game.gameCode);
    const resp3 = await sitBack(player1, game.gameCode);
    expect(resp3).toBe(true);
  });

  test('gametest: leave a game', async () => {
    await createGameServer(gameServer1);
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
    ];
    const [owner, club, playerUuids] = await createClubWithMembers(
      ownerInput,
      clubInput,
      playersInput
    );
    const player1 = owner;
    const player2 = playerUuids[0];
    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);

    const data3 = await startGame(player1, game.gameCode);
    expect(data3).toBe('ACTIVE');

    // Leave game with status !== Playing
    const data = await joinGame(player1, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const resp3 = await leaveGame(player1, game.gameCode);
    expect(resp3).toBe(true);

    // Leave game with status === Playing
    const data2 = await joinGame(player1, game.gameCode, 1);
    expect(data2).toBe('WAIT_FOR_BUYIN');
    const data1 = await buyIn(player1, game.gameCode, 100);
    expect(data1.approved).toBe(true);
    const resp = await leaveGame(player1, game.gameCode);
    expect(resp).toBe(true);
  });

  test('gametest: wait list seating APIs', async () => {
    try {
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

      // add john & bob to waitlist
      const resp1 = await addToWaitingList(john, game.gameCode);
      expect(resp1).toBe(true);
      const resp2 = await addToWaitingList(bob, game.gameCode);
      expect(resp2).toBe(true);

      // verify waitlist count
      const waitlist1 = await waitingList(owner, game.gameCode);
      expect(waitlist1).toHaveLength(2);
      waitlist1.forEach(element => {
        expect(element.status).toBe('IN_QUEUE');
      });

      // remove john from wailist
      const resp3 = await removeFromWaitingList(john, game.gameCode);
      expect(resp3).toBe(true);

      // verify waitlist count
      const waitlist2 = await waitingList(owner, game.gameCode);
      expect(waitlist2).toHaveLength(1);
      expect(waitlist2[0].status).toBe('IN_QUEUE');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('gametest: wait list seating - success case', async () => {
    try {
      await createGameServer(gameServer1);
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

      // add john & bob to waitlist
      await addToWaitingList(john, game.gameCode);
      await addToWaitingList(bob, game.gameCode);

      // verify waitlist count
      const waitlist1 = await waitingList(owner, game.gameCode);
      expect(waitlist1).toHaveLength(2);
      waitlist1.forEach(element => {
        expect(element.status).toBe('IN_QUEUE');
      });

      // player1 leaves a game
      await leaveGame(player1, game.gameCode);

      // process pending updates
      await processPendingUpdates(game.id);

      // verify waitlist count and status
      const waitlist2 = await waitingList(owner, game.gameCode);
      expect(waitlist2).toHaveLength(2);
      waitlist2.forEach(element => {
        if (element.playerUuid === john) {
          expect(element.status).toBe('WAITLIST_SEATING');
        } else {
          expect(element.status).toBe('IN_QUEUE');
        }
      });

      try {
        await joinGame(bob, game.gameCode, 1);
        expect(true).toBeFalsy();
      } catch (error) {
        logger.error(JSON.stringify(error));
      }

      const resp = await joinGame(john, game.gameCode, 1);
      expect(resp).toBe('WAIT_FOR_BUYIN');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('gametest: wait list seating - timeout case', async () => {
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

    // add john & bob to waitlist
    await addToWaitingList(john, game.gameCode);
    await addToWaitingList(bob, game.gameCode);

    // verify waitlist count
    const waitlist1 = await waitingList(owner, game.gameCode);
    expect(waitlist1).toHaveLength(2);
    waitlist1.forEach(element => {
      expect(element.status).toBe('IN_QUEUE');
    });

    // player1 leaves a game
    await leaveGame(player1, game.gameCode);

    // process pending updates
    await processPendingUpdates(game.id);

    // verify waitlist count and status
    const waitlist2 = await waitingList(owner, game.gameCode);
    expect(waitlist2).toHaveLength(2);
    waitlist2.forEach(element => {
      if (element.playerUuid === john) {
        expect(element.status).toBe('WAITLIST_SEATING');
      } else {
        expect(element.status).toBe('IN_QUEUE');
      }
    });

    // wait for 6 seconds
    await sleep(6000);

    // call waitlistTimeoutExpired
    const ownerID = (await getPlayerById(owner)).id;
    await waitlistTimeoutExpired(game.id, ownerID);

    // verify wailist count and status
    const waitlist3 = await waitingList(owner, game.gameCode);
    expect(waitlist3).toHaveLength(1);
    expect(waitlist3[0].playerUuid).not.toBe(john);
    expect(waitlist3[0].playerUuid).toBe(bob);
    expect(waitlist3[0].status).toBe('WAITLIST_SEATING');
  });

  test('gametest: pending approvals for a club and game', async () => {
    await createGameServer(gameServer1);
    const [owner, club, players] = await createClubWithMembers(
      {
        name: 'player_name',
        deviceId: 'abc123',
      },
      {
        name: 'club_name',
        description: 'poker players gather',
      },
      [
        {
          name: 'player_name',
          deviceId: 'abc1234',
        },
        {
          name: 'player_name',
          deviceId: 'abc1235',
        },
      ]
    );

    await createReward(owner, club);
    const game = await configureGame(owner, club, holdemGameInput);
    await startGame(owner, game.gameCode);

    // Join a game
    const data = await joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    await buyIn(players[0], game.gameCode, 100);

    // setting autoBuyinApproval false and creditLimit
    const resp1 = await updateClubMember(owner, players[0], club, {
      balance: 0,
      creditLimit: 0,
      notes: 'Added credit limit',
      status: ClubMemberStatus['ACTIVE'],
      isManager: false,
      autoBuyinApproval: false,
    });
    expect(resp1).toBe(ClubMemberStatus['ACTIVE']);

    const resp2 = await updateClubMember(owner, players[1], club, {
      balance: 0,
      creditLimit: 0,
      notes: 'Added credit limit',
      status: ClubMemberStatus['ACTIVE'],
      isManager: false,
      autoBuyinApproval: false,
    });
    expect(resp2).toBe(ClubMemberStatus['ACTIVE']);

    // Buyin more than credit limit and autoBuyinApproval false
    await buyIn(players[0], game.gameCode, 100);
    await buyIn(players[1], game.gameCode, 100);

    await reload(players[0], game.gameCode, 100);

    const resp5 = await pendingApprovalsForClub(owner, club);
    expect(resp5).toHaveLength(3);

    const resp7 = await pendingApprovalsForGame(owner, game.gameCode);
    expect(resp7).toHaveLength(3);
  });
});
