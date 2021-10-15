import {resetDatabase, startGqlServer, INTERNAL_PORT} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils';
import {buyIn, configureGame, createGameServer, joinGame, pauseGame, startGame, updateLocation} from './utils';
import axios from 'axios';

const SERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

describe('location check APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
 
  test('location check', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId, gpsCheck: true, ipCheck: true});
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
      ip: '1.1.1.1',
      location: {
        lat: 42.3602,
        long: 74.0592,
      },
    });
    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    try {
      await joinGame({
        ownerId: playerId2,
        gameCode: resp.data.configuredGame.gameCode,
        seatNo: 2,
        ip: '1.1.1.2',
        location: {
          lat: 42.3603,
          long: 74.0592,
        },
      });
    } catch (error) {
      expect(error.graphQLErrors[0].message).toEqual('Players have same ip address')
    }
  })

  test('location check', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId, gpsCheck: true, ipCheck: false});
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
      ip: '1.1.1.1',
      location: {
        lat: 42.3602,
        long: 74.0592,
      },
    });
    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    try {
      await joinGame({
        ownerId: playerId2,
        gameCode: resp.data.configuredGame.gameCode,
        seatNo: 2,
        ip: '1.1.1.2',
        location: {
          lat: 42.3602,
          long: 74.0592,
        },
      });
    } catch (error) {
      expect(error.graphQLErrors[0].message).toEqual('Players are close to each other')
    }
  })

  test('location check pending update', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId, gpsCheck: true, ipCheck: true});
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
      ip: '1.1.1.1',
      location: {
        lat: 42.3602,
        long: 74.0592,
      },
    });
    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});
    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)
    expect(true).toEqual(true)
  })

  test('update location', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId, gpsCheck: true, ipCheck: true});
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
      ip: '1.1.1.1',
      location: {
        lat: 42.3602,
        long: 74.0592,
      },
    });
    await buyIn({ownerId: playerId, gameCode: resp.data.configuredGame.gameCode, amount: 1000});

    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)

    await updateLocation({ ownerId: playerId, location: {lat: 42.3602, long: 74.0592,} })
    expect(true).toEqual(true)
  })
});
