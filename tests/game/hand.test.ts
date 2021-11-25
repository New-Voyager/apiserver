import {INTERNAL_PORT, resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils';
import * as handutils from '../utils/hand.testutils';
import {buyIn, configureGame, createGameServer, getCompletedGame, getPlayerById, joinGame, startGame} from './utils';
import {endGame, gameInfo} from '../utils/game.testutils';
import axios from 'axios'
import fs from 'fs';
import * as glob from 'glob';
import _ from 'lodash'
import { getlogDatabyGame } from '../utils/reward.testutils';

const SERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

describe('hand game APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('hand game', async () => {
    const [clubCode, playerId] = await clubutils.createClub(`brady`, `yatzee`);
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});
    const gameId = await gameutils.getGameById(resp.data.configuredGame.gameCode);
    const playersNum = new Array(8).fill(0);

    await joinGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 9,
      location: {
        lat: 100,
        long: 100,
      },
    });

    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});

    const playerIds = await Promise.all(playersNum.map(async (value, index) => {
      const playerId = await clubutils.createPlayer(`adam${index}`, `1243ABC${index}`);
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
    }))
    await startGame({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode })

    const directory = 'int-test/hands';
    const files = (await glob.sync('**/*.json', {
      onlyFiles: false,
      cwd: directory,
      deep: 5,
    })).sort(new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'}).compare);

    await axios.post(`${SERVER_API}/move-to-next-hand/game_num/${resp.data.configuredGame.gameCode}/hand_num/1`)
    const data = await axios.get(`${SERVER_API}/next-hand-info/game_num/${resp.data.configuredGame.gameCode}`)

    let aggregateData = {}
    for (const file of files) {
      const handData = JSON.parse(fs.readFileSync(`${directory}/${file}`, { encoding: 'utf-8' }))
      await Promise.all([...playerIds, playerId].map(async (player, index) => {
        const newplayerId = await getPlayerById({ownerId: player});
        handData.result.playerInfo[index + 1].id = newplayerId.playerById.id
      }))
      handData.gameId = String(gameId);

      await axios.post(`${SERVER_API}/save-hand/gameId/${gameId}/handNum/${handData.handNum}`, handData)

      const rawData = await gameInfo(playerId, resp.data.configuredGame.gameCode)

      const finalStackData = rawData.seatInfo.playersInSeats;

      const expectedBalance = _.sortBy(Object.values(handData.result.playerInfo).map((info: any) => {
        return {
          balance: info.balance.after / 100,  // cents to chips since we used internal save-hand api to seed cents
          playerId: info.id,
        }
      }), 'playerId')
      const playersInfoBalance = _.sortBy(finalStackData.map((item) => {
        return {
          balance: item.stack,
          playerId: item.playerId,
        };
      }), 'playerId')
      
      expect(playersInfoBalance).toEqual(expectedBalance)

      await axios.get(`${SERVER_API}/any-pending-updates/gameId/${gameId}`)
      await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)
      if (handData.handNum + 1 < 11) {
        await axios.post(`${SERVER_API}/move-to-next-hand/game_num/${resp.data.configuredGame.gameCode}/hand_num/${handData.handNum + 1}`)
        const data: any = await axios.get(`${SERVER_API}/next-hand-info/game_num/${resp.data.configuredGame.gameCode}`)
      }

      Object.values(handData.result.playerInfo).map((info: any) => {
        if (!aggregateData[info.id]) aggregateData[info.id] = []

        aggregateData[info.id].push({
          handNum: handData.handNum,
          before: info.balance.before,
          after: info.balance.after,
        })

        return info
      })
      const test = await handutils.saveBookmarkHand(resp.data.configuredGame.gameCode, playerId, handData.handNum);
      console.log('test', test);
    }
    console.log('get bookmarked hands');
    const bookmarkedHand = await handutils.getBookmarkedHands(playerId);
    expect(bookmarkedHand).toHaveLength(10);
    console.log('get last hand history');
    const resp1 = await handutils.getLastHandHistory(playerId, resp.data.configuredGame.gameCode);
    expect(resp1.gameType).toBe('HOLDEM');
    expect(resp1.wonAt).toBe('SHOW_DOWN');
    expect(resp1.handNum).toBe(10);
    console.log('get specific hand history');

    const handHistory = await handutils.getSpecificHandHistory(
      playerId,
      resp.data.configuredGame.gameCode,
      1
    );
    expect(handHistory.gameType).toBe('HOLDEM');
    expect(handHistory.handNum).toBe(1);
    console.log('bookmark hand');

    const test = await handutils.saveBookmarkHand(resp.data.configuredGame.gameCode, playerId, 1)
    console.log(test)
    const t1 = await handutils.removeBookmark(playerId, 1)
    console.log(t1);

    console.log('end game');

    await endGame(playerId, resp.data.configuredGame.gameCode);
    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)
    const status = await endGame(playerId, resp.data.configuredGame.gameCode);

    console.log('Waiting for post processing');
    await axios.post(`http://localhost:${INTERNAL_PORT}/admin/post-process-games`)
    console.log('Post processing done');
    await Promise.all(playerIds.map(async (playerId) => {
      const newplayerId = await getPlayerById({ownerId: playerId});
      console.log('Fetch completed game');
      const complData = await getCompletedGame({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode})
      console.log('Got completed game');

      const complGameData = complData.completedGame.stackStat.map(item => ({
        handNum: item.handNum,
        before: item.before,
        after: item.after,
      }))
      
      expect(complGameData).toEqual(aggregateData[newplayerId.playerById.id])
    }))
  
    expect(status).toEqual('ENDED');

  });

  test.skip('high-hand game', async () => {
    const [clubCode, playerId] = await clubutils.createClub(`brady`, `yatzee`);
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId, highHandTracked: true });
    const gameId = await gameutils.getGameById(resp.data.configuredGame.gameCode);
    const playersNum = new Array(3).fill(0);

    await joinGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 9,
      location: {
        lat: 100,
        long: 100,
      },
    });

    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});

    const playerIds = await Promise.all(playersNum.map(async (value, index) => {
      const playerId = await clubutils.createPlayer(`adam${index}`, `1243ABC${index}`);
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
    }))
    await startGame({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode })

    const directory = 'int-test/high-hand';
    const files = (await glob.sync('**/*.json', {
      onlyFiles: false,
      cwd: directory,
      deep: 5,
    })).sort(new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'}).compare);

    await axios.post(`${SERVER_API}/move-to-next-hand/game_num/${resp.data.configuredGame.gameCode}/hand_num/1`)
    const data = await axios.get(`${SERVER_API}/next-hand-info/game_num/${resp.data.configuredGame.gameCode}`)

    let aggregateData = {}
    let highHandResult = []
    for (const file of files) {
      const handData = JSON.parse(fs.readFileSync(`${directory}/${file}`, { encoding: 'utf-8' }))
      await Promise.all([...playerIds, playerId].map(async (player, index) => {
        const newplayerId = await getPlayerById({ownerId: player});
        handData.result.playerInfo[index + 1].id = newplayerId.playerById.id
      }))
      handData.gameId = String(gameId);

      await axios.post(`${SERVER_API}/save-hand/gameId/${gameId}/handNum/${handData.handNum}`, handData)

      const rawData = await gameInfo(playerId, resp.data.configuredGame.gameCode)

      const finalStackData = rawData.seatInfo.playersInSeats;

      const playersHandBalance = _.sortBy(Object.values(handData.result.playerInfo).map((info: any) => {
        return {
          balance: info.balance.after,
          playerId: info.id,
        }
      }), 'playerId')
      const playersInfoBalance = _.sortBy(finalStackData.map((item) => {
        return {
          balance: item.stack,
          playerId: item.playerId,
        };
      }), 'playerId')
      
      expect(playersHandBalance).toEqual(playersInfoBalance)

      await axios.get(`${SERVER_API}/any-pending-updates/gameId/${gameId}`)
      await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)
      if (handData.handNum + 1 < 5) {
        await axios.post(`${SERVER_API}/move-to-next-hand/game_num/${resp.data.configuredGame.gameCode}/hand_num/${handData.handNum + 1}`)
        const data: any = await axios.get(`${SERVER_API}/next-hand-info/game_num/${resp.data.configuredGame.gameCode}`)
      }

      Object.values(handData.result.playerInfo).map((info: any) => {
        if (!aggregateData[info.id]) aggregateData[info.id] = []

        aggregateData[info.id].push({
          handNum: handData.handNum,
          before: info.balance.before,
          after: info.balance.after,
        })

        return info
      })

    
      const hhResult: [] = handData.result.highHandWinners.map((winner) => {
        return {
          highHand: winner.hhCards,
          playerCards: winner.playerCards,
          handNum: handData.handNum,
        }
      })
      highHandResult.push(...hhResult)
    }

    await endGame(playerId, resp.data.configuredGame.gameCode);
    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)
    const status = await endGame(playerId, resp.data.configuredGame.gameCode);

    await axios.post(`http://localhost:${INTERNAL_PORT}/admin/post-process-games`)
    
    await Promise.all(playerIds.map(async (playerId) => {
      const newplayerId = await getPlayerById({ownerId: playerId});
      const complData = await getCompletedGame({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode})

      const complGameData = complData.completedGame.stackStat.map(item => ({
        handNum: item.handNum,
        before: item.before,
        after: item.after,
      }))
      
      expect(complGameData).toEqual(aggregateData[newplayerId.playerById.id])
    }))

    const hhData = await getlogDatabyGame(playerId, resp.data.configuredGame.gameCode);
    const highHandResponse = hhData.map((hhData) => {
      return {
        highHand: JSON.parse(hhData.highHand),
        playerCards: JSON.parse(hhData.playerCards),
        handNum: hhData.handNum,
      }
    })

    expect(_.sortBy(highHandResponse, 'handNum')).toEqual(_.sortBy(highHandResult, 'handNum'))
  
    expect(status).toEqual('ENDED');

  });

  test.skip('post-hand test', async () => {
    const data = await axios.post(`${SERVER_API}/post-hand/gameId/1/handNum/1`)
    expect(data.data.status).toEqual('OK')
  })
});
