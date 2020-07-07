import {resetDatabase, getClient} from './utils/utils';
import * as clubmessageutils from './utils/clubmessage.testutils';
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
  test('send a text message', async () => {
    const [clubId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');

    const messageInput = {
      messageType: 'TEXT',
      text: 'Hi buddy',
      playerTags: playerId,
    };

    if (messageInput.messageType === 'TEXT') {
      expect(messageInput.text).not.toBeNull();
      expect(messageInput.text).not.toBeUndefined();
      expect(typeof messageInput.text).toBe('string');
    }

    const response = await getClient(playerId).mutate({
      variables: {
        clubId: clubId,
        input: messageInput,
      },
      mutation: clubmessageutils.sendMessageQuery,
    });
    expect(response.errors).toBeUndefined();
    expect(response.data).not.toBeUndefined();
    const messageID = response.data.id;
    expect(messageID).not.toBeNull();
  });

  test('send a hand message', async () => {
    const [clubId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const messageInput = {
      messageType: 'HAND',
      handNum: 0,
      gameNum: 0,
      playerTags: playerId,
    };

    if (messageInput.messageType === 'HAND') {
      expect(messageInput.handNum).not.toBeNull();
      expect(messageInput.handNum).not.toBeUndefined();
      expect(typeof messageInput.handNum).toBe('number');
      expect(messageInput.gameNum).not.toBeNull();
      expect(messageInput.gameNum).not.toBeUndefined();
      expect(typeof messageInput.gameNum).toBe('number');
    }

    const response = await getClient(playerId).mutate({
      variables: {
        clubId: clubId,
        input: messageInput,
      },
      mutation: clubmessageutils.sendMessageQuery,
    });
    expect(response.errors).toBeUndefined();
    expect(response.data).not.toBeUndefined();
    const messageID = response.data.id;
    expect(messageID).not.toBeNull();
  });

  test('send a GIPHY message', async () => {
    const [clubId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const messageInput = {
      messageType: 'GIPHY',
      giphyLink: 'test.com',
      playerTags: playerId,
    };

    if (messageInput.messageType === 'GIPHY') {
      expect(messageInput.giphyLink).not.toBeNull();
      expect(messageInput.giphyLink).not.toBeUndefined();
      expect(typeof messageInput.giphyLink).toBe('string');
    }

    const response = await getClient(playerId).mutate({
      variables: {
        clubId: clubId,
        input: messageInput,
      },
      mutation: clubmessageutils.sendMessageQuery,
    });
    expect(response.errors).toBeUndefined();
    expect(response.data).not.toBeUndefined();
    const messageID = response.data.id;
    expect(messageID).not.toBeNull();
  });

  test('get message', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady3', 'yatzee3');
    const messageCount = 100;
    const messageInput = {
      messageType: 'GIPHY',
      giphyLink: 'test.com',
      playerTags: playerId,
    };
    for (let i = 0; i < messageCount; i++) {
      await getClient(playerId).mutate({
        variables: {
          clubId: clubId,
          input: messageInput,
        },
        mutation: clubmessageutils.sendMessageQuery,
      });
    }
    const result = await clubmessageutils.getClubMessage(clubId, playerId);
    expect(result).toHaveLength(50);
  });
});
