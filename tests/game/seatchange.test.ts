import {resetDatabase, startGqlServer, INTERNAL_PORT} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils';
import {buyIn, configureGame, createGameServer, getSeatPositions, joinGame, pauseGame, seatChangeSwapSeats, startGame} from './utils';
import axios from 'axios';

const SERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

describe('seat change APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });

  test('seat change', async () => {
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
    });
    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    await startGame({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode })

    await gameutils.addToWaitingList(playerId3, resp.data.configuredGame.gameCode)

    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)
    expect(true).toEqual(true)
  })

  test('getSeatPositions', async () => {
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
    });
    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    await startGame({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode })
    await gameutils.addToWaitingList(playerId3, resp.data.configuredGame.gameCode)
    const resp1 = await gameutils.requestSeatChange(playerId, resp.data.configuredGame.gameCode);
    const res = await getSeatPositions({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode })
    console.log(res);
    expect(true).toEqual(true)
  })


  test('seatChangeSwapSeats', async () => {
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
    });
    await joinGame({
      ownerId: playerId2,
      gameCode: resp.data.configuredGame.gameCode,
      seatNo: 2,
    });
    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    await startGame({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode })
    
    const data =  await seatChangeSwapSeats({ ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, seatNo1: 1, seatNo2: 2})

    console.log(data);

    expect(true).toEqual(true)
  })

  
});
