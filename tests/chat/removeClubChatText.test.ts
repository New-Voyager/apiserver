import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {removeClubChatText} from './utils';

describe('removeClubChatText APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('removeClubChatText', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await removeClubChatText({
      ownerId,
      clubCode,
      text: 'test',
    });
    expect(data.removeClubChatText).toEqual(true);
  });
});
