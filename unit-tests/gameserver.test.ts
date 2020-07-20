import {initializeSqlLite} from './utils';
import {
  createGameServer,
  editGameServer,
  getAllGameServers,
  getParticularGameServer,
} from '@src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';

const logger = getLogger('gameserver unit-test');

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Game server APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Create a game server', async () => {
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      const resp = await createGameServer(gameServer);
      expect(resp).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Update a game server', async () => {
    const gameServer = {
      ipAddress: '10.1.1.2',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    const gameServerUpdate1 = {
      ipAddress: '10.1.1.2',
      currentMemory: 200,
      noActiveGames: 2,
    };
    const gameServerUpdate2 = {
      ipAddress: '10.1.2.2',
      currentMemory: 200,
      noActiveGames: 2,
    };
    try {
      const resp = await createGameServer(gameServer);
      expect(resp).toBe(true);
      const edited1 = await editGameServer(gameServerUpdate1);
      const edited2 = await editGameServer(gameServerUpdate2);
      expect(edited1).toBe(true);
      expect(edited2).toBe('gameserver 10.1.2.2 is not found');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get all game servers', async () => {
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
      const resp1 = await createGameServer(gameServer1);
      const resp2 = await createGameServer(gameServer2);
      expect(resp1).toBe(true);
      expect(resp2).toBe(true);

      const servers = await getAllGameServers();
      expect(servers).toHaveLength(2);
      expect(servers[0].ipAddress).toBe('10.1.1.3');
      expect(servers[1].ipAddress).toBe('10.1.1.4');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  // test('Get specific game server', async () => {
  //   const gameServer1 = {
  //     ipAddress: '10.1.1.5',
  //     currentMemory: 100,
  //     status: 'ACTIVE',
  //   };
  //   const gameServer2 = {
  //     ipAddress: '10.1.1.6',
  //     currentMemory: 100,
  //     status: 'ACTIVE',
  //   };
  //   try {
  //     const resp1 = await createGameServer(gameServer1);
  //     const resp2 = await createGameServer(gameServer2);
  //     expect(resp1).toBe(true);
  //     expect(resp2).toBe(true);

  //     const servers = await getParticularGameServer();
  //     expect(servers).toHaveLength(2);
  //     expect(servers[0].ipAddress).toBe('10.1.1.3');
  //     expect(servers[1].ipAddress).toBe('10.1.1.4');
  //   } catch (err) {
  //     logger.error(JSON.stringify(err));
  //     expect(true).toBeFalsy();
  //   }
  // });
});
