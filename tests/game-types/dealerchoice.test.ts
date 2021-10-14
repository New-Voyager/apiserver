import {anyPendingUpdates, getClient, getNextHandInfo, moveToNextHand, processPendingUpdates, resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {buyIn, configureGameQuery, createGameServer, joinGame, startGame} from '../game/utils';
import { GameType } from '../../src/entity/types';
import { chooseGame } from '../utils/game.testutils';

export const dealerChoiceGameInput = {
  gameType: 'DEALER_CHOICE',
  title: 'Friday game',
  smallBlind: 1.0,
  bigBlind: 2.0,
  straddleBet: 4.0,
  utgStraddleAllowed: true,
  buttonStraddleAllowed: false,
  minPlayers: 2,
  maxPlayers: 4,
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
  buyInMax: 1000,
  actionTime: 30,
  muckLosingHand: true,
  waitlistSittingTimeout: 5,
  rewardIds: [] as any,
  dealerChoiceOrbit: true,
  dealerChoiceGames: [
    'HOLDEM',
    'PLO',
    'PLO_HILO',
  ]
};

export const configureGame = async ({playerId, clubCode}) => {
  const resp = await getClient(playerId).mutate({
    variables: {
      clubCode: clubCode,
      gameInput: dealerChoiceGameInput,
    },
    mutation: configureGameQuery,
  });

  return resp;
};
describe('dealer choice tests', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('startGame', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});

    const playersNum = new Array(3).fill(0);

    await joinGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 4,
      location: {
        lat: 100,
        long: 100,
      },
    });

    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});

    let playersIdsInSeats: any = {};
    playersIdsInSeats[4] = playerId;

    const playerIds = await Promise.all(playersNum.map(async (value, index) => {
      const playerId = await clubutils.createPlayer(`adam${index}`, `1243ABC${index}`);
      playersIdsInSeats[index+1] = playerId;
      await clubutils.playerJoinsClub(clubCode, playerId);
      await joinGame({
        ownerId: playerId,
        gameCode: resp.data.configuredGame.gameCode,
        seatNo: index + 1,
        location: {
          lat: 100,
          long: 100,
        },
      });
      
      await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
      
      return playerId;
    }));
    const gameCode = resp.data.configuredGame.gameCode;
    const gameId = resp.data.configuredGame.gameID;
    const data = await startGame({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode })
    expect(data.status).toEqual('ACTIVE');

    // first hand
    // player makes a choice
    await chooseGame(playersIdsInSeats[1], gameCode, GameType.PLO);

    // move to next hand
    await moveToNextHand(0, gameCode, 1);

    // get next hand info
    let nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    expect(nextHand.gameType).toEqual(GameType.PLO);

    // hand num 2
    let anyUpdates = await anyPendingUpdates(gameId);
    expect(anyUpdates).toBeFalsy();
    await processPendingUpdates(gameId);
    await moveToNextHand(0, gameCode, 2);
    nextHand = await getNextHandInfo(gameCode);
    expect(nextHand.gameType).toEqual(GameType.PLO);
    await chooseGame(playersIdsInSeats[2], gameCode, GameType.PLO_HILO);

    // hand num 3
    await processPendingUpdates(gameId);
    await moveToNextHand(0, gameCode, 3);
    nextHand = await getNextHandInfo(gameCode);
    expect(nextHand.gameType).toEqual(GameType.PLO);

    // hand num 4
    await processPendingUpdates(gameId);
    await moveToNextHand(0, gameCode, 4);
    nextHand = await getNextHandInfo(gameCode);
    expect(nextHand.gameType).toEqual(GameType.PLO);
    
    await chooseGame(playersIdsInSeats[2], gameCode, GameType.PLO_HILO);
    // move to next hand
    await moveToNextHand(0, gameCode, 5);

    // get next hand info
    nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    expect(nextHand.gameType).toEqual(GameType.PLO_HILO);
  });
});
