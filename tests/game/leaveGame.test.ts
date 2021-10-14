import {resetDatabase, startGqlServer, INTERNAL_PORT} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils';
import axios from 'axios';
import {
  configureGame,
  createGameServer,
  joinGame,
  pauseGame,
  resumeGame,
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
    const anotherPlayer = await clubutils.createPlayer('adam', '1243ABC');

    await joinGame({
      ownerId: playerId,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 1,
      location: {
        lat: 100,
        long: 100,
      },
    });
    clubutils.playerJoinsClub(clubCode, anotherPlayer)
    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)

    await joinGame({
        ownerId: anotherPlayer,
        gameCode: resp.data.configuredGame.gameCode,
        seatNo: 2,
        location: {
          lat: 100,
          long: 100,
        },
    });
    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)

    await gameutils.leaveGame(anotherPlayer, resp.data.configuredGame.gameCode)
    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)

    const gameInfo = await gameutils.gameInfo(playerId, resp.data.configuredGame.gameCode)
    expect(gameInfo.seatInfo.playersInSeats.length).toEqual(1);
  })
})