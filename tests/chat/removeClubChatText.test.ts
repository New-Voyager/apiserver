import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {removeClubChatText} from './utils';

describe('removeClubChatText APIs', () => {
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
