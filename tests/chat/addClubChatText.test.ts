import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {addClubChatText} from './utils';

describe('addClubChatText APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('addClubChatText', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await addClubChatText({
      ownerId,
      clubCode,
      text: 'test',
    });
    expect(data.addClubChatText).toEqual(true);
  });
});
