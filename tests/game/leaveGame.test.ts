import {resetDatabase, startGqlServer, INTERNAL_PORT} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils';
import axios from 'axios';
import {
  buyIn,
  configureGame,
  createGameServer,
  joinGame,
  pauseGame,
  resumeGame,
  startGame,
} from './utils';

const SERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

describe('resumeGame APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('leaveGameWithPending', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});
    const gameId = await gameutils.getGameById(resp.data.configuredGame.gameCode)

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
    const gameInfo1 = await gameutils.gameInfo(playerId, resp.data.configuredGame.gameCode)

    await gameutils.leaveGame(playerId2, resp.data.configuredGame.gameCode)
    const gameInfo2 = await gameutils.gameInfo(playerId, resp.data.configuredGame.gameCode)
    expect(gameInfo2.seatInfo.playersInSeats.length).toEqual(4)
    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)

    const gameInfo = await gameutils.gameInfo(playerId, resp.data.configuredGame.gameCode)
    expect(gameInfo.seatInfo.playersInSeats.length).toEqual(3);
  })
})