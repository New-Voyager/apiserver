import {initializeSqlLite} from './utils';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {
  createPlayer,
  getMyClubs,
  getAllPlayers,
  getPlayerById,
  leaveClub,
  getPlayerClubs,
} from '@src/resolvers/player';
import {createClub, joinClub} from '@src/resolvers/club';

const logger = getLogger('Player unit-test');

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Player APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Create a player', async () => {
    try {
      const player = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      expect(player).not.toBeNull();
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Create a duplicate player', async () => {
    try {
      const player1 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      expect(player1).not.toBeNull();
      const player2 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      expect(player2).not.toBeNull();
      expect(player1).toEqual(player2);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get my clubs', async () => {
    try {
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc',
        },
      });
      expect(owner).not.toBeNull();
      const player1 = await createPlayer({
        player: {
          name: 'player_name1',
          deviceId: 'abc123',
        },
      });
      expect(player1).not.toBeNull();
      const player2 = await createPlayer({
        player: {
          name: 'player_name2',
          deviceId: 'abc1234',
        },
      });
      expect(player2).not.toBeNull();
      const club1 = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      expect(club1).not.toBeNull();
      const club2 = await createClub(owner, {
        name: 'club_name2',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      expect(club2).not.toBeNull();
      await joinClub(player1, club1);
      await joinClub(player2, club1);
      await joinClub(player1, club2);
      const resp1 = await getMyClubs(player1);
      const resp2 = await getMyClubs(player2);
      expect(resp1).toHaveLength(2);
      expect(resp2).toHaveLength(1);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get all players', async () => {
    try {
      await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc',
        },
      });
      await createPlayer({
        player: {
          name: 'player_name1',
          deviceId: 'abc123',
        },
      });
      await createPlayer({
        player: {
          name: 'player_name2',
          deviceId: 'abc1234',
        },
      });
      const players = await getAllPlayers();
      expect(players).toHaveLength(3);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get a player by uuid', async () => {
    try {
      const player = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      expect(player).not.toBeNull();
      const resp = await getPlayerById(player);
      expect(resp.id).not.toBeNull();
      expect(resp.name).toBe('player_name');
      expect(resp.uuid).toBe(player);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Leave a club', async () => {
    try {
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc',
        },
      });
      expect(owner).not.toBeNull();
      const player = await createPlayer({
        player: {
          name: 'player_name1',
          deviceId: 'abc123',
        },
      });
      expect(player).not.toBeNull();
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      expect(club).not.toBeNull();
      await joinClub(player, club);
      const resp = await leaveClub(club, player);
      expect(resp).toBe('LEFT');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get my clubs', async () => {
    try {
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc',
        },
      });
      expect(owner).not.toBeNull();
      const player1 = await createPlayer({
        player: {
          name: 'player_name1',
          deviceId: 'abc123',
        },
      });
      expect(player1).not.toBeNull();
      const player2 = await createPlayer({
        player: {
          name: 'player_name2',
          deviceId: 'abc1234',
        },
      });
      expect(player2).not.toBeNull();
      const club1 = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      expect(club1).not.toBeNull();
      const club2 = await createClub(owner, {
        name: 'club_name2',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      expect(club2).not.toBeNull();
      await joinClub(player1, club1);
      await joinClub(player2, club1);
      await joinClub(player1, club2);
      const resp1 = await getPlayerClubs(player1, {playerId: player1});
      const resp2 = await getPlayerClubs(player2, {playerId: player2});
      expect(resp1).toHaveLength(2);
      expect(resp2).toHaveLength(1);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });
});
