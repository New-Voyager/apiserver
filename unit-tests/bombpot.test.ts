import {initializeSqlLite} from './utils';
import {createGameServer} from '../src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '../src/resolvers/reset';
import {createPlayer, getPlayerById} from '../src/resolvers/player';
import {createClub, updateClubMember, joinClub} from '../src/resolvers/club';
import {GameRepository} from '../src/repositories/game';
import {NextHandProcess} from '../src/repositories/nexthand';
import {
  configureGame,
} from '../src/resolvers/game';
import {Cache} from '../src/cache/index';
import {saveReward} from '../src/resolvers/reward';
import {approveMember} from '../src/resolvers/club';
import {sleep} from './utils';

// Create a game with double board bomb pot
// setup to run a bomb pot every 10 seconds
// move to next hand
// get next hand and verify bomb pot flag is set in the NextHandimport {initializeSqlLite} from './utils';

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

  bombPotEnabled: true,
  doubleBoardBombPot: true,
  bombPotIntervalInSecs: 10,
  bombPotBet: 5,
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

async function createReward1(playerId, clubCode) {
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

describe('Game APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('gametest: Bomb Pot game create', async () => {
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
    //await createReward(owner, club);
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
    expect(startedGame.bombPotEnabled).toEqual(true);
    expect(startedGame.doubleBoardBombPot).toEqual(true);
    expect(startedGame.bombPotIntervalInSecs).toEqual(10);
    expect(startedGame.bombPotBet).toEqual(5);
  });

  test('gametest: Bomb Pot game running', async () => {
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
    const startedGame = await configureGame(owner, club, holdemGameInput);
    const player = await Cache.getPlayer(owner);
    const game = await Cache.getGame(startedGame.gameCode);
    await GameRepository.startGame(player, game);
    
    // get next hand information
    let nextHandProcess = new NextHandProcess(game.gameCode, 0);
    await nextHandProcess.moveToNextHand();
    let ret = await nextHandProcess.getNextHandInfo();
    expect(ret.bombPot).toEqual(true);
    expect(ret.doubleBoardBombPot).toEqual(true);
    expect(ret.bombPotBet).toEqual(5);

    // move to next hand
    nextHandProcess = new NextHandProcess(game.gameCode, 1);
    await nextHandProcess.moveToNextHand();
    ret = await nextHandProcess.getNextHandInfo();
    expect(ret.bombPot).toEqual(false);
    let now1 = new Date();
    await sleep(11000);
    let now2 = new Date();
    console.log(`now1: ${now1.toISOString()} now2: ${now2.toISOString()}`);
    nextHandProcess = new NextHandProcess(game.gameCode, 2);
    await nextHandProcess.moveToNextHand();
    ret = await nextHandProcess.getNextHandInfo();
    expect(ret.bombPot).toEqual(true);
    expect(ret.doubleBoardBombPot).toEqual(true);
    expect(ret.bombPotBet).toEqual(5);

    nextHandProcess = new NextHandProcess(game.gameCode, 3);
    await nextHandProcess.moveToNextHand();
    ret = await nextHandProcess.getNextHandInfo();
    expect(ret.bombPot).toEqual(false);
    expect(ret.doubleBoardBombPot).toEqual(true);
    expect(ret.bombPotBet).toEqual(5);

    nextHandProcess = new NextHandProcess(game.gameCode, 4);
    await nextHandProcess.moveToNextHand();
    ret = await nextHandProcess.getNextHandInfo();
    expect(ret.bombPot).toEqual(false);
    expect(ret.doubleBoardBombPot).toEqual(true);
    expect(ret.bombPotBet).toEqual(5);
    await sleep(11000);
    nextHandProcess = new NextHandProcess(game.gameCode, 5);
    await nextHandProcess.moveToNextHand();
    ret = await nextHandProcess.getNextHandInfo();
    expect(ret.bombPot).toEqual(true);
    expect(ret.doubleBoardBombPot).toEqual(true);
    expect(ret.bombPotBet).toEqual(5);
  });  
});

