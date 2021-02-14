import {getManager, getRepository, In} from 'typeorm';
import {Club, ClubMember} from '@src/entity/club';
import {TransactionSubType, TransactionType} from '@src/entity/types';
import {ClubTransaction, PlayerTransaction} from '@src/types';
import {Player} from '@src/entity/player';
import {getLogger} from '@src/utils/log';
import {ClubTokenTransactions} from '@src/entity/accounting';
const logger = getLogger('accounting - repositories');

class AccountingRepositoryImpl {
  public async clubTransactions(club: Club): Promise<Array<ClubTransaction>> {
    const clubTransactionsRepository = getRepository(ClubTokenTransactions);
    const resp = await clubTransactionsRepository.find({
      relations: ['player'],
      where: {
        club: {id: club.id},
        type: In([
          TransactionType.ADD_TOKENS_TO_PLAYER,
          TransactionType.WITHDRAW_TOKENS_FROM_PLAYER,
          TransactionType.ADD_TOKENS_TO_CLUB,
          TransactionType.WITHDRAW_TOKENS_FROM_CLUB,
          TransactionType.CLUB_BALANCE_UPDATED,
          TransactionType.PLAYER_BALANCE_UPDATED,
        ]),
      },
    });
    const transactions = new Array<ClubTransaction>();
    for await (const data of resp) {
      transactions.push({
        playerId: data.player ? data.player.uuid : undefined,
        type: TransactionType[data.type],
        subType: TransactionSubType[data.subType],
        amount: data.token,
        notes: data.notes,
        updatedDate: data.createdAt,
      });
    }
    return transactions;
  }

  public async addTokensToPlayer(
    host: Player,
    club: Club,
    clubMember: ClubMember,
    player: Player,
    subType: TransactionSubType,
    amount: number,
    notes: string
  ): Promise<boolean> {
    logger.info('****** STARTING TRANSACTION FOR ADD TOKENS TO PLAYER');
    await getManager().transaction(async transactionEntityManager => {
      const updateClubMemberQuery = `update club_member set balance = balance + ${amount} where id = ${clubMember.id}`;
      await transactionEntityManager.query(updateClubMemberQuery);

      const transaction = new ClubTokenTransactions();
      transaction.host = host;
      transaction.club = club;
      transaction.notes = notes;
      transaction.player = player;
      transaction.subType = subType;
      transaction.token = amount;
      transaction.type = TransactionType.ADD_TOKENS_TO_PLAYER;

      await transactionEntityManager
        .getRepository(ClubTokenTransactions)
        .save(transaction);
    });
    logger.info('****** ENDING TRANSACTION FOR ADD TOKENS TO PLAYER');
    return true;
  }

  public async withdrawTokensFromPlayer(
    host: Player,
    club: Club,
    clubMember: ClubMember,
    player: Player,
    subType: TransactionSubType,
    amount: number,
    notes: string
  ): Promise<boolean> {
    logger.info('****** STARTING TRANSACTION FOR WITHDRAW TOKENS FROM PLAYER');
    await getManager().transaction(async transactionEntityManager => {
      const updateClubMemberQuery = `update club_member set balance = balance - ${amount} where id = ${clubMember.id}`;
      await transactionEntityManager.query(updateClubMemberQuery);

      const transaction = new ClubTokenTransactions();
      transaction.host = host;
      transaction.club = club;
      transaction.notes = notes;
      transaction.player = player;
      transaction.subType = subType;
      transaction.token = amount;
      transaction.type = TransactionType.WITHDRAW_TOKENS_FROM_PLAYER;

      await transactionEntityManager
        .getRepository(ClubTokenTransactions)
        .save(transaction);
    });
    logger.info('****** ENDING TRANSACTION FOR WITHDRAW TOKENS FROM PLAYER');
    return true;
  }

  public async addTokensToClub(
    host: Player,
    club: Club,
    subType: TransactionSubType,
    amount: number,
    notes: string
  ): Promise<boolean> {
    logger.info('****** STARTING TRANSACTION FOR ADD TOKENS TO CLUB');
    await getManager().transaction(async transactionEntityManager => {
      const updateClubQuery = `update club set balance = balance + ${amount} where id = ${club.id}`;
      await transactionEntityManager.query(updateClubQuery);

      const transaction = new ClubTokenTransactions();
      transaction.host = host;
      transaction.club = club;
      transaction.notes = notes;
      transaction.subType = subType;
      transaction.token = amount;
      transaction.type = TransactionType.ADD_TOKENS_TO_CLUB;

      await transactionEntityManager
        .getRepository(ClubTokenTransactions)
        .save(transaction);
    });
    logger.info('****** ENDING TRANSACTION FOR ADD TOKENS TO CLUB');
    return true;
  }

  public async withdrawTokensFromClub(
    host: Player,
    club: Club,
    subType: TransactionSubType,
    amount: number,
    notes: string
  ): Promise<boolean> {
    logger.info('****** STARTING TRANSACTION FOR WITHDRAW TOKENS FROM CLUB');
    await getManager().transaction(async transactionEntityManager => {
      const updateClubQuery = `update club set balance = balance - ${amount} where id = ${club.id}`;
      await transactionEntityManager.query(updateClubQuery);

      const transaction = new ClubTokenTransactions();
      transaction.host = host;
      transaction.club = club;
      transaction.notes = notes;
      transaction.subType = subType;
      transaction.token = amount;
      transaction.type = TransactionType.WITHDRAW_TOKENS_FROM_CLUB;

      await transactionEntityManager
        .getRepository(ClubTokenTransactions)
        .save(transaction);
    });
    logger.info('****** ENDING TRANSACTION FOR WITHDRAW TOKENS FROM CLUB');
    return true;
  }

