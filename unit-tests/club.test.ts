import {ClubRepository} from '@src/repositories/club';
import {initializeSqlLite} from './utils';
import {getClubMembers} from '@src/resolvers/club.ts'
beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});


describe('Club APIs', () => {
  test('get club members', async () => {
    try {
      const members = await getClubMembers("1234", {clubId: "1234"});
      expect(members).toBeNull();
    } catch(err) {
      expect(err.message).toContain("not found");
    }
  });
});