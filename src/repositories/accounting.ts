import {getManager, getRepository} from 'typeorm';
import {Club, ClubMember} from '@src/entity/club';
import {TransactionSubType, TransactionType} from '@src/entity/types';
import {Player} from '@src/entity/player';
import {getLogger} from '@src/utils/log';
import {ClubTokenTransactions} from '@src/entity/accounting';
const logger = getLogger('accounting');

class AccountingRepositoryImpl {
  public async clubTransactions(club: Club): Promise<Array<any>> {
    const clubTransactionsRepository = getRepository(ClubTokenTransactions);
    const resp = await clubTransactionsRepository.find({
      relations: ['player'],
      where: {
        club: {id: club.id},
      },
    });
    const transactions = new Array<any>();
    for await (const data of resp) {
      transactions.push({
        playerId: data.player ? data.player.uuid : null,
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
      transaction.type = TransactionType.ADD_TOKENS_TO_PLAYER;

      const resp = await transactionEntityManager
        .getRepository(ClubTokenTransactions)
        .save(transaction);
    });
    logger.info('****** ENDING TRANSACTION FOR UPDATE PLAYER BALANCE');
    return true;
  }
}

export const AccountingRepository = new AccountingRepositoryImpl();
