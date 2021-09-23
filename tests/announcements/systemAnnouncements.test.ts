import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getSystemAnnouncements} from './utils';

describe('getSystemAnnouncements APIs', () => {
  let stop;

  beforeAll(async done => {
    const testServer = await startGqlServer();
    stop = testServer.stop;
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    stop();
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
