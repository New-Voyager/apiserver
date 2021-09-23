import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getMessagesFromMember} from './utils';

describe('getMessagesFromMember APIs', () => {
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
  test('getMessagesFromMember', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    const data = await getMessagesFromMember({
      ownerId,
      clubCode,
      playerId,
    });
    expect(data.messagesFromMember).toEqual([]);
  });
});
