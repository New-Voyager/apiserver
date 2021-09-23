import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getClubBalance} from './utils';

describe('getClubBalance APIs', () => {
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
  test('getClubBalance', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await getClubBalance({
      ownerId,
      clubCode,
    });
    expect(data.clubBalance.balance).toEqual(null);
  });
});
