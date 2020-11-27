import {resetDatabase, getClient, PORT_NUMBER} from './utils/utils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import * as handutils from './utils/hand.testutils';
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
};

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

const GAMESERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

describe('Game APIs', () => {
  test('start a new game', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.1');
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

  test('get club games', async () => {
    const [clubCode, playerId] = await clubutils.createClub(
      'brady1',
      'yatzee2'
    );
    await createGameServer('1.2.0.2');
    const game1 = await gameutils.configureGame(
      playerId,
      clubCode,
      holdemGameInput
    );
    const game2 = await gameutils.configureGame(
      playerId,
      clubCode,
      holdemGameInput
    );
    // get number of club games
    const clubGames = await gameutils.getClubGames(playerId, clubCode);
    expect(clubGames).toHaveLength(2);

    const [clubCode2, playerId2] = await clubutils.createClub(
      'brady1',
      'yatzee2'
    );
    // get number of club games
    const club2Games = await gameutils.getClubGames(playerId2, clubCode2);
    expect(club2Games).toHaveLength(0);
  });

  test('get club games pagination', async () => {
    const [clubCode, playerId] = await clubutils.createClub(
      'brady3',
      'yatzee3'
    );
    const numGames = 100;
    await createGameServer('1.2.0.3');
    await createGameServer('1.2.0.4');
    for (let i = 0; i < numGames; i++) {
      await gameutils.configureGame(playerId, clubCode, holdemGameInput);
    }
    let clubGames = await gameutils.getClubGames(playerId, clubCode);
    // we can get only 20 games
    expect(clubGames).toHaveLength(20);
    const firstGame = clubGames[0];
    const lastGame = clubGames[19];
    logger.debug(JSON.stringify(firstGame));
    logger.debug(JSON.stringify(lastGame));
    clubGames = await gameutils.getClubGames(playerId, clubCode, {
      prev: lastGame.pageId,
      count: 5,
    });
    expect(clubGames).toHaveLength(5);
  });

  test('join a club game', async () => {
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.7');
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const player1Id = await clubutils.createPlayer('player1', 'abc123');
    const player2Id = await clubutils.createPlayer('adam', '1243ABC');

    // Join a game
    const data = await gameutils.joinGame(player1Id, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(player2Id, game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // change seat before buyin
    const data3 = await gameutils.joinGame(player1Id, game.gameCode, 3);
    expect(data3).toBe('WAIT_FOR_BUYIN');

    // buyin
    const resp = await gameutils.buyin(player1Id, game.gameCode, 100);
    expect(resp).toBe('APPROVED');

    // change seat after buyin
    const data4 = await gameutils.joinGame(player1Id, game.gameCode, 1);
    expect(data4).toBe('PLAYING');
  });

  test('buyIn for a club game', async () => {
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.8');
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const player1Id = await clubutils.createPlayer('player1', 'abc123');
    const player2Id = await clubutils.createPlayer('adam', '1243ABC');

    const data = await gameutils.joinGame(player1Id, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(player2Id, game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // Buyin with autoBuyinApproval true
    const resp = await gameutils.buyin(player1Id, game.gameCode, 100);
    expect(resp).toBe('APPROVED');

    // setting autoBuyinApproval false and creditLimit
    const resp1 = await clubutils.updateClubMember(
      clubCode,
      ownerId,
      player1Id,
      {
        autoBuyinApproval: false,
        creditLimit: 200,
      }
    );
    expect(resp1.status).toBe('ACTIVE');

    // Buyin within credit limit and autoBuyinApproval false
    const resp2 = await gameutils.buyin(player1Id, game.gameCode, 100);
    expect(resp2).toBe('APPROVED');

    // Buyin more than credit limit and autoBuyinApproval false
    const resp3 = await gameutils.buyin(player1Id, game.gameCode, 100);
    expect(resp3).toBe('WAITING_FOR_APPROVAL');
  });

  test('approve buyIn for a club game', async () => {
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.9');
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const player1Id = await clubutils.createPlayer('player1', 'abc123');
    const player2Id = await clubutils.createPlayer('adam', '1243ABC');

    const data = await gameutils.joinGame(player1Id, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(player2Id, game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    // setting autoBuyinApproval false and creditLimit
    const resp1 = await clubutils.updateClubMember(
      clubCode,
      ownerId,
      player1Id,
      {
        autoBuyinApproval: false,
      }
    );
    expect(resp1.status).toBe('ACTIVE');

    // Buyin more than credit limit and autoBuyinApproval false
    const resp3 = await gameutils.buyin(player1Id, game.gameCode, 100);
    expect(resp3).toBe('WAITING_FOR_APPROVAL');

    // Approve a buyin as host
    const resp4 = await gameutils.approveBuyIn(
      ownerId,
      player1Id,
      game.gameCode,
      100
    );
    expect(resp4).toBe('APPROVED');

    try {
      // Approve a buyin as player
      const resp5 = await gameutils.approveBuyIn(
        player2Id,
        player1Id,
        game.gameCode,
        100
      );
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Failed to update buyin');
    }
  });

  test('get my game state', async () => {
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.1.9');
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const player1Id = await clubutils.createPlayer('player1', 'abc123');
    const player2Id = await clubutils.createPlayer('adam', '1243ABC');

    const data = await gameutils.joinGame(player1Id, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(player2Id, game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    const resp = await gameutils.myGameState(player1Id, game.gameCode);
    expect(resp.buyInStatus).toBeNull();
    expect(resp.playerUuid).toBe(player1Id);
    expect(resp.buyIn).toBe(0);
    expect(resp.stack).toBe(0);
    expect(resp.status).toBe('WAIT_FOR_BUYIN');
    expect(resp.playingFrom).toBeNull();
    expect(resp.waitlistNo).toBe(0);
    expect(resp.seatNo).toBe(1);

    const resp1 = await gameutils.buyin(player1Id, game.gameCode, 100);
    expect(resp1).toBe('APPROVED');

    const resp2 = await gameutils.myGameState(player1Id, game.gameCode);
    expect(resp2.buyInStatus).toBe('APPROVED');
    expect(resp2.playerUuid).toBe(player1Id);
    expect(resp2.buyIn).toBe(100);
    expect(resp2.stack).toBe(100);
    expect(resp2.status).toBe('PLAYING');
    expect(resp2.playingFrom).toBeNull();
    expect(resp2.waitlistNo).toBe(0);
    expect(resp2.seatNo).toBe(1);
  });

  test('get table game state', async () => {
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.1.2');
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const player1Id = await clubutils.createPlayer('player1', 'abc123');
    const player2Id = await clubutils.createPlayer('adam', '1243ABC');

    const data = await gameutils.joinGame(player1Id, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(player2Id, game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    const data2 = await gameutils.tableGameState(player1Id, game.gameCode);
    data2.map(resp => {
      expect(resp.buyInStatus).toBeNull();
      expect(
        resp.playerUuid == player1Id || resp.playerUuid == player2Id
      ).toBeTruthy();
      expect(resp.buyIn).toBe(0);
      expect(resp.stack).toBe(0);
      expect(resp.status).toBe('WAIT_FOR_BUYIN');
      expect(resp.playingFrom).toBeNull();
      expect(resp.waitlistNo).toBe(0);
      expect(resp.seatNo == 1 || resp.seatNo == 2).toBeTruthy();
    });
  });

  test('take a break', async () => {
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.1.3');
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const player1Id = await clubutils.createPlayer('player1', 'abc123');
    const player2Id = await clubutils.createPlayer('adam', '1243ABC');

    const data = await gameutils.joinGame(player1Id, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(player2Id, game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    const resp3 = await gameutils.takeBreak(player1Id, game.gameCode);
    expect(resp3).toBe('TAKING_BREAK');

    const gameID = await gameutils.getGameById(game.gameCode);
    const player1ID = await handutils.getPlayerById(player1Id);
    try {
      await axios.post(
        `${GAMESERVER_API}/update-break-time/gameId/${gameID}/playerId/${player1ID}`
      );
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

  test('leave a game', async () => {
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.1.4');
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const player1Id = await clubutils.createPlayer('player1', 'abc123');
    const player2Id = await clubutils.createPlayer('adam', '1243ABC');

    const data = await gameutils.joinGame(player1Id, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');
    const data1 = await gameutils.joinGame(player2Id, game.gameCode, 2);
    expect(data1).toBe('WAIT_FOR_BUYIN');

    const resp3 = await gameutils.leaveGame(player1Id, game.gameCode);
    expect(resp3).toBe('LEAVING_GAME');

    const gameID = await gameutils.getGameById(game.gameCode);
    const player1ID = await handutils.getPlayerById(player1Id);
    await axios.post(`${GAMESERVER_API}/update-player-game-state`, {
      playerId: player1ID,
      gameId: gameID,
      status: 'LEFT',
    });

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

  test('seat change functionality', async () => {
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.1.5');
    const game = await gameutils.configureGame(
      ownerId,
      clubCode,
      holdemGameInput
    );
    const player1Id = await clubutils.createPlayer('player1', 'abc123');

    // join a game
    const data = await gameutils.joinGame(player1Id, game.gameCode, 1);
    expect(data).toBe('WAIT_FOR_BUYIN');

    // buyin
    const data2 = await gameutils.buyin(player1Id, game.gameCode, 100);
    expect(data2).toBe('APPROVED');

    // request seat change
    const resp1 = await gameutils.requestSeatChange(player1Id, game.gameCode);
    expect(resp1).not.toBeNull();

    // get all requested seat changes
    const resp3 = await gameutils.seatChangeRequests(player1Id, game.gameCode);
    expect(resp3[0].seatChangeConfirmed).toBe(false);

    // confirm seat change
    const resp4 = await gameutils.confirmSeatChange(player1Id, game.gameCode);
    expect(resp4).toBe(true);

    // get all requested seat change
    const resp5 = await gameutils.seatChangeRequests(player1Id, game.gameCode);
    expect(resp5[0].seatChangeConfirmed).toBe(true);
  });
});
