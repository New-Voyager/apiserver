import {resetDatabase, getClient} from './utils/utils';
import * as clubutils from './utils/clubmessage.testutils';

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

enum ClubMessageType {
    TEXT,
    HAND,
    GIPHY,
    } 

describe('Club APIs', () => {
    test('send a message', async () => {
      const messageInput = {
              messageType: 'TEXT',
              text: "Hi buddy",
              gameNum: 0,
              handNum: 0,
              giphyLink: "test.com",
              playerTags: "1,2,3"
        
      };


      const response = await getClient("123").mutate({
        variables: {
          clubId: "123",
          input: messageInput,
        },
        mutation: clubutils.sendMessageQuery,
      });
      expect(response.errors).toBeUndefined();
      expect(response.data).not.toBeUndefined();
      const messageID = response.data.id;
      expect(messageID).not.toBeNull();
    });
})