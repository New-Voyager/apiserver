import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {addSystemAnnouncement} from './utils';

describe('addSystemAnnouncement APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('addSystemAnnouncement', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await addSystemAnnouncement({
      ownerId,
      text: 'test',
      expiresAt: new Date(),
    });
    expect(data.addSystemAnnouncement).toEqual(true);
  });
});
