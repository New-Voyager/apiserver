import {
  HandHistory,
  HandWinners,
  WonAtStatus,
  StarredHands,
} from '@src/entity/hand';
import {getRepository, LessThan, MoreThan, getManager} from 'typeorm';
import {PageOptions} from '@src/types';
import {GameType} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
import {PlayerChipsTrack, ClubGameRake} from '@src/entity/chipstrack';
import {GameRepository} from './game';
import {ClubRepository} from './club';

const logger = getLogger('hand');

const MAX_STARRED_HAND = 25;

class HandRepositoryImpl {
  public async saveHand(handData: any): Promise<any> {
    try {
      const handHistoryRepository = getRepository(HandHistory);
      const handWinnersRepository = getRepository(HandWinners);
      const playersChipsRepository = getRepository(PlayerChipsTrack);
      const clubGameRakeRepository = getRepository(ClubGameRake);

      const handHistory = new HandHistory();
      const wonAt: string = handData.Result.won_at;
      const gameType: string = handData.GameType;

      /**
       * Assigning values and saving hand history
       */
      handHistory.clubId = handData.ClubId;
      handHistory.gameNum = handData.GameNum;
      handHistory.handNum = handData.HandNum;
      handHistory.gameType = GameType[gameType];
      handHistory.wonAt = WonAtStatus[wonAt];
      handHistory.showDown = handData.Result.showdown;
      if (handData.Result.showdown) {
        if (handData.GameType === GameType[GameType.OMAHA_HILO]) {
          handHistory.winningCards = handData.Result.hi_winning_cards.join(
            ', '
          );
          handHistory.winningRank = handData.Result.hi_winning_rank;
          handHistory.loWinningCards = handData.Result.lo_winning_cards.join(
            ', '
          );
          handHistory.loWinningRank = handData.Result.lo_winning_rank;
        } else {
          handHistory.winningCards = handData.Result.winning_cards.join(', ');
          handHistory.winningRank = handData.Result.rank_num;
        }
        handHistory.totalPot = handData.Result.total_pot;
      }
      handHistory.timeStarted = handData.StartedAt;
      handHistory.timeEnded = handData.EndedAt;
      handHistory.data = JSON.stringify(handData);

      const gameId = await GameRepository.getGameById(handData.GameNum);
      const clubId = await ClubRepository.getClubById(handData.ClubId);

      if (!gameId) {
        logger.error(`Game ID ${gameId} not found`);
        throw new Error(`Game ID ${gameId} not found`);
      }
      if (!clubId) {
        logger.error(`Club ID ${clubId} not found`);
        throw new Error(`Club ID ${clubId} not found`);
      }

      await getManager().transaction(async transactionalEntityManager => {
        await handHistoryRepository.save(handHistory);

        /**
         * Assigning values and saving hand winners
         */
        if (handData.Result.showdown) {
          if (handData.GameType === GameType[GameType.OMAHA_HILO]) {
            await handData.Result.pot_winners[0].hi_winners.forEach(
              async (winner: {
                winning_cards: Array<string>;
                rank_num: number;
                player: number;
                received: number;
              }) => {
                const handWinners = new HandWinners();
                handWinners.clubId = handData.ClubId;
                handWinners.gameNum = handData.GameNum;
                handWinners.handNum = handData.HandNum;
                handWinners.winningCards = winner.winning_cards.join(', ');
                handWinners.winningRank = winner.rank_num;
                handWinners.playerId = winner.player;
                handWinners.received = winner.received;
                await handWinnersRepository.save(handWinners);
              }
            );

            await handData.Result.pot_winners[0].lo_winners.forEach(
              async (winner: {
                winning_cards: Array<string>;
                rank_num: number;
                player: number;
                received: number;
              }) => {
                const handWinners = new HandWinners();
                handWinners.clubId = handData.ClubId;
                handWinners.gameNum = handData.GameNum;
                handWinners.handNum = handData.HandNum;
                handWinners.winningCards = winner.winning_cards.join(', ');
                handWinners.winningRank = winner.rank_num;
                handWinners.playerId = winner.player;
                handWinners.received = winner.received;
                handWinners.isHigh = false;
                await handWinnersRepository.save(handWinners);
              }
            );
          } else {
            await handData.Result.pot_winners[0].winners.forEach(
              async (winner: {
                winning_cards: Array<string>;
                rank_num: number;
                player: number;
                received: number;
              }) => {
                const handWinners = new HandWinners();
                handWinners.clubId = handData.ClubId;
                handWinners.gameNum = handData.GameNum;
                handWinners.handNum = handData.HandNum;
                handWinners.winningCards = winner.winning_cards.join(', ');
                handWinners.winningRank = winner.rank_num;
                handWinners.playerId = winner.player;
                handWinners.received = winner.received;
                await handWinnersRepository.save(handWinners);
              }
            );
          }
        } else {
          await handData.Result.pot_winners[0].winners.forEach(
            async (winner: {player: number; received: number}) => {
              const handWinners = new HandWinners();
              handWinners.clubId = handData.ClubId;
              handWinners.gameNum = handData.GameNum;
              handWinners.handNum = handData.HandNum;
              handWinners.playerId = winner.player;
              handWinners.received = winner.received;
              await handWinnersRepository.save(handWinners);
            }
          );
        }

        await handData.Result.summary.forEach(
          async (playerData: {player: number; balance: number}) => {
            const playerChips = await playersChipsRepository.findOne({
              where: {
                clubId: clubId,
                gameId: gameId,
                playerId: playerData.player,
              },
            });
            if (!playerChips) {
              logger.error(
                `Player ID ${playerData.player} not found in chips table`
              );
              throw new Error(
                `Player ID ${playerData.player} not found in chips table`
              );
            }
            playerChips.stack = playerData.balance;
            await playersChipsRepository.save(playerChips);
          }
        );

        const clubRake = await clubGameRakeRepository.findOne({
          where: {clubId: clubId, gameId: gameId},
        });
        if (!clubRake) {
          logger.error(`Club ID ${handData.ClubId} not found in rake table`);
          throw new Error(`Club ID ${handData.ClubId} not found in rake table`);
        }
        clubRake.rake += Number.parseFloat(handData.Result.rake);
        clubRake.lastHandNum = Number.parseInt(handData.HandNum);
        await clubGameRakeRepository.save(clubRake);
      });
      return true;
    } catch (err) {
      logger.error(`Error when trying to save starred hands: ${err.toString}`);
      return err;
    }
  }

