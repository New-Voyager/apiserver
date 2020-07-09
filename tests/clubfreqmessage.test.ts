import {resetDatabase, getClient} from './utils/utils';
import * as clubfreqmessageutils from './utils/clubfreqmessage.testutils';
import * as clubutils from './utils/club.testutils';

beforeAll(async done => {
  //server = new TestServer();
  //await server.start();
  await resetDatabase();
  //  client = getClient();
  done();
});

afterAll(async done => {
  //await server.stop();
  done();
});

describe('Club APIs', () => {
  test('save a favourite message', async () => {
    const [clubId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');

    const messageInput = {
      text: 'Hi buddy',
      playerId: playerId,
      clubId: clubId,
    };

    const response = await getClient(playerId).mutate({
      variables: {
        input: messageInput,
      },
      mutation: clubfreqmessageutils.saveFreqMessage,
    });
    expect(response.errors).toBeUndefined();
    expect(response.data).not.toBeUndefined();
    const messageID = response.data.id;
    expect(messageID).not.toBeNull();
  });

  test('get message', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady3', 'yatzee3');
    const messageCount = 50;
    const messageInput = {
      audioLink: 'test.com',
      clubId: clubId,
      playerId: playerId,
    };
    for (let i = 0; i < messageCount; i++) {
      await getClient(playerId).mutate({
        variables: {
          clubId: clubId,
          input: messageInput,
        },
        mutation: clubfreqmessageutils.saveFreqMessage,
      });
    }
    const result = await clubfreqmessageutils.getFreqMessages(clubId, playerId);
    expect(result).toHaveLength(20);
  });
});
