import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {sendMessageToMember} from './utils';

describe('sendMessageToMember APIs', () => {
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
  test('sendMessageToMember', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    const data = await sendMessageToMember({
      ownerId,
      clubCode,
      playerId,
      text: 'test',
    });
    expect(data.sendMessageToMember.id).not.toBeNull();
  });
});
