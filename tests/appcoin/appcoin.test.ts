import {anyPendingUpdates, getClient, getNextHandInfo, moveToNextHand, processPendingUpdates, resetDatabase, sleep, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {buyIn, configureGame, configureGameQuery, createGameServer, joinGame, startGame} from '../game/utils';
import { GameStatus, GameType } from '../../src/entity/types';
import { gameInfo, takeBreak } from '../utils/game.testutils';
import _ from 'lodash';
import { getAppSettings } from '../../src/firebase';
import { timerCallbackHandler } from '../../src/repositories/timer';
import { GAME_COIN_CONSUME_TIME } from '../../src/repositories/types';
import { AppCoinRepository } from '../../src/repositories/appcoin';

describe('appCoin consumption APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    const appSettings = getAppSettings();
    appSettings.gameCoinsPerBlock = 10;
    appSettings.newUserFreeCoins = 5;
    appSettings.clubHostFreeCoins = 20;
    appSettings.consumeTime = 5;
    done();
  });

  afterAll(async done => {
    done();
  });

  test('app coins', async () => {
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
    // move to next hand
    await moveToNextHand(0, gameCode, 1);
    let nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    await sleep(5000);
    await timerCallbackHandler(gameId, 0, GAME_COIN_CONSUME_TIME);
    await processPendingUpdates(gameId);

    // hand num 2
    await processPendingUpdates(gameId);
    await moveToNextHand(0, gameCode, 2);
    nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    await sleep(5000);
    await timerCallbackHandler(gameId, 0, GAME_COIN_CONSUME_TIME);
    await processPendingUpdates(gameId);

    // hand num 3
    await processPendingUpdates(gameId);
    await moveToNextHand(0, gameCode, 3);
    nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    await sleep(5000);
    await timerCallbackHandler(gameId, 0, GAME_COIN_CONSUME_TIME);
    await processPendingUpdates(gameId);

    // hand num 3
    await moveToNextHand(0, gameCode, 4);
    nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    await sleep(5000);
    await timerCallbackHandler(gameId, 0, GAME_COIN_CONSUME_TIME);
    await processPendingUpdates(gameId);
    
    // game ended
    const gi = await gameInfo(playerId, gameCode);
    expect(gi.status).toEqual(GameStatus[GameStatus.ENDED]);
  });

  test('app coins/add coins', async () => {
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
    // move to next hand
    await moveToNextHand(0, gameCode, 1);
    let nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    await sleep(5000);
    await timerCallbackHandler(gameId, 0, GAME_COIN_CONSUME_TIME);
    await processPendingUpdates(gameId);

    // hand num 2
    await processPendingUpdates(gameId);
    await moveToNextHand(0, gameCode, 2);
    nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    await AppCoinRepository.addCoins(50, 0, playerId);
    await sleep(5000);
    await timerCallbackHandler(gameId, 0, GAME_COIN_CONSUME_TIME);
    await processPendingUpdates(gameId);

    // hand num 3
    await processPendingUpdates(gameId);
    await moveToNextHand(0, gameCode, 3);
    nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    await sleep(5000);
    await timerCallbackHandler(gameId, 0, GAME_COIN_CONSUME_TIME);
    await processPendingUpdates(gameId);

    // hand num 3
    await moveToNextHand(0, gameCode, 4);
    nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    await sleep(5000);
    await timerCallbackHandler(gameId, 0, GAME_COIN_CONSUME_TIME);
    await processPendingUpdates(gameId);
    
    // game ended
    let gi = await gameInfo(playerId, gameCode);
    expect(gi.status).toEqual(GameStatus[GameStatus.ACTIVE]);
  });  
});
