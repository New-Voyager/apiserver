import {anyPendingUpdates, getClient, getNextHandInfo, moveToNextHand, processPendingUpdates, resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {buyIn, configureGame, configureGameQuery, createGameServer, joinGame, startGame} from '../game/utils';
import { GameType } from '../../src/entity/types';
import { takeBreak } from '../utils/game.testutils';
import _ from 'lodash';

describe('takeBreak APIs', () => {
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
    // move to next hand
    await moveToNextHand(0, gameCode, 1);

    // get next hand info
    let nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    await processPendingUpdates(gameId);

    // take break
    await takeBreak(playerId, gameCode);

    // hand num 2
    await processPendingUpdates(gameId);
    await moveToNextHand(0, gameCode, 2);
    nextHand = await getNextHandInfo(gameCode);
    console.log(JSON.stringify(nextHand));
    const players = _.keyBy(nextHand.playersInSeats, 'seatNo');
    expect(players[1].inhand).toBeTruthy();
    expect(players[2].inhand).toBeTruthy();
    expect(players[3].inhand).toBeTruthy();
    expect(players[4].inhand).toBeFalsy();
  });
});
