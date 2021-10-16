import {resetDatabase, startGqlServer, INTERNAL_PORT} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils';
import {buyIn, configureGame, createGameServer, joinGame, pauseGame, startGame} from './utils';
import axios from 'axios';
import { updateClubMember } from '../utils/club.testutils';

const SERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

describe('joinGame APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('pauseGame with no owner', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});
    const playerId2 = await clubutils.createPlayer(`adamqwe`, `1243ABCqwe`);
    const playerId3 = await clubutils.createPlayer(`adamqwe3`, `1243ABCqwe3`);
    const playerId4 = await clubutils.createPlayer(`adamqwe3`, `1243ABCqwe3`);
    await clubutils.playerJoinsClub(clubCode, playerId4);
    await updateClubMember(clubCode, playerId, playerId4, {
      isManager: true
    })
    await clubutils.playerJoinsClub(clubCode, playerId2);
    await joinGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 1,
      location: {
        lat: 100,
        long: 100,
      },
    });
    try {
      const data = await pauseGame({
        ownerId: playerId2,
        gameCode: resp.data.configuredGame.gameCode,
      });
      expect(data.pauseGame).toEqual('PAUSED');
    } catch (error) {
      expect(error.graphQLErrors[0].message).toEqual('Failed to pause the game. Player: 1243ABCqwe is not a owner or a manager yatzee. Cannot pause game')
    }

    try {
      const data = await pauseGame({
        ownerId: playerId3,
        gameCode: resp.data.configuredGame.gameCode,
      });
      expect(data.pauseGame).toEqual('PAUSED');
    } catch (error) {
      expect(error.graphQLErrors[0].message).toEqual('Failed to pause the game. Player: 1243ABCqwe3 is not a owner or a manager yatzee. Cannot pause game')
    }

    try {
      const data = await pauseGame({
        ownerId: playerId4,
        gameCode: resp.data.configuredGame.gameCode,
      });
      expect(data.pauseGame).toEqual('PAUSED');
    } catch (error) {
      expect(error.graphQLErrors[0].message).toEqual('qweqweFailed to pause the game. Player: 1243ABCqwe3 is not a owner or a manager yatzee. Cannot pause game')
    }
    
  });
  test('pauseGame', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});

    await joinGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 1,
      location: {
        lat: 100,
        long: 100,
      },
    });
    const data = await pauseGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
    });
    expect(data.pauseGame).toEqual('PAUSED');
  });
  test('pauseGameWithPending', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});
    const gameId = await gameutils.getGameById(resp.data.configuredGame.gameCode);

    const playerId2 = await clubutils.createPlayer(`adamqwe`, `1243ABCqwe`);
    await clubutils.playerJoinsClub(clubCode, playerId2);
    const playerId3 = await clubutils.createPlayer(`adamqwe3`, `1243ABCqwe3`);
    await clubutils.playerJoinsClub(clubCode, playerId3);
    const playerId4 = await clubutils.createPlayer(`adamqwe4`, `1243ABCqwe4`);
    await clubutils.playerJoinsClub(clubCode, playerId4);
    
    await joinGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 1,
      location: {
        lat: 100,
        long: 100,
      },
    });
    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    await joinGame({
      ownerId: playerId2,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 2,
      location: {
        lat: 100,
        long: 100,
      },
    });
    await buyIn({ownerId: playerId2, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    await joinGame({
      ownerId: playerId3,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 3,
      location: {
        lat: 100,
        long: 100,
      },
    });
    await buyIn({ownerId: playerId3, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    await joinGame({
      ownerId: playerId4,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 4,
      location: {
        lat: 100,
        long: 100,
      },
    });
    await buyIn({ownerId: playerId4, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    await startGame({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode })
    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)
    

    await axios.post(`${SERVER_API}/move-to-next-hand/game_num/${resp.data.configuredGame.gameCode}/hand_num/1`)
    const data = await pauseGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
    });
    const gameInfo1 = await gameutils.gameInfo(playerId, resp.data.configuredGame.gameCode)
    expect(gameInfo1.status).toEqual('ACTIVE')
    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)
    const gameInfo = await gameutils.gameInfo(playerId, resp.data.configuredGame.gameCode)
    expect(gameInfo.status).toEqual('PAUSED')
  })
});