  public async updateClubBalance(
    host: Player,
    club: Club,
    amount: number,
    notes: string
  ): Promise<boolean> {
    logger.info('****** STARTING TRANSACTION FOR UPDATE CLUB BALANCE');
    await getManager().transaction(async transactionEntityManager => {
      const updateClubQuery = `update club set balance = ${amount} where id = ${club.id}`;
      await transactionEntityManager.query(updateClubQuery);

      const transaction = new ClubTokenTransactions();
      transaction.host = host;
      transaction.club = club;
      transaction.notes = notes;
      transaction.token = amount;
      transaction.type = TransactionType.CLUB_BALANCE_UPDATED;

      await transactionEntityManager
        .getRepository(ClubTokenTransactions)
        .save(transaction);
    });
    logger.info('****** ENDING TRANSACTION FOR UPDATE CLUB BALANCE');
    return true;
  }

  public async updatePlayerBalance(
    host: Player,
    club: Club,
    clubMember: ClubMember,
    player: Player,
    amount: number,
    notes: string
  ): Promise<boolean> {
    logger.info('****** STARTING TRANSACTION FOR UPDATE PLAYER BALANCE');
    await getManager().transaction(async transactionEntityManager => {
      const updateClubMemberQuery = `update club_member set balance = ${amount} where id = ${clubMember.id}`;
      await transactionEntityManager.query(updateClubMemberQuery);

      const transaction = new ClubTokenTransactions();
      transaction.host = host;
      transaction.club = club;
      transaction.notes = notes;
      transaction.player = player;
      transaction.token = amount;
      transaction.type = TransactionType.PLAYER_BALANCE_UPDATED;

      const resp = await transactionEntityManager
        .getRepository(ClubTokenTransactions)
        .save(transaction);
    });
    logger.info('****** ENDING TRANSACTION FOR UPDATE PLAYER BALANCE');
    return true;
  }

  public async playerTransactions(
    club: Club,
    player: Player
  ): Promise<Array<PlayerTransaction>> {
    const clubTransactionsRepository = getRepository(ClubTokenTransactions);
    const resp = await clubTransactionsRepository.find({
      relations: ['player'],
      where: {
        club: {id: club.id},
        player: {id: player.id},
        type: In([
          TransactionType.SEND_PLAYER_TO_PLAYER,
          TransactionType.RECEIVE_PLAYER_TO_PLAYER,
        ]),
      },
    });
    const transactions = new Array<PlayerTransaction>();
    for await (const data of resp) {
      transactions.push({
        playerId: data.player.uuid,
        otherPlayerId: data.otherPlayer ? data.otherPlayer.uuid : undefined,
        type: TransactionType[data.type],
        subType: TransactionSubType[data.subType],
        amount: data.token,
        notes: data.notes,
        updatedDate: data.createdAt,
      });
    }
    return transactions;
  }

  public async settlePlayerToPlayer(
    host: Player,
    club: Club,
    fromClubMember: ClubMember,
    toClubMember: ClubMember,
    fromPlayer: Player,
    toPlayer: Player,
    amount: number,
    notes: string
  ): Promise<boolean> {
    logger.info('****** STARTING TRANSACTION FOR SETTLE PLAYER TO PLAYER');
    await getManager().transaction(async transactionEntityManager => {
      const updateFromClubMemberQuery = `update club_member set balance = balance - ${amount} where id = ${fromClubMember.id}`;
      const updateToClubMemberQuery = `update club_member set balance = balance + ${amount} where id = ${toClubMember.id}`;
      await transactionEntityManager.query(updateFromClubMemberQuery);
      await transactionEntityManager.query(updateToClubMemberQuery);

      const fromTransaction = new ClubTokenTransactions();
      fromTransaction.host = host;
      fromTransaction.club = club;
      fromTransaction.notes = notes;
      fromTransaction.player = fromPlayer;
      fromTransaction.otherPlayer = toPlayer;
      fromTransaction.subType = TransactionSubType.TRANSACTION;
      fromTransaction.token = amount;
      fromTransaction.type = TransactionType.SEND_PLAYER_TO_PLAYER;

      const toTransaction = new ClubTokenTransactions();
      toTransaction.host = host;
      toTransaction.club = club;
      toTransaction.notes = notes;
      toTransaction.player = toPlayer;
      toTransaction.otherPlayer = fromPlayer;
      toTransaction.subType = TransactionSubType.TRANSACTION;
      toTransaction.token = amount;
      toTransaction.type = TransactionType.RECEIVE_PLAYER_TO_PLAYER;

      await transactionEntityManager
        .getRepository(ClubTokenTransactions)
        .save(toTransaction);
      await transactionEntityManager
        .getRepository(ClubTokenTransactions)
        .save(fromTransaction);
    });
    logger.info('****** ENDING TRANSACTION FOR SETTLE PLAYER TO PLAYER');
    return true;
  }
}

export const AccountingRepository = new AccountingRepositoryImpl();
