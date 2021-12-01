import {initializeSqlLite} from './utils';
import {
  createClub,
  joinClub,
  approveMember,
  getClubById,
} from '../src/resolvers/club';
import {createPlayer, getPlayerById} from '../src/resolvers/player';
import {observeGame, observers, exitGame} from '../src/resolvers/observers';
import {saveReward} from '../src/resolvers/reward';
import {resetDB} from '../src/dev/resolvers/reset';
import {createGameServer} from '../src/internal/gameserver';
import {
  configureGame,
  startGame,
  endGame,
} from '../src/resolvers/game';
import {buyIn, joinGame, setBuyInLimit, reload,   takeBreak,
  sitBack,
  leaveGame} from '../src/resolvers/playersingame';
import { BuyInApprovalLimit } from '../src/entity/types';
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
];

const gameServer = {
  ipAddress: '10.1.1.1',
  currentMemory: 100,
  status: 'ACTIVE',
  url: 'htto://localhost:8080',
};

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
  buyInLimit: BuyInApprovalLimit.BUYIN_NO_LIMIT,
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
  return resp;
}

async function createClubWithMembers(
  ownerInput: any,
  clubInput: any,
  players: Array<any>
): Promise<[string, string, number, Array<string>, Array<number>]> {
  const ownerUuid = await createPlayer({player: ownerInput});
  clubInput.ownerUuid = ownerUuid;
  const clubCode = await createClub(ownerUuid, clubInput);
  const clubId = await getClubById(ownerUuid, clubCode);
  const playerUuids = new Array<string>();
  const playerIds = new Array<number>();
  for (const playerInput of players) {
    const playerUuid = await createPlayer({player: playerInput});
    const playerId = (await getPlayerById(playerUuid)).id;
    await joinClub(playerUuid, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid);
    playerUuids.push(playerUuid);
    playerIds.push(playerId);
  }
  return [ownerUuid, clubCode, clubId, playerUuids, playerIds];
}

describe('Observers APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Simple Observer tests', async () => {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //await createReward(owner, clubCode);
    await createGameServer(gameServer);
    const game = await configureGame(owner, clubCode, holdemGameInput);
    await startGame(owner, game.gameCode);

    const resp1 = await observers(owner, game.gameCode);
    expect(resp1).toHaveLength(0);
    const resp2 = await exitGame(playerUuids[0], game.gameCode);
    expect(resp2).toBe(true);

    const resp3 = await observeGame(playerUuids[0], game.gameCode);
    expect(resp3).toBe(true);
    const resp4 = await observeGame(playerUuids[1], game.gameCode);
    expect(resp4).toBe(true);
    const resp5 = await observers(owner, game.gameCode);
    expect(resp5).toHaveLength(2);

    const resp6 = await exitGame(playerUuids[0], game.gameCode);
    expect(resp6).toBe(true);
    const resp7 = await observers(owner, game.gameCode);
    expect(resp7).toHaveLength(1);
    expect(resp7[0].uuid).toBe(playerUuids[1]);

    await endGame(owner, game.gameCode);
    const resp8 = await observers(owner, game.gameCode);
    expect(resp8).toHaveLength(0);
  });

  test('Observer tests - with join game', async () => {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //await createReward(owner, clubCode);
    await createGameServer(gameServer);
    const game = await configureGame(owner, clubCode, holdemGameInput);
    await startGame(owner, game.gameCode);

    const resp1 = await observers(owner, game.gameCode);
    expect(resp1).toHaveLength(0);
    const resp2 = await exitGame(playerUuids[0], game.gameCode);
    expect(resp2).toBe(true);

    const resp3 = await observeGame(playerUuids[0], game.gameCode);
    expect(resp3).toBe(true);
    const resp4 = await observeGame(playerUuids[1], game.gameCode);
    expect(resp4).toBe(true);
    const resp5 = await observers(owner, game.gameCode);
    expect(resp5).toHaveLength(2);

    await joinGame(playerUuids[0], game.gameCode, 1);
    const resp6 = await observers(owner, game.gameCode);
    expect(resp6).toHaveLength(1);
    expect(resp6[0].uuid).toBe(playerUuids[1]);

    await endGame(owner, game.gameCode);
    const resp7 = await observers(owner, game.gameCode);
    expect(resp7).toHaveLength(0);
  });
});
