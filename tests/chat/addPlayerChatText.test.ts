import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {addPlayerChatText} from './utils';

describe('addPlayerChatText APIs', () => {
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
  test('addPlayerChatText', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();

    const data = await addPlayerChatText({
      ownerId,
      text: 'test',
    });
    expect(data.addPlayerChatText).toEqual(true);
  });
});