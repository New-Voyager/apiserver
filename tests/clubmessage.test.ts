import {resetDatabase, getClient, startGqlServer} from './utils/utils';
import * as clubmessageutils from './utils/clubmessage.testutils';
import * as clubutils from './utils/club.testutils';
import {getLogger} from '../src/utils/log';
import {
  markHostMsgRead,
  markMemberMsgRead,
} from './utils/clubmessage.testutils';
const logger = getLogger('clubmessage');

describe('Club Message APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });

  test('send a text message', async () => {
    const [clubCode] = await clubutils.createClub();
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
        clubCode: clubCode,
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
    const [clubCode] = await clubutils.createClub();
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
        clubCode: clubCode,
        input: messageInput,
      },
      mutation: clubmessageutils.sendMessageQuery,
    });
    expect(response.errors).toBeUndefined();
    expect(response.data).not.toBeUndefined();
    const messageID = response.data.id;
    expect(messageID).not.toBeNull();
  });

  test('markHostMsgRead', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const playerId2 = await clubutils.createPlayer('adam2', '1243ABCs');
    await clubutils.playerJoinsClub(clubCode, playerId);
    try {
      await markHostMsgRead({clubCode, ownerId: ''});
    } catch (error) {
      expect((error as any).toString()).toEqual('Error: GraphQL error: Unauthorized');
    }
    try {
      await markHostMsgRead({clubCode, ownerId: 'test'});
    } catch (error) {
      expect((error as any).toString()).toEqual(
        'Error: GraphQL error: Cannot find player uuid [test] in player repo'
      );
    }
    try {
      await markHostMsgRead({clubCode: 'test', ownerId});
    } catch (error) {
      expect((error as any).toString()).toEqual(
        'Error: GraphQL error: Cannot find club code [test] in club repo'
      );
    }
    try {
      await markHostMsgRead({clubCode, ownerId: playerId2});
    } catch (error) {
      expect((error as any).toString()).toEqual(
        `Error: GraphQL error: Player: ${playerId2} is not a member in club bbc`
      );
    }
    const data = await markHostMsgRead({clubCode, ownerId});
    expect(data.markHostMsgRead).toEqual(true);
  });

  test('markMemberMsg', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const playerId2 = await clubutils.createPlayer('adam2', '1243ABCs');
    await clubutils.playerJoinsClub(clubCode, playerId);

    try {
      await markMemberMsgRead({clubCode, ownerId: '', playerId});
    } catch (error) {
      expect((error as any).toString()).toEqual('Error: GraphQL error: Unauthorized');
    }
    try {
      await markMemberMsgRead({clubCode, ownerId: 'test', playerId});
    } catch (error) {
      expect((error as any).toString()).toEqual(
        'Error: GraphQL error: Cannot find player uuid [test] in player repo'
      );
    }
    try {
      await markMemberMsgRead({clubCode, ownerId, playerId: 'test'});
    } catch (error) {
      expect((error as any).toString()).toEqual(
        'Error: GraphQL error: Cannot find player uuid [test] in player repo'
      );
    }
    try {
      await markMemberMsgRead({clubCode, ownerId, playerId: playerId2});
    } catch (error) {
      expect((error as any).toString()).toEqual(
        'Error: GraphQL error: Member: 1243ABCs is not a member in club bbc'
      );
    }

    try {
      await markMemberMsgRead({clubCode, ownerId: playerId2, playerId});
    } catch (error) {
      expect((error as any).toString()).toEqual(
        'Error: GraphQL error: Player: 1243ABCs is not a host in club bbc'
      );
    }

    const data = await markMemberMsgRead({
      clubCode,
      ownerId,
      playerId,
    });
    expect(data.markMemberMsgRead).toEqual(true);
  });

  test('send a GIPHY message', async () => {
    const [clubCode] = await clubutils.createClub();
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
        clubCode: clubCode,
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
    const [clubCode, playerId] = await clubutils.createClub(
      'brady3',
      'yatzee3'
    );
    const messageCount = 100;
    const messageInput = {
      messageType: 'GIPHY',
      giphyLink: 'test.com',
      playerTags: playerId,
    };
    for (let i = 0; i < messageCount; i++) {
      await getClient(playerId).mutate({
        variables: {
          clubCode: clubCode,
          input: messageInput,
        },
        mutation: clubmessageutils.sendMessageQuery,
      });
    }
    let result = await clubmessageutils.getClubMessage(clubCode, playerId);
    expect(result).toHaveLength(50);
    const firstGame = result[0];
    const lastGame = result[49];
    logger.debug(JSON.stringify(firstGame));
    logger.debug(JSON.stringify(lastGame));
    result = await clubmessageutils.getClubMessage(clubCode, playerId, {
      prev: lastGame.pageId,
      count: 5,
    });
    expect(result).toHaveLength(5);
  });
});
