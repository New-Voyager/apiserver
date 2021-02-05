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
    amount: 100.4,
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

const GAMESERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

describe('Tests: Game APIs', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('start a new game', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.1');
    await saveReward(playerId, clubCode);
    const resp = await getClient(playerId).mutate({
      variables: {
        clubCode: clubCode,
        gameInput: holdemGameInput,
      },
      mutation: gameutils.configureGameQuery,
    });
    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeNull();
    const startedGame = resp.data.configuredGame;
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
    expect(startedGame.buyInApproval).toEqual(true);
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
  });

  test('start a new game by player', async () => {
    const playerUuid = await clubutils.createPlayer('player1', 'abc123');
    await createGameServer('1.2.0.6');
    const resp = await getClient(playerUuid).mutate({
      variables: {
        gameInput: holdemGameInput,
      },
      mutation: gameutils.configureFriendsGameQuery,
    });
    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeNull();
    const startedGame = resp.data.configuredGame;
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
    expect(startedGame.buyInApproval).toEqual(true);
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
  });

  test.skip('get club games', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([]);

    await saveReward(ownerId, clubCode);
    await gameutils.configureGame(ownerId, clubCode, holdemGameInput);
    await saveReward(ownerId, clubCode);
    await gameutils.configureGame(ownerId, clubCode, holdemGameInput);
    // get number of club games
    const clubGames = await gameutils.getClubGames(ownerId, clubCode);
    expect(clubGames).toHaveLength(2);

    const [ownerId2, clubCode2, players2] = await createClubWithMembers([]);

    // get number of club games
    const club2Games = await gameutils.getClubGames(ownerId2, clubCode2);
    expect(club2Games).toHaveLength(0);
  });

  test.skip('get club games pagination', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([]);

    const numGames = 30;
    for (let i = 0; i < numGames; i++) {
      await saveReward(ownerId, clubCode);
      await gameutils.configureGame(ownerId, clubCode, holdemGameInput);
    }
    const clubGames = await gameutils.getClubGames(ownerId, clubCode);
    // we can get only 20 games
    expect(clubGames).toHaveLength(20);
    const firstGame = clubGames[0];
    const lastGame = clubGames[19];
    logger.debug(JSON.stringify(firstGame));
    logger.debug(JSON.stringify(lastGame));
    const clubGames1 = await gameutils.getClubGames(ownerId, clubCode, {
      prev: lastGame.pageId,
      count: 5,
    });
    expect(clubGames1).toHaveLength(5);
  });

  test('join a club game', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'test_player',
        devId: 'test123',
      },
      {
        name: 'test_player1',
        devId: 'test1234',
      },
    ]);
    await saveReward(ownerId, clubCode);
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );

    // Join a game
    const data = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // change seat before buyin
    const data3 = await gameutils.joinGame(players[0], game.gameCode, 3);
    expect(data3).toBe('WAIT_FOR_BUYIN');

    // buyin
    const resp = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(resp.approved).toBe(true);

    // change seat after buyin
    const data4 = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data4).toBe('PLAYING');
  });

  test('buyIn for a club game', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'test_player',
        devId: 'test123',
      },
      {
        name: 'test_player1',
        devId: 'test1234',
      },
    ]);
    await saveReward(ownerId, clubCode);
    const gameInput = holdemGameInput;
    gameInput.buyInApproval = false;
    const game = await gameutils.configureGame(ownerId, clubCode, gameInput);

    // Join a game
    const data = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // buyin
    const resp = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(resp.approved).toBe(true);

    // setting autoBuyinApproval false and creditLimit
    const resp1 = await clubutils.updateClubMember(
      clubCode,
      ownerId,
      players[0],
      {
        autoBuyinApproval: false,
        creditLimit: 200,
      }
    );
    expect(resp1.status).toBe('ACTIVE');

    // Buyin within credit limit and autoBuyinApproval false
    const resp2 = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(resp2.approved).toBe(true);

    // Buyin more than credit limit and autoBuyinApproval false
    const resp3 = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(resp3.approved).toBe(false);
  });

  test('pending approvals for a club and game', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'test_player',
        devId: 'test123',
      },
      {
        name: 'test_player1',
        devId: 'test1234',
      },
    ]);
    await saveReward(ownerId, clubCode);
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const data4 = await gameutils.startGame(ownerId, game.gameCode);
    expect(data4).toBe('ACTIVE');

    // Join a game
    const data = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // buyin
    const resp = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(resp.approved).toBe(true);

    // setting autoBuyinApproval false and creditLimit
    await clubutils.updateClubMember(clubCode, ownerId, players[0], {
      autoBuyinApproval: false,
      creditLimit: 0,
    });
    await clubutils.updateClubMember(clubCode, ownerId, players[1], {
      autoBuyinApproval: false,
      creditLimit: 0,
    });

    await gameutils.buyin(players[0], game.gameCode, 100);
    await gameutils.buyin(players[1], game.gameCode, 100);

    const resp5 = await gameutils.pendingApprovalsForClub(ownerId, clubCode);
    expect(resp5).toHaveLength(2);

    const resp7 = await gameutils.pendingApprovalsForGame(
      ownerId,
      game.gameCode
    );
    expect(resp7).toHaveLength(2);
  });

  test('approve buyIn for a club game', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'test_player',
        devId: 'test123',
      },
      {
        name: 'test_player1',
        devId: 'test1234',
      },
    ]);
    await saveReward(ownerId, clubCode);
    const gameInput = holdemGameInput;
    gameInput.buyInApproval = false;
    const game = await gameutils.configureGame(ownerId, clubCode, gameInput);

    // Join a game
    const data = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // buyin
    const resp = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(resp.approved).toBe(true);

    // setting autoBuyinApproval false and creditLimit
    const resp1 = await clubutils.updateClubMember(
      clubCode,
      ownerId,
      players[0],
      {
        autoBuyinApproval: false,
        creditLimit: 0,
      }
    );
    expect(resp1.status).toBe('ACTIVE');

    // Buyin within credit limit and autoBuyinApproval false
    const resp2 = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(resp2.approved).toBe(false);

    try {
      // Approve a buyin as player
      const resp5 = await gameutils.approveRequest(
        players[1],
        players[0],
        game.gameCode,
        'BUYIN_REQUEST',
        'APPROVED'
      );
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain(
        'Error: GraphQL error: Failed to approve buyin. {}'
      );
    }

    // Approve a buyin as host
    const resp4 = await gameutils.approveRequest(
      ownerId,
      players[0],
      game.gameCode,
      'BUYIN_REQUEST',
      'APPROVED'
    );
    expect(resp4).toBe(true);
  });

  test('get my game state', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'test_player',
        devId: 'test123',
      },
      {
        name: 'test_player1',
        devId: 'test1234',
      },
    ]);
    await saveReward(ownerId, clubCode);
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );

    // Join a game
    const data = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    const resp = await gameutils.myGameState(players[0], game.gameCode);
    expect(resp.playerUuid).toBe(players[0]);
    expect(resp.buyIn).toBe(0);
    expect(resp.stack).toBe(0);
    expect(resp.status).toBe('WAIT_FOR_BUYIN');
    expect(resp.seatNo).toBe(1);

    const resp1 = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(resp1.approved).toBe(true);

    const resp2 = await gameutils.myGameState(players[0], game.gameCode);
    expect(resp2.playerUuid).toBe(players[0]);
    expect(resp2.buyIn).toBe(100);
    expect(resp2.stack).toBe(100);
    expect(resp2.status).toBe('PLAYING');
    expect(resp2.seatNo).toBe(1);
  });

  test('get table game state', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'test_player',
        devId: 'test123',
      },
      {
        name: 'test_player1',
        devId: 'test1234',
      },
    ]);
    await saveReward(ownerId, clubCode);
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );

    // Join a game
    const data = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(players[1], game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    const data2 = await gameutils.tableGameState(players[0], game.gameCode);
    data2.map(resp => {
      expect(resp.buyInStatus).toBeNull();
      expect(
        resp.playerUuid == players[0] || resp.playerUuid == players[1]
      ).toBeTruthy();
      expect(resp.buyIn).toBe(0);
      expect(resp.stack).toBe(0);
      expect(resp.status).toBe('WAIT_FOR_BUYIN');
      // expect(resp.playingFrom).toBeNull();
      expect(resp.seatNo == 1 || resp.seatNo == 2).toBeTruthy();
    });
  });

  test('take a break', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'test_player',
        devId: 'test123',
      },
      {
        name: 'test_player1',
        devId: 'test1234',
      },
    ]);
    await saveReward(ownerId, clubCode);
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const data4 = await gameutils.startGame(ownerId, game.gameCode);
    expect(data4).toBe('ACTIVE');

    const data = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');

    const data2 = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(data2.approved).toBe(true);

    const resp3 = await gameutils.takeBreak(players[0], game.gameCode);
    expect(resp3).toBe(true);

    const gameID = await gameutils.getGameById(game.gameCode);
    const player1ID = await handutils.getPlayerById(players[0]);
    try {
      await axios.post(`${GAMESERVER_API}/update-player-game-state`, {
        playerId: player1ID,
        gameId: gameID,
        status: 'IN_BREAK',
      });
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('sit back after break', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'test_player',
        devId: 'test123',
      },
      {
        name: 'test_player1',
        devId: 'test1234',
      },
    ]);
    await saveReward(ownerId, clubCode);
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );

    // Sit back with player status = IN_BREAK & game status != ACTIVE
    await gameutils.joinGame(players[0], game.gameCode, 1);
    await gameutils.buyin(players[0], game.gameCode, 100);
    await gameutils.takeBreak(players[0], game.gameCode);
    const resp2 = await gameutils.sitBack(players[0], game.gameCode);
    expect(resp2).toBe(true);

    // Sit back with player status = IN_BREAK & game status = ACTIVE
    await gameutils.joinGame(players[0], game.gameCode, 1);
    await gameutils.buyin(players[0], game.gameCode, 100);
    await gameutils.takeBreak(players[0], game.gameCode);
    await gameutils.startGame(ownerId, game.gameCode);
    const resp1 = await gameutils.sitBack(players[0], game.gameCode);
    expect(resp1).toBe(true);

    // Sit back with player status != IN_BREAK
    await gameutils.startGame(ownerId, game.gameCode);
    await gameutils.joinGame(players[0], game.gameCode, 1);
    await gameutils.buyin(players[0], game.gameCode, 100);
    await gameutils.takeBreak(players[0], game.gameCode);
    const resp3 = await gameutils.sitBack(players[0], game.gameCode);
    expect(resp3).toBe(true);
  });

  test('leave a game', async () => {
    const [ownerId, clubCode, players] = await createClubWithMembers([
      {
        name: 'test_player',
        devId: 'test123',
      },
      {
        name: 'test_player1',
        devId: 'test1234',
      },
    ]);
    await saveReward(ownerId, clubCode);
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );

    const data4 = await gameutils.startGame(ownerId, game.gameCode);
    expect(data4).toBe('ACTIVE');

    // Leave game with status !== Playing
    const data = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const resp3 = await gameutils.leaveGame(players[0], game.gameCode);
    expect(resp3).toBe(true);

    // Leave Game with status === Playing
    const data1 = await gameutils.joinGame(players[0], game.gameCode, 1);
    expect(data1).toBe('WAIT_FOR_BUYIN');
    const data2 = await gameutils.buyin(players[0], game.gameCode, 100);
    expect(data2.approved).toBe(true);
    const resp4 = await gameutils.leaveGame(players[0], game.gameCode);
    expect(resp4).toBe(true);

    const gameID = await gameutils.getGameById(game.gameCode);
    const player1ID = await handutils.getPlayerById(players[0]);
    try {
      await axios.post(`${GAMESERVER_API}/update-player-game-state`, {
        playerId: player1ID,
        gameId: gameID,
        status: 'LEFT',
      });
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });
});
