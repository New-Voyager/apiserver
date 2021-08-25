import {initializeSqlLite} from './utils';
import {
  getClubMembers,
  createClub,
  updateClub,
  joinClub,
  getMemberStatus,
  approveMember,
  rejectMember,
  kickMember,
  leaveClub,
  getClubGames,
  getClubById,
  updateClubMember,
} from '../src/resolvers/club';
import {createPlayer} from '../src/resolvers/player';
import {configureGame} from '../src/resolvers/game';
import {saveReward} from '../src/resolvers/reward';
import {createGameServer} from '../src/internal/gameserver';
import {getLogger} from '../src/utils/log';

const logger = getLogger('club unit-test');

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

const holdemGameInput = {
  gameType: 'HOLDEM',
  title: 'Friday game',
  smallBlind: 1.0,
  bigBlind: 2.0,
  straddleBet: 4.0,
  utgStraddleAllowed: true,
  buttonStraddleAllowed: false,
  minPlayers: 3,
  maxPlayers: 9,
  gameLength: 60,
  buyInApproval: true,
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistAllowed: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 600,
  actionTime: 30,
  muckLosingHand: true,
  rewardIds: [] as any,
};

enum ClubMemberStatus {
  UNKNOWN,
  INVITED,
  PENDING,
  DENIED,
  ACTIVE,
  LEFT,
  KICKEDOUT,
}

async function createReward1(playerId, clubCode) {
  const rewardInput = {
    amount: 100.4,
    endHour: 4,
    minRank: 1,
    name: 'brady',
    startHour: 4,
    type: 'HIGH_HAND',
    schedule: 'HOURLY',
  };
  const resp = await saveReward(playerId, clubCode, rewardInput);
  holdemGameInput.rewardIds.splice(0);
  holdemGameInput.rewardIds.push(resp);
}

