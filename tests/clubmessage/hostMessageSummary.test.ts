import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getHostMessageSummary, sendMessageToMember} from './utils';
import {sendMessageToHost} from './utils';

describe('hostMessageSummary APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('hostMessageSummary', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);
    const playerId2 = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId2);

    await sendMessageToMember({
      ownerId,
      clubCode,
      playerId,
      text: 'test',
    });
    await sendMessageToHost({
      ownerId,
      clubCode,
      text: 'test',
    });

    const data = await getHostMessageSummary({
      ownerId,
      clubCode,
    });

    expect(data.hostMessageSummary.length).toEqual(2)
  });
});
