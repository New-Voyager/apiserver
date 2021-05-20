import {initializeSqlLite} from './utils';
import {approveMember, createClub, joinClub} from '../src/resolvers/club';
import {ClubRepository} from '../src/repositories/club';
import {createPlayer} from '../src/resolvers/player';
import {
  sendClubMsg,
  getClubMsg,
  sendMessageToHost,
  sendMessageToMember,
  hostMessageSummary,
  messagesFromHost,
  messagesFromMember,
  markHostMsgRead,
  markMemberMsgRead,
} from '../src/resolvers/clubmessage';
import {getLogger} from '../src/utils/log';
const logger = getLogger('clubfreqmsg-unit-test');
beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Club message APIs', () => {
  test('send a text message', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const messageInput = {
      messageType: 'TEXT',
      text: 'Hi buddy',
      playerTags: ownerId,
    };

    const resp = await sendClubMsg(ownerId, clubCode, messageInput);
    expect(resp).not.toBeNull();
    expect(resp).not.toBeUndefined();
  });

  test('send a GIPHY message', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const messageInput = {
      messageType: 'GIPHY',
      giphyLink: 'test.com',
      playerTags: ownerId,
    };

    const resp = await sendClubMsg(ownerId, clubCode, messageInput);
    expect(resp).not.toBeNull();
    expect(resp).not.toBeUndefined();
  });

  test('send a hand message', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const messageInput = {
      messageType: 'HAND',
      handNum: 0,
      gameNum: 0,
      playerTags: ownerId,
    };

    const resp = await sendClubMsg(ownerId, clubCode, messageInput);
    expect(resp).not.toBeNull();
    expect(resp).not.toBeUndefined();
  });

  test.skip('get message', async () => {
    const msgCount = 60;
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const messageInput = {
      messageType: 'TEXT',
      text: 'Hi buddy',
      playerTags: ownerId,
    };
    for (let i = 0; i < msgCount; i++) {
      await sendClubMsg(ownerId, clubCode, messageInput);
    }
    const resp = await getClubMsg(ownerId, clubCode);
    expect(resp).not.toBeNull();
    expect(resp).not.toBeUndefined();
    expect(resp).toHaveLength(50);
   });

  test.skip('get message pagination', async () => {
    const msgCount = 60;
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const messageInput = {
      messageType: 'TEXT',
      text: 'Hi buddy',
      playerTags: ownerId,
    };
    for (let i = 0; i < msgCount; i++) {
      await sendClubMsg(ownerId, clubCode, messageInput);
    }
    let message = await getClubMsg(ownerId, clubCode);
    expect(message).toHaveLength(50);
    message = await getClubMsg(ownerId, clubCode, {
      count: 25,
      next: 5,
    });
    expect(message).toHaveLength(25);
    expect(message).not.toBeNull();
    expect(message).not.toBeUndefined();
  });

  test.skip('send host messages', async () => {
    const ownerUuid = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const playerUuid1 = await createPlayer({
      player: {name: 'player1', deviceId: 'test1'},
    });
    const playerUuid2 = await createPlayer({
      player: {name: 'player2', deviceId: 'test2'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerUuid,
    };
    const clubCode = await createClub(ownerUuid, clubInput);
    await joinClub(playerUuid1, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid1);
    const clubMember = await ClubRepository.getMembers(clubCode, {
      playerId: playerUuid1,
    });

    const resp1 = await sendMessageToHost(playerUuid1, clubCode, 'hi');
    expect(resp1.clubCode).toBe(clubCode);
    expect(resp1.memberID).toBe(clubMember[0].id);
    expect(resp1.messageType).toBe('TO_HOST');
    expect(resp1.text).toBe('hi');

    const resp2 = await sendMessageToMember(
      ownerUuid,
      clubCode,
      playerUuid1,
      'hi'
    );
    expect(resp2.clubCode).toBe(clubCode);
    expect(resp2.memberID).toBe(clubMember[0].id);
    expect(resp2.messageType).toBe('FROM_HOST');
    expect(resp2.text).toBe('hi');

    // Failure cases
    try {
      await sendMessageToHost(playerUuid2, clubCode, 'hi');
      expect(true).toBeFalsy();
    } catch (e) {
      logger.error(JSON.stringify(e));
    }
    try {
      await sendMessageToMember(playerUuid1, clubCode, playerUuid2, 'hi');
      expect(true).toBeFalsy();
    } catch (e) {
      logger.error(JSON.stringify(e));
    }
  });

  test.skip('get host message summary', async () => {
    const ownerUuid = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const playerUuid1 = await createPlayer({
      player: {name: 'player1', deviceId: 'test1'},
    });
    const playerUuid2 = await createPlayer({
      player: {name: 'player2', deviceId: 'test2'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerUuid,
    };
    const clubCode = await createClub(ownerUuid, clubInput);
    await joinClub(playerUuid1, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid1);
    await joinClub(playerUuid2, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid2);
    const clubMember1 = await ClubRepository.getMembers(clubCode, {
      playerId: playerUuid1,
    });
    const clubMember2 = await ClubRepository.getMembers(clubCode, {
      playerId: playerUuid2,
    });

    try {
      for (let i = 0; i < 100; i++) {
        await sendMessageToHost(playerUuid1, clubCode, `Member Message:${i}`);
        await sendMessageToMember(
          ownerUuid,
          clubCode,
          playerUuid1,
          `Host Message:${i}`
        );
      }
      for (let i = 0; i < 50; i++) {
        await sendMessageToMember(
          ownerUuid,
          clubCode,
          playerUuid2,
          `Host Message:${i}`
        );
        await sendMessageToHost(playerUuid2, clubCode, `Member Message:${i}`);
      }
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }

    const resp1 = await hostMessageSummary(ownerUuid, clubCode);
    expect(resp1).toHaveLength(2);
    expect(resp1[0].memberName).toBe('player2');
    expect(resp1[0].memberId).toBe(clubMember2[0].id);
    expect(resp1[0].newMessageCount).toBe(50);
    expect(resp1[0].messageType).toBe('TO_HOST');
    expect(resp1[0].lastMessageText).toBe('Member Message:49');
    expect(resp1[1].memberName).toBe('player1');
    expect(resp1[1].memberId).toBe(clubMember1[0].id);
    expect(resp1[1].newMessageCount).toBe(100);
    expect(resp1[1].messageType).toBe('FROM_HOST');
    expect(resp1[1].lastMessageText).toBe('Host Message:99');
  });

  test('get host messages', async () => {
    const ownerUuid = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const playerUuid1 = await createPlayer({
      player: {name: 'player1', deviceId: 'test1'},
    });
    const playerUuid2 = await createPlayer({
      player: {name: 'player2', deviceId: 'test2'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerUuid,
    };
    const clubCode = await createClub(ownerUuid, clubInput);
    await joinClub(playerUuid1, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid1);
    await joinClub(playerUuid2, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid2);
    const clubMember1 = await ClubRepository.getMembers(clubCode, {
      playerId: playerUuid1,
    });
    const clubMember2 = await ClubRepository.getMembers(clubCode, {
      playerId: playerUuid2,
    });

    try {
      for (let i = 0; i < 100; i++) {
        await sendMessageToHost(playerUuid1, clubCode, `Member Message:${i}`);
        await sendMessageToMember(
          ownerUuid,
          clubCode,
          playerUuid1,
          `Host Message:${i}`
        );
      }
      for (let i = 0; i < 50; i++) {
        await sendMessageToMember(
          ownerUuid,
          clubCode,
          playerUuid2,
          `Host Message:${i}`
        );
        await sendMessageToHost(playerUuid2, clubCode, `Member Message:${i}`);
      }
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }

    const resp1 = await messagesFromMember(ownerUuid, clubCode, playerUuid1);
    expect(resp1).toHaveLength(200);
    const resp2 = await messagesFromMember(ownerUuid, clubCode, playerUuid2);
    expect(resp2).toHaveLength(100);

    const resp3 = await messagesFromHost(playerUuid1, clubCode);
    expect(resp3).toHaveLength(200);
    const resp4 = await messagesFromHost(playerUuid2, clubCode);
    expect(resp4).toHaveLength(100);
  });

  test('Read status for host messages', async () => {
    const ownerUuid = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const playerUuid1 = await createPlayer({
      player: {name: 'player1', deviceId: 'test1'},
    });
    const playerUuid2 = await createPlayer({
      player: {name: 'player2', deviceId: 'test2'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerUuid,
    };
    const clubCode = await createClub(ownerUuid, clubInput);
    await joinClub(playerUuid1, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid1);
    await joinClub(playerUuid2, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid2);
    const clubMember1 = await ClubRepository.getMembers(clubCode, {
      playerId: playerUuid1,
    });
    const clubMember2 = await ClubRepository.getMembers(clubCode, {
      playerId: playerUuid2,
    });

    try {
      for (let i = 0; i < 100; i++) {
        await sendMessageToHost(playerUuid1, clubCode, `Member Message:${i}`);
        await sendMessageToMember(
          ownerUuid,
          clubCode,
          playerUuid1,
          `Host Message:${i}`
        );
      }
      for (let i = 0; i < 50; i++) {
        await sendMessageToMember(
          ownerUuid,
          clubCode,
          playerUuid2,
          `Host Message:${i}`
        );
        await sendMessageToHost(playerUuid2, clubCode, `Member Message:${i}`);
      }
    } catch (e) {
      logger.error(JSON.stringify(e));
      expect(true).toBeFalsy();
    }

    const status1 = await markHostMsgRead(playerUuid1, clubCode);
    expect(status1).toBe(true);
    const status2 = await markHostMsgRead(playerUuid2, clubCode);
    expect(status2).toBe(true);

    const resp1 = await hostMessageSummary(ownerUuid, clubCode);
    expect(resp1[0].newMessageCount).toBe(50);
    expect(resp1[1].newMessageCount).toBe(100);

    await markMemberMsgRead(ownerUuid, clubCode, playerUuid1);
    const resp2 = await hostMessageSummary(ownerUuid, clubCode);
    expect(resp2[0].newMessageCount).toBe(50);
    expect(resp2[1].newMessageCount).toBe(0);

    await markMemberMsgRead(ownerUuid, clubCode, playerUuid2);
    const resp3 = await hostMessageSummary(ownerUuid, clubCode);
    expect(resp3[0].newMessageCount).toBe(0);
    expect(resp3[1].newMessageCount).toBe(0);
  });
});
