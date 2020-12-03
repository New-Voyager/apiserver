import {initializeSqlLite} from './utils';
import {createGameServer} from '@src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {createPlayer} from '@src/resolvers/player';
import {createClub, updateClubMember} from '@src/resolvers/club';
import {
  configureGame,
  configureGameByPlayer,
  joinGame,
  startGame,
  buyIn,
  approveBuyIn,
  myGameState,
  tableGameState,
  takeBreak,
  leaveGame,
  requestSeatChange,
  confirmSeatChange,
  seatChangeRequests,
} from '@src/resolvers/game';
import {getGame} from '@src/cache/index';

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

enum ClubMemberStatus {
  UNKNOWN,
  INVITED,
  PENDING,
  DENIED,
  ACTIVE,
  LEFT,
  KICKEDOUT,
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

  test('Start a new game', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.1.1:8080',
    };
    try {
      await createGameServer(gameServer1);
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
      const startedGame = await configureGame(player, club, holdemGameInput);
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
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Start a new game by player', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.1.1:8080',
    };
    try {
      await createGameServer(gameServer1);
      const player = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const startedGame = await configureGameByPlayer(player, holdemGameInput);
      // console.log(startedGame);
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
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get game by uuid', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.1.1:8080',
    };
    try {
      await createGameServer(gameServer1);
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
      const startedGame = await configureGame(player, club, holdemGameInput);
      const gameData = await getGame(startedGame.gameCode);
      expect(gameData.id).not.toBe(null);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Join a game', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.5',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.1.5:8080',
    };
    try {
      await createGameServer(gameServer1);
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      const game = await configureGame(owner, club, holdemGameInput);
      const player1 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const player2 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });

      // Join a game
      const data = await joinGame(player1, game.gameCode, 1);
      expect(data).toBe('WAIT_FOR_BUYIN');
      const data1 = await joinGame(player2, game.gameCode, 2);
      expect(data1).toBe('WAIT_FOR_BUYIN');

      // change seat before buyin
      const data3 = await joinGame(player1, game.gameCode, 3);
      expect(data3).toBe('WAIT_FOR_BUYIN');

      // buyin
      const resp = await buyIn(player1, game.gameCode, 100);
      expect(resp).toBe('APPROVED');

      // change seat after buyin
      const data4 = await joinGame(player1, game.gameCode, 1);
      expect(data4).toBe('PLAYING');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Buyin for a game', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.6',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.1.6:8080',
    };
    try {
      await createGameServer(gameServer1);
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      const game = await configureGame(owner, club, holdemGameInput);
      const player1 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const player2 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });

      // Join a game
      const data = await joinGame(player1, game.gameCode, 1);
      expect(data).toBe('WAIT_FOR_BUYIN');
      const data1 = await joinGame(player2, game.gameCode, 2);
      expect(data1).toBe('WAIT_FOR_BUYIN');

      // Buyin with autoBuyinApproval true
      const resp = await buyIn(player1, game.gameCode, 100);
      expect(resp).toBe('APPROVED');

      // setting autoBuyinApproval false and creditLimit
      const resp1 = await updateClubMember(owner, player1, club, {
        balance: 10,
        creditLimit: 200,
        notes: 'Added credit limit',
        status: ClubMemberStatus['ACTIVE'],
        isManager: false,
        autoBuyinApproval: false,
      });
      expect(resp1).toBe(ClubMemberStatus['ACTIVE']);

      // Buyin within credit limit and autoBuyinApproval false
      const resp2 = await buyIn(player1, game.gameCode, 100);
      expect(resp2).toBe('APPROVED');

      // Buyin more than credit limit and autoBuyinApproval false
      const resp3 = await buyIn(player1, game.gameCode, 100);
      expect(resp3).toBe('WAITING_FOR_APPROVAL');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Approve Buyin for a game', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.7',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.1.7:8080',
    };
    try {
      await createGameServer(gameServer1);
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      const game = await configureGame(owner, club, holdemGameInput);
      const player1 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const player2 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });

      // Join a game
      const data = await joinGame(player1, game.gameCode, 1);
      expect(data).toBe('WAIT_FOR_BUYIN');
      const data1 = await joinGame(player2, game.gameCode, 2);
      expect(data1).toBe('WAIT_FOR_BUYIN');

      // setting autoBuyinApproval false and creditLimit
      const resp1 = await updateClubMember(owner, player1, club, {
        balance: 0,
        creditLimit: 0,
        notes: 'Added credit limit',
        status: ClubMemberStatus['ACTIVE'],
        isManager: false,
        autoBuyinApproval: false,
      });
      expect(resp1).toBe(ClubMemberStatus['ACTIVE']);

      // Buyin within credit limit and autoBuyinApproval false
      const resp2 = await buyIn(player1, game.gameCode, 100);
      expect(resp2).toBe('WAITING_FOR_APPROVAL');

      // Approve a buyin as host
      const resp3 = await approveBuyIn(owner, player1, game.gameCode, 100);
      expect(resp3).toBe('APPROVED');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get my game state', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.8',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.1.8:8080',
    };
    try {
      await createGameServer(gameServer1);
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      const game = await configureGame(owner, club, holdemGameInput);
      const player1 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const player2 = await createPlayer({
        player: {
          name: 'player_name1',
          deviceId: 'abc1234',
        },
      });

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
      expect(resp.waitlistNo).toBe(0);
      expect(resp.seatNo).toBe(1);

      const resp1 = await buyIn(player1, game.gameCode, 100);
      expect(resp1).toBe('APPROVED');

      const resp2 = await myGameState(player1, game.gameCode);
      expect(resp2.buyInStatus).toBe('APPROVED');
      expect(resp2.playerUuid).toBe(player1);
      expect(resp2.buyIn).toBe(100);
      expect(resp2.stack).toBe(100);
      expect(resp2.status).toBe('PLAYING');
      expect(resp2.playingFrom).toBeNull();
      expect(resp2.waitlistNo).toBe(0);
      expect(resp2.seatNo).toBe(1);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get table game state', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.9',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.1.9:8080',
    };
    try {
      await createGameServer(gameServer1);
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      const game = await configureGame(owner, club, holdemGameInput);
      const player1 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const player2 = await createPlayer({
        player: {
          name: 'player_name1',
          deviceId: 'abc1234',
        },
      });

      // Join a game
      const data = await joinGame(player1, game.gameCode, 1);
      expect(data).toBe('WAIT_FOR_BUYIN');
      const data1 = await joinGame(player2, game.gameCode, 2);
      expect(data1).toBe('WAIT_FOR_BUYIN');

      const data2 = await tableGameState(player1, game.gameCode);
      data2.map(resp => {
        expect(resp.buyInStatus).toBeUndefined();
        expect(
          resp.playerUuid == player1 || resp.playerUuid == player2
        ).toBeTruthy();
        expect(resp.buyIn).toBe(0);
        expect(resp.stack).toBe(0);
        expect(resp.status).toBe('WAIT_FOR_BUYIN');
        expect(resp.playingFrom).toBeNull();
        expect(resp.waitlistNo).toBe(0);
        expect(resp.seatNo == 1 || resp.seatNo == 2).toBeTruthy();
      });
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Take a break', async () => {
    const gameServer1 = {
      ipAddress: '10.1.2.1',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.2.1:8080',
    };
    try {
      await createGameServer(gameServer1);
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      const game = await configureGame(owner, club, holdemGameInput);
      const player1 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });

      const data2 = await startGame(player1, game.gameCode);
      expect(data2).toBe('ACTIVE');

      // Join a game
      const data = await joinGame(player1, game.gameCode, 1);
      expect(data).toBe('WAIT_FOR_BUYIN');
      const data1 = await buyIn(player1, game.gameCode, 100);
      expect(data1).toBe('APPROVED');

      const resp3 = await takeBreak(player1, game.gameCode);
      expect(resp3).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('leave a game', async () => {
    const gameServer1 = {
      ipAddress: '10.1.2.2',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.2.2:8080',
    };
    try {
      await createGameServer(gameServer1);
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      const game = await configureGame(owner, club, holdemGameInput);
      const player1 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });

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
      expect(data1).toBe('APPROVED');
      const resp = await leaveGame(player1, game.gameCode);
      expect(resp).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('seat change functionality', async () => {
    const gameServer1 = {
      ipAddress: '10.1.2.3',
      currentMemory: 100,
      status: 'ACTIVE',
      url: 'http://10.1.2.2:8080',
    };
    try {
      await createGameServer(gameServer1);
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      const game = await configureGame(owner, club, holdemGameInput);
      const player1 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });

      // Join a game
      const data = await joinGame(player1, game.gameCode, 1);
      expect(data).toBe('WAIT_FOR_BUYIN');

      // buyin
      const data1 = await buyIn(player1, game.gameCode, 100);
      expect(data1).toBe('APPROVED');

      // request seat change
      const resp1 = await requestSeatChange(player1, game.gameCode);
      expect(resp1).not.toBeNull();

      // get all requested seat changes
      const resp3 = await seatChangeRequests(player1, game.gameCode);
      expect(resp3[0].seatChangeConfirmed).toBe(false);

      // confirm seat change
      const resp4 = await confirmSeatChange(player1, game.gameCode);
      expect(resp4).toBe(true);

      // get all requested seat changes
      const resp5 = await seatChangeRequests(player1, game.gameCode);
      expect(resp5[0].seatChangeConfirmed).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });
});
