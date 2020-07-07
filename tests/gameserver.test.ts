import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase} from './utils/utils';

const GAMESERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

describe('Game server APIs', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('create a game server', async () => {
    console.log('Creating a game server');
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
    console.log('update a game server');
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
    console.log('Getting game server');
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
});
