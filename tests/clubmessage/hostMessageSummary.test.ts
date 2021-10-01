import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getHostMessageSummary} from './utils';

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

    const data = await getHostMessageSummary({
      ownerId,
      clubCode,
    });
    expect(data.hostMessageSummary).toEqual([]);
  });
});
