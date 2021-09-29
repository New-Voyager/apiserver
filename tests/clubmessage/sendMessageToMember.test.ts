import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {sendMessageToMember} from './utils';

describe('sendMessageToMember APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
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
