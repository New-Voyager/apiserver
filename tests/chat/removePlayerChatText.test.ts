import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {removePlayerChatText} from './utils';

describe('removePlayerChatText APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('removePlayerChatText', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await removePlayerChatText({
      ownerId,
      text: 'test',
    });
    expect(data.removePlayerChatText).toEqual(true);
  });
});