describe('Club APIs', () => {
  test('create a club', async () => {
    const ownerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test234'},
    });
    expect(ownerId).not.toBeNull();
    expect(player1Id).not.toBeNull();
    expect(ownerId).not.toBeUndefined();
    expect(player1Id).not.toBeUndefined();
    let clubCode;

    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    try {
      clubCode = await createClub(ownerId, clubInput);
      logger.debug(clubCode);
      expect(clubCode).not.toBeNull();
    } catch (error) {
      logger.error(JSON.stringify(error));
      expect(true).toBeFalsy();
    }

    try {
      const club = await updateClub(ownerId, clubCode, clubInput);
      expect(club).not.toBeNull();
    } catch (error) {
      logger.error(JSON.stringify(error));
      expect(true).toBeFalsy();
    }
  });

  test('player joins a club', async () => {
    const playerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: playerId,
    };
    const clubCode = await createClub(playerId, clubInput);
    try {
      const resp = await getMemberStatus(playerId, clubCode);
      expect(resp).not.toBeUndefined();
      expect(resp).not.toBeNull();
    } catch (error) {
      logger.error(JSON.stringify(error));
      expect(true).toBeFalsy();
    }
    try {
      const resp = await joinClub(playerId, clubCode);
      expect(resp).not.toBeUndefined();
      expect(resp).not.toBeNull();
    } catch (error) {
      logger.error(JSON.stringify(error));
      expect(error.message).toBe(
        'The player is already in the club. Member status: ACTIVE'
      );
    }
  });

  test('player who is not an owner approves a new member', async () => {
    const playerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test-device-owner'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: playerId,
    };
    const clubCode = await createClub(playerId, clubInput);
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test-device1'},
    });
    const player2Id = await createPlayer({
      player: {name: 'player2', deviceId: 'test-device2'},
    });
    await joinClub(player1Id, clubCode);
    await joinClub(player2Id, clubCode);

    // player1 whose status is in PENDING approves player2
    try {
      const approved = await approveMember(player1Id, clubCode, player2Id);
      expect(approved).not.toBe('ACTIVE');
    } catch (error) {
      expect(error.message).toContain('Unauthorized');
    }
  });

  test('owner approves a new member', async () => {
    const playerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test-device-owner'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: playerId,
    };
    const clubCode = await createClub(playerId, clubInput);
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test-device1'},
    });
    const player2Id = await createPlayer({
      player: {name: 'player2', deviceId: 'test-device2'},
    });
    await joinClub(player1Id, clubCode);
    await joinClub(player2Id, clubCode);

    try {
      const approved = await approveMember(playerId, clubCode, player2Id);
      expect(approved).toBe('ACTIVE');
    } catch (error) {
      logger.error(JSON.stringify(error));
      expect(true).toBeFalsy();
    }
  });

  test('owner rejects a new member request', async () => {
    const playerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test-device-owner'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: playerId,
    };
    const clubCode = await createClub(playerId, clubInput);
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test-device1'},
    });
    const player2Id = await createPlayer({
      player: {name: 'player2', deviceId: 'test-device2'},
    });
    await joinClub(player1Id, clubCode);
    await joinClub(player2Id, clubCode);

    // query members and ensure the status is PENDING
    let clubMembers = await getClubMembers(playerId, {clubCode: clubCode});
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for (const member of clubMembers) {
      if (member.playerId === playerId) {
        expect(member.status).toBe('ACTIVE');
      } else {
        expect(member.status).toBe('PENDING');
      }
    }

    // let the owner approve the request

    const player1 = await rejectMember(playerId, clubCode, player1Id);
    expect(player1).toBe('DENIED');

    const player2 = await approveMember(playerId, clubCode, player2Id);
    expect(player2).toBe('ACTIVE');

    clubMembers = await getClubMembers(playerId, {clubCode: clubCode});
    // owner + 1 active players
    expect(clubMembers).toHaveLength(2);
    for (const member of clubMembers) {
      if (member.playerId === player1Id) {
        expect(member.status).toBe('DENIED');
      } else {
        expect(member.status).toBe('ACTIVE');
      }
    }
  });

  test('owner kicks an existing member request', async () => {
    const playerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test-device-owner'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: playerId,
    };
    const clubCode = await createClub(playerId, clubInput);
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test-device1'},
    });
    const player2Id = await createPlayer({
      player: {name: 'player2', deviceId: 'test-device2'},
    });
    await joinClub(player1Id, clubCode);
    await joinClub(player2Id, clubCode);

    // let the owner approve the request
    const player1 = await approveMember(playerId, clubCode, player1Id);
    expect(player1).toBe('ACTIVE');

    const player2 = await approveMember(playerId, clubCode, player2Id);
    expect(player2).toBe('ACTIVE');

    // get club members as player1
    let clubMembers = await getClubMembers(playerId, {clubCode: clubCode});
    // owner + 2 active players
    expect(clubMembers).toHaveLength(3);
    for (const member of clubMembers) {
      expect(member.status).toBe('ACTIVE');
    }

    // kick player1, he should not be able to access the club
    const kicked = await kickMember(playerId, clubCode, player1Id);

    // get club members as owner
    clubMembers = await getClubMembers(playerId, {clubCode: clubCode});
    // owner + 1 player
    expect(clubMembers).toHaveLength(2);
    for (const member of clubMembers) {
      if (member.playerId === player1Id) {
        expect(member.status).toBe('KICKEDOUT');
      } else {
        expect(member.status).toBe('ACTIVE');
      }
    }

    // get club members as the player who got kicked out
    try {
      clubMembers = await getClubMembers(player1Id, {clubCode: clubCode});
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Unauthorized');
    }
  });

  test('player leaves a club', async () => {
    const playerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test-device-owner'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: playerId,
    };
    const clubCode = await createClub(playerId, clubInput);
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test-device1'},
    });
    const player2Id = await createPlayer({
      player: {name: 'player2', deviceId: 'test-device2'},
    });
    await joinClub(player1Id, clubCode);
    await joinClub(player2Id, clubCode);

    // make sure the owner cannot leave the club

    try {
      await leaveClub(playerId, clubCode);
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Owner cannot leave the club');
    }

    await leaveClub(player1Id, clubCode);

    // get club members and ensure player 1 is not in the club
    const members = await getClubMembers(playerId, {clubCode: clubCode});
    let player1Found = false;
    for (const member of members) {
      if (member.playerId === player1Id) {
        player1Found = true;
      }
    }
    expect(player1Found).toBeFalsy();
  });

  test('get club members', async () => {
    try {
      const members = await getClubMembers('1234', {clubCode: '1234'});
      expect(members).toBeNull();
    } catch (err) {
      expect(err.message).toContain('Unauthorized');
    }
  });

  test('get club games', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const gameServer = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer);
    //await createReward(ownerId, clubCode);
    await configureGame(ownerId, clubCode, holdemGameInput);
    //await createReward(ownerId, clubCode);
    await configureGame(ownerId, clubCode, holdemGameInput);
    const games = await getClubGames(ownerId, clubCode);
    expect(games).toHaveLength(2);

    const ownerId2 = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput2 = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode2 = await createClub(ownerId2, clubInput2);
    // get number of club games
    const club2Games = await getClubGames(ownerId2, clubCode2);
    expect(club2Games).toHaveLength(0);
  });

  test.skip('get club games pagination', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const numGames = 30;
    const gameServer1 = {
      ipAddress: '10.1.1.2',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    const gameServer2 = {
      ipAddress: '10.1.1.3',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await createGameServer(gameServer1);
    await createGameServer(gameServer2);
    for (let i = 0; i < numGames; i++) {
      await configureGame(ownerId, clubCode, holdemGameInput);
    }
    let clubGames = await getClubGames(ownerId, clubCode);
    expect(clubGames).toHaveLength(30);
    const firstGame = clubGames[0];
    const lastGame = clubGames[19];
    logger.debug(JSON.stringify(firstGame));
    logger.debug(JSON.stringify(lastGame));
    clubGames = await getClubGames(ownerId, clubCode, false);
    // // TODO: Complete pagination
    // expect(clubGames).toHaveLength(100);
  });

  test('get club by clubId', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    try {
      const games = await getClubById(ownerId, clubCode);
      expect(games).not.toBeNull();
    } catch (err) {
      expect(err.message).toContain('not found');
    }
  });

  test('update club members', async () => {
    const playerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test-device-owner'},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: playerId,
    };
    const clubCode = await createClub(playerId, clubInput);
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test-device1'},
    });
    const player2Id = await createPlayer({
      player: {name: 'player2', deviceId: 'test-device2'},
    });
    await joinClub(player1Id, clubCode);
    await joinClub(player2Id, clubCode);

    // let the owner approve the request
    const player1 = await approveMember(playerId, clubCode, player1Id);
    expect(player1).toBe('ACTIVE');

    const player2 = await approveMember(playerId, clubCode, player2Id);
    expect(player2).toBe('ACTIVE');

    const resp = await updateClubMember(playerId, player1Id, clubCode, {
      balance: 10,
      creditLimit: 1000,
      notes: 'Added credit limit',
      status: ClubMemberStatus['KICKEDOUT'],
      isManager: false,
      autoBuyinApproval: true,
      referredBy: player2Id,
    });
    expect(resp).toBe(ClubMemberStatus['KICKEDOUT']);

    // Player 2 is not a owner of the club
    try {
      const resp1 = await updateClubMember(player2Id, player1Id, clubCode, {
        balance: 10,
        creditLimit: 1000,
        notes: 'Added credit limit',
        status: ClubMemberStatus['KICKEDOUT'],
        isManager: false,
        autoBuyinApproval: true,
      });
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Unauthorized');
    }
  });
});
