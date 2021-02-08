import {initializeSqlLite} from './utils';
import {
  getClubMembers,
  createClub,
  updateClub,
  joinClub,
  getMemberStatus,
  approveMember,
  rejectMember,
  kickMember,
  leaveClub,
  getClubGames,
  getClubById,
  updateClubMember,
} from '../src/resolvers/club';
import {createPlayer} from '../src/resolvers/player';
import {
  addSystemAnnouncement,
  addClubAnnouncement,
  systemAnnouncements,
  clubAnnouncements,
} from '../src/resolvers/announcements';
import {getLogger} from '../src/utils/log';

const logger = getLogger('club unit-test');

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Announcement APIs', () => {
  test('System announcements', async () => {
    const today = new Date();
    const expireAt = new Date().setDate(today.getDate() + 7).toString();
    const resp1 = await addSystemAnnouncement(
      '0',
      'New update available',
      expireAt
    );
    expect(resp1).toBe(true);
    const resp2 = await addSystemAnnouncement(
      '0',
      'Old feature is deprecated',
      expireAt
    );
    expect(resp2).toBe(true);
    const resp3 = await addSystemAnnouncement(
      '0',
      'New update available',
      expireAt
    );
    expect(resp3).toBe(true);

    const resp4 = await systemAnnouncements('0');
    expect(resp4).toHaveLength(3);
  });

  test('Club announcements', async () => {
    const ownerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test234'},
    });
    const clubCode = await createClub(ownerId, {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    });
    await joinClub(player1Id, clubCode);
    await approveMember(ownerId, clubCode, player1Id);

    const today = new Date();
    const expireAt = new Date().setDate(today.getDate() + 7).toString();
    const resp1 = await addClubAnnouncement(
      ownerId,
      clubCode,
      'New game started',
      expireAt
    );
    expect(resp1).toBe(true);
    const resp2 = await addClubAnnouncement(
      ownerId,
      clubCode,
      'New series is available',
      expireAt
    );
    expect(resp2).toBe(true);
    const resp3 = await addClubAnnouncement(
      ownerId,
      clubCode,
      'New tournament has started',
      expireAt
    );
    expect(resp3).toBe(true);

    const resp4 = await clubAnnouncements(player1Id, clubCode);
    expect(resp4).toHaveLength(3);
  });
});
