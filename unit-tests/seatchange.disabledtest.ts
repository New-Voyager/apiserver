import {initializeSqlLite} from './utils';
import {createGameServer} from '@src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {createPlayer} from '@src/resolvers/player';
import {createClub, joinClub} from '@src/resolvers/club';
import {configureGame, startGame} from '@src/resolvers/game';
import {buyIn, joinGame, setBuyInLimit, reload,   takeBreak,
  sitBack,
  leaveGame} from '../src/resolvers/playersingame';
import {saveReward} from '../src/resolvers/reward';
import {approveMember} from '../src/resolvers/club';
import {SeatChangeProcess} from '../src/repositories/seatchange';
import {Cache} from '../src/cache/index';

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

describe('seat change APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('gametest: seat change functionality', async () => {
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
      ];
      const [owner, club, playerUuids] = await createClubWithMembers(
        ownerInput,
        clubInput,
        playersInput
      );
      const player1 = owner;
      const player2 = playerUuids[0];

      const gameInput = holdemGameInput;
      gameInput.maxPlayers = 3;
      gameInput.minPlayers = 2;
      gameInput.waitlistSittingTimeout = 5;
      await createReward(owner, club);
      const game = await configureGame(owner, club, gameInput);

      // Join a game
      await joinGame(player1, game.gameCode, 1);
      await joinGame(player2, game.gameCode, 2);

      // buyin
      await buyIn(player1, game.gameCode, 100);
      await buyIn(player2, game.gameCode, 100);

      await startGame(owner, game.gameCode);

      const createdGame = await Cache.getGame(game.gameCode);
      const createdPlayer1 = await Cache.getPlayer(player1);
      const createdPlayer2 = await Cache.getPlayer(player2);
      const seatChange = new SeatChangeProcess(createdGame);

      // request seat change
      const resp1 = await seatChange.requestSeatChange(createdPlayer1);
      expect(resp1).not.toBeNull();
      const resp2 = await seatChange.requestSeatChange(createdPlayer2);
      expect(resp2).not.toBeNull();

      // get all requested seat changes
      const resp3 = await seatChange.seatChangeRequests(createdPlayer1);
      expect(resp3).toHaveLength(2);

      // start seat change timer
      await seatChange.start();

      // confirm seat change
      const resp4 = await seatChange.confirmSeatChange(createdPlayer1, 3);
      expect(resp4).toBe(true);
      const resp5 = await seatChange.confirmSeatChange(createdPlayer2, 3);
      expect(resp5).toBe(true);

      // wait for 6 seconds
      await sleep(6000);

      // finish seat change
      const resp6 = await seatChange.finish();
      expect(resp6).toHaveLength(1);
      expect(resp6[0].player.uuid).toBe(player1);
      expect(resp6[0].seatNo).toBe(3);

      // get all requested seat changes
      const resp7 = await seatChange.seatChangeRequests(createdPlayer1);
      expect(resp7).toHaveLength(1);
      expect(resp7[0].player.uuid).toBe(player2);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });
});
