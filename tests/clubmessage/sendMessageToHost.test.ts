import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {sendMessageToHost} from './utils';

describe('sendMessageToHost APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('sendMessageToHost', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    const data = await sendMessageToHost({
      ownerId,
      clubCode,
      text: 'test',
    });
    expect(data.sendMessageToHost.id).not.toBeNull();
  });
});
