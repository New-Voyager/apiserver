import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getSystemAnnouncements} from './utils';

describe('getSystemAnnouncements APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('getSystemAnnouncements', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await getSystemAnnouncements({
      ownerId,
    });
    expect(data.announcements).toEqual([]);
  });
});
