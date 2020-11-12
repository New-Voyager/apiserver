import {initializeSqlLite} from './utils';
import {createGameServer} from '@src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {createPlayer} from '@src/resolvers/player';
import {createClub} from '@src/resolvers/club';
import {configureGame, configureGameByPlayer} from '@src/resolvers/game';
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
});