  public async getSpecificHandHistory(
    clubId: string,
    gameNum: string,
    handNum: string
  ): Promise<HandHistory | undefined> {
    const handHistoryRepository = getRepository(HandHistory);
    const handHistory = await handHistoryRepository.findOne({
      where: {clubId: clubId, gameNum: gameNum, handNum: handNum},
    });
    return handHistory;
  }

  public async getLastHandHistory(
    clubId: string,
    gameNum: string
  ): Promise<HandHistory | undefined> {
    const handHistoryRepository = getRepository(HandHistory);
    const hands = await handHistoryRepository.find({
      where: {clubId: clubId, gameNum: gameNum},
      order: {handNum: 'DESC'},
    });
    // const sortedHands = hands.sort((b, a) => {
    //   return b.handNum < a.handNum ? 1 : b.handNum > a.handNum ? -1 : 0;
    // });
    return hands[0];
  }

  public async getAllHandHistory(
    clubId: string,
    gameNum: string,
    pageOptions?: PageOptions
  ): Promise<Array<HandHistory>> {
    if (!pageOptions) {
      pageOptions = {
        count: 10,
        prev: 0x7fffffff,
      };
    }

    let order: any = {
      id: 'DESC',
    };

    let pageWhere: any;
    if (pageOptions.next) {
      order = {
        id: 'DESC',
      };
      pageWhere = MoreThan(pageOptions.next);
    } else {
      if (pageOptions.prev) {
        order = {
          id: 'DESC',
        };
        pageWhere = LessThan(pageOptions.prev);
      }
    }

    logger.info(`pageOptions count: ${pageOptions.count}`);
    let take = pageOptions.count;
    if (!take || take > 10) {
      take = 10;
    }

    const findOptions: any = {
      where: {
        clubId: clubId,
        gameNum: gameNum,
      },
      order: order,
      take: take,
    };

    if (pageWhere) {
      findOptions['where']['id'] = pageWhere;
    }
    const handHistoryRepository = getRepository(HandHistory);
    const handHistory = await handHistoryRepository.find(findOptions);
    return handHistory;
  }

  public async getMyWinningHands(
    clubId: string,
    gameNum: string,
    playerId: number,
    pageOptions?: PageOptions
  ): Promise<Array<HandWinners>> {
    if (!pageOptions) {
      pageOptions = {
        count: 10,
        prev: 0x7fffffff,
      };
    }

    let order: any = {
      id: 'DESC',
    };

    let pageWhere: any;
    if (pageOptions.next) {
      order = {
        id: 'DESC',
      };
      pageWhere = MoreThan(pageOptions.next);
    } else {
      if (pageOptions.prev) {
        order = {
          id: 'DESC',
        };
        pageWhere = LessThan(pageOptions.prev);
      }
    }

    logger.info(`pageOptions count: ${pageOptions.count}`);
    let take = pageOptions.count;
    if (!take || take > 10) {
      take = 10;
    }

    const findOptions: any = {
      where: {
        clubId: clubId,
        gameNum: gameNum,
        playerId: playerId,
      },
      order: order,
      take: take,
    };

    if (pageWhere) {
      findOptions['where']['id'] = pageWhere;
    }
    const handWinnersRepository = getRepository(HandWinners);
    const handWinners = await handWinnersRepository.find(findOptions);
    return handWinners;
  }

  public async saveStarredHand(
    clubId: string,
    gameNum: string,
    handNum: string,
    playerId: number,
    handHistory: HandHistory
  ): Promise<boolean> {
    try {
      const starredHandsRepository = getRepository(StarredHands);

      const findOptions: any = {
        where: {
          playerId: playerId,
        },
        order: {id: 'ASC'},
      };
      const previousHands = await starredHandsRepository.find(findOptions);
      if (previousHands.length >= MAX_STARRED_HAND) {
        await starredHandsRepository.delete(previousHands[0].id);
      }
      const starredHand = new StarredHands();
      starredHand.clubId = clubId;
      starredHand.gameNum = gameNum;
      starredHand.handNum = handNum;
      starredHand.playerId = playerId;
      starredHand.handHistory = handHistory;
      await getManager().transaction(async transactionalEntityManager => {
        await starredHandsRepository.save(starredHand);
      });
      return true;
    } catch (error) {
      logger.error(
        `Error when trying to save starred hands: ${error.toString}`
      );
      throw error;
    }
  }

  public async getStarredHands(playerId: number): Promise<Array<StarredHands>> {
    const starredHandsRepository = getRepository(StarredHands);

    const findOptions: any = {
      relations: ['handHistory'],
      where: {
        playerId: playerId,
      },
      order: {id: 'DESC'},
    };

    const starredHands = await starredHandsRepository.find(findOptions);
    return starredHands;
  }
}

export const HandRepository = new HandRepositoryImpl();
