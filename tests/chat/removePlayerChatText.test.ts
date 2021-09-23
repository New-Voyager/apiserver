import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {removePlayerChatText} from './utils';

describe('removePlayerChatText APIs', () => {
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
  test('removePlayerChatText', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await removePlayerChatText({
      ownerId,
      text: 'test',
    });
    expect(data.removePlayerChatText).toEqual(true);
  });
});
