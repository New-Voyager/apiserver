import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {addPlayerChatText} from './utils';

describe('addPlayerChatText APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('addPlayerChatText', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await addPlayerChatText({
      ownerId,
      text: 'test',
    });
    expect(data.addPlayerChatText).toEqual(true);
  });
});
