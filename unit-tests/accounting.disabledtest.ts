import {initializeSqlLite} from './utils';
import {createClub, joinClub, approveMember} from '../src/resolvers/club';
import {
  getClubBalanceAmount,
  getPlayerBalanceAmount,
} from '../src/resolvers/chipstrack';
import {createPlayer} from '../src/resolvers/player';
import {
  clubTransactions,
  addTokensToClub,
  addTokensToPlayer,
  withdrawTokensFromClub,
  withdrawTokensFromPlayer,
  updateClubBalance,
  updatePlayerBalance,
  playerTransactions,
  settlePlayerToPlayer,
} from '../src/resolvers/accounting';

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Accounting APIs', () => {
  test('Update club balance & player balance', async () => {
    const ownerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test234'},
    });
    const clubCode = await createClub(ownerId, {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    });
    await joinClub(player1Id, clubCode);
    await approveMember(ownerId, clubCode, player1Id);

    const clubBalance1 = await getClubBalanceAmount(ownerId, {
      clubCode: clubCode,
    });
    expect(clubBalance1.balance).toBe(0);
    const playerBalance1 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance1.balance).toBe(0);

    await updateClubBalance(ownerId, clubCode, 10, 'update balance');
    await updatePlayerBalance(ownerId, clubCode, player1Id, 10, 'update');
    const clubBalance2 = await getClubBalanceAmount(ownerId, {
      clubCode: clubCode,
    });
    expect(clubBalance2.balance).toBe(10);
    const playerBalance2 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance2.balance).toBe(10);

    await updateClubBalance(ownerId, clubCode, 100, 'update balance');
    await updatePlayerBalance(ownerId, clubCode, player1Id, 0, 'update');
    const clubBalance3 = await getClubBalanceAmount(ownerId, {
      clubCode: clubCode,
    });
    expect(clubBalance3.balance).toBe(100);
    const playerBalance3 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance3.balance).toBe(0);

    const resp = await clubTransactions(ownerId, clubCode);
    expect(resp).toHaveLength(4);
  });

  test('add & withdraw token for club', async () => {
    const ownerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const clubCode = await createClub(ownerId, {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    });

    const clubBalance1 = await getClubBalanceAmount(ownerId, {
      clubCode: clubCode,
    });
    expect(clubBalance1.balance).toBe(0);

    await updateClubBalance(ownerId, clubCode, 10, 'update balance');
    const clubBalance2 = await getClubBalanceAmount(ownerId, {
      clubCode: clubCode,
    });
    expect(clubBalance2.balance).toBe(10);

    await addTokensToClub(
      ownerId,
      clubCode,
      'TRANSACTION',
      10,
      'add 10 tokens'
    );
    const clubBalance3 = await getClubBalanceAmount(ownerId, {
      clubCode: clubCode,
    });
    expect(clubBalance3.balance).toBe(20);

    await withdrawTokensFromClub(
      ownerId,
      clubCode,
      'TRANSACTION',
      5,
      'withdraw 5 tokens'
    );
    const clubBalance4 = await getClubBalanceAmount(ownerId, {
      clubCode: clubCode,
    });
    expect(clubBalance4.balance).toBe(15);

    await withdrawTokensFromClub(
      ownerId,
      clubCode,
      'TRANSACTION',
      20,
      'withdraw 5 tokens'
    );
    const clubBalance5 = await getClubBalanceAmount(ownerId, {
      clubCode: clubCode,
    });
    expect(clubBalance5.balance).toBe(-5);

    const resp = await clubTransactions(ownerId, clubCode);
    expect(resp).toHaveLength(4);
  });

  test('add & withdraw token for player', async () => {
    const ownerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test234'},
    });
    const clubCode = await createClub(ownerId, {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    });
    await joinClub(player1Id, clubCode);
    await approveMember(ownerId, clubCode, player1Id);

    const playerBalance1 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance1.balance).toBe(0);

    await updatePlayerBalance(
      ownerId,
      clubCode,
      player1Id,
      10,
      'update balance'
    );
    const playerBalance2 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance2.balance).toBe(10);

    await addTokensToPlayer(
      ownerId,
      clubCode,
      player1Id,
      'TRANSACTION',
      10,
      'add 10 tokens'
    );
    const playerBalance3 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance3.balance).toBe(20);

    await withdrawTokensFromPlayer(
      ownerId,
      clubCode,
      player1Id,
      'TRANSACTION',
      5,
      'withdraw 5 tokens'
    );
    const playerBalance4 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance4.balance).toBe(15);

    await withdrawTokensFromPlayer(
      ownerId,
      clubCode,
      player1Id,
      'TRANSACTION',
      20,
      'withdraw 5 tokens'
    );
    const playerBalance5 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance5.balance).toBe(-5);

    const resp = await clubTransactions(ownerId, clubCode);
    expect(resp).toHaveLength(4);
  });

  test('Player to Player Transactions', async () => {
    const ownerId = await createPlayer({
      player: {name: 'owner', deviceId: 'test'},
    });
    const player1Id = await createPlayer({
      player: {name: 'player1', deviceId: 'test234'},
    });
    const player2Id = await createPlayer({
      player: {name: 'player2', deviceId: 'test234567'},
    });
    const clubCode = await createClub(ownerId, {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    });
    await joinClub(player1Id, clubCode);
    await approveMember(ownerId, clubCode, player1Id);
    await joinClub(player2Id, clubCode);
    await approveMember(ownerId, clubCode, player2Id);

    const playerBalance1 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance1.balance).toBe(0);
    const playerBalance2 = await getPlayerBalanceAmount(player2Id, {
      clubCode: clubCode,
    });
    expect(playerBalance2.balance).toBe(0);

    await updatePlayerBalance(
      ownerId,
      clubCode,
      player1Id,
      10,
      'update balance'
    );
    await updatePlayerBalance(
      ownerId,
      clubCode,
      player2Id,
      10,
      'update balance'
    );
    const playerBalance3 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance3.balance).toBe(10);
    const playerBalance4 = await getPlayerBalanceAmount(player2Id, {
      clubCode: clubCode,
    });
    expect(playerBalance4.balance).toBe(10);

    await settlePlayerToPlayer(
      ownerId,
      clubCode,
      player1Id,
      player2Id,
      5,
      'amount sent'
    );

    const playerBalance5 = await getPlayerBalanceAmount(player1Id, {
      clubCode: clubCode,
    });
    expect(playerBalance5.balance).toBe(5);
    const playerBalance6 = await getPlayerBalanceAmount(player2Id, {
      clubCode: clubCode,
    });
    expect(playerBalance6.balance).toBe(15);

    const resp1 = await playerTransactions(ownerId, clubCode, player1Id);
    const resp2 = await playerTransactions(ownerId, clubCode, player2Id);
    expect(resp1).toHaveLength(1);
    expect(resp2).toHaveLength(1);
  });
});
