import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getChatTexts} from './utils';

describe('getChatTexts APIs', () => {
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
  test('getChatTexts', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await getChatTexts({
      ownerId,
      clubCode,
    });
    expect(data.chatTexts).toEqual([]);
  });
});
