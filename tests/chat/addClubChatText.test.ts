import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {addClubChatText} from './utils';

describe('addClubChatText APIs', () => {
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
