import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {addSystemAnnouncement} from './utils';

describe('addSystemAnnouncement APIs', () => {
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