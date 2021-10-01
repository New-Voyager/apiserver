import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getChatTexts} from './utils';

describe('getChatTexts APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
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
