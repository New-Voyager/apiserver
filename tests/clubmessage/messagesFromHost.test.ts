import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getMessagesFromHost} from './utils';

describe('getMessagesFromHost APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('getMessagesFromHost', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    const data = await getMessagesFromHost({
      ownerId,
      clubCode,
    });
    expect(data.messagesFromHost).toEqual([]);
  });
});
