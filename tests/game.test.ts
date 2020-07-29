import {resetDatabase, getClient, PORT_NUMBER} from './utils/utils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
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
      mutation: gameutils.startGameQuery,
    });
    logger.debug(resp, clubCode);
    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeNull();
    const startedGame = resp.data.startedGame;
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
    const [clubCode, playerId] = await clubutils.createClub('brady1', 'yatzee2');
    await createGameServer('1.2.0.2');
    const game1 = await gameutils.startGame(playerId, clubCode, holdemGameInput);
    const game2 = await gameutils.startGame(playerId, clubCode, holdemGameInput);
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
    const [clubCode, playerId] = await clubutils.createClub('brady3', 'yatzee3');
    const numGames = 100;
    await createGameServer('1.2.0.3');
    await createGameServer('1.2.0.4');
    for (let i = 0; i < numGames; i++) {
      await gameutils.startGame(playerId, clubCode, holdemGameInput);
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
});
