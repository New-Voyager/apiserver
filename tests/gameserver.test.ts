import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase} from './utils/utils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import {getLogger} from '../src/utils/log';
const logger = getLogger('gameserver');

const GAMESERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

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

describe('Game server APIs', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('create a game server', async () => {
    logger.debug('Creating a game server');
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      const resp = await axios.post(
        `${GAMESERVER_API}/register-game-server`,
        gameServer
      );
      expect(resp.status).toBe(200);
      expect(resp.data.status).toBe('OK');
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('update a game server', async () => {
    logger.debug('update a game server');
    const gameServer = {
      ipAddress: '10.1.1.2',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      const resp = await axios.post(
        `${GAMESERVER_API}/register-game-server`,
        gameServer
      );
      expect(resp.status).toBe(200);
      expect(resp.data.status).toBe('OK');
      const gameServerUpdate = {
        ipAddress: '10.1.1.2',
        currentMemory: 200,
        noActiveGames: 2,
      };
      const updateResp = await axios.post(
        `${GAMESERVER_API}/update-game-server`,
        gameServerUpdate
      );
      expect(resp.status).toBe(200);
      expect(resp.data.status).toBe('OK');
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('get game servers', async () => {
    logger.debug('Getting game server');
    const gameServer1 = {
      ipAddress: '10.1.1.3',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    const gameServer2 = {
      ipAddress: '10.1.1.4',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${GAMESERVER_API}/register-game-server`, gameServer1);
      await axios.post(`${GAMESERVER_API}/register-game-server`, gameServer2);
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }

    let resp;
    try {
      resp = await axios.get(`${GAMESERVER_API}/game-servers`);
    } catch (err) {
      console.error(JSON.stringify(err));
    }
    expect(resp.status).toBe(200);
    const servers = resp.data.servers;
    expect(servers).toHaveLength(2);
    const server1 = servers[0];
    expect(server1.ipAddress).toBe('10.1.1.3');
    const server2 = servers[1];
    expect(server2.ipAddress).toBe('10.1.1.4');
  });

  test('get specific game server', async () => {
    logger.debug('Getting game server');
    const gameServer1 = {
      ipAddress: '10.1.1.3',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    const gameServer2 = {
      ipAddress: '10.1.1.4',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    const gameServer3 = {
      ipAddress: '10.1.1.5',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${GAMESERVER_API}/register-game-server`, gameServer1);
      await axios.post(`${GAMESERVER_API}/register-game-server`, gameServer2);
      await axios.post(`${GAMESERVER_API}/register-game-server`, gameServer3);
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');

    for (let i = 0; i < 3; i++) {
      const game1 = await gameutils.startGame(
        playerId,
        clubId,
        holdemGameInput
      );

      let resp;
      try {
        resp = await axios.get(
          `${GAMESERVER_API}/get-game-server/club_id/${clubId}/game_num/${game1.gameId}`
        );
      } catch (err) {
        console.error(JSON.stringify(err));
      }
      expect(resp.status).toBe(200);
      const server = resp.data.server;
      expect(server).not.toBe(null);
      expect(server.ipAddress).not.toBe(null);
    }
  });
});
