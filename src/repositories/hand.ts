import {
  HandHistory,
  HandWinners,
  WonAtStatus,
  StarredHands,
} from '@src/entity/hand';
import {getRepository, LessThan, MoreThan, getManager} from 'typeorm';
import {PageOptions} from '@src/types';
import {PokerGame} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker, ClubGameRake} from '@src/entity/chipstrack';
import {
  GamePromotion,
  Promotion,
  PromotionWinners,
} from '@src/entity/promotion';
import {Player} from '@src/entity/player';
import {Club} from '@src/entity/club';

const logger = getLogger('hand');

const MAX_STARRED_HAND = 25;

class HandRepositoryImpl {
  public async saveHand(handData: any): Promise<any> {
    try {
      const handHistoryRepository = getRepository(HandHistory);
      const handWinnersRepository = getRepository(HandWinners);
      const playersChipsRepository = getRepository(PlayerGameTracker);
      const clubGameRakeRepository = getRepository(ClubGameRake);
      const gamePromotionRepository = getRepository(GamePromotion);
      const promotionRepository = getRepository(Promotion);
      const promotionWinnersRepository = getRepository(PromotionWinners);
      const playerRepository = getRepository(Player);
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PokerGame);

      /**
       * Validating data
       */
      let club = await clubRepository.findOne({
        where: {id: handData.clubId},
      });

      if (handData.clubId === 0) {
        club = new Club();
        club.id = 0;
      }

      if (!club) {
        logger.error(`Club ID ${handData.clubId} not found`);
        return new Error(`Club ID ${handData.clubId} not found`);
      }

      const game = await gameRepository.findOne({
        where: {id: handData.gameNum},
      });
      if (!game) {
        logger.error(`Game ID ${handData.gameNum} not found`);
        return new Error(`Game ID ${handData.gameNum} not found`);
      }
      let clubRake;
      if (handData.clubId !== 0) {
        clubRake = await clubGameRakeRepository.findOne({
          relations: ['club', 'game'],
          where: {club: club, game: game},
        });
      } else {
        clubRake = await clubGameRakeRepository.findOne({
          relations: ['game'],
          where: {game: game},
        });
      }
      if (!clubRake) {
        logger.error(`Club ID ${handData.clubId} not found in rake table`);
        return new Error(`Club ID ${handData.clubId} not found in rake table`);
      }

      let promotion, gamePromotion, promoPlayer;
      if (
        handData.handResult.qualifyingPromotionWinner &&
        handData.clubId !== 0
      ) {
        promotion = await promotionRepository.findOne({
          where: {id: handData.handResult.qualifyingPromotionWinner.promoId},
        });
        if (!promotion) {
          logger.error(
            `Promotion ID ${handData.handResult.qualifyingPromotionWinner.promoId} not found`
          );
          return new Error(
            `Promotion ID ${handData.handResult.qualifyingPromotionWinner.promoId} not found`
          );
        }

        gamePromotion = await gamePromotionRepository.findOne({
          where: {club: club.id, game: game.id, promoId: promotion.id},
        });
        if (!gamePromotion) {
          logger.error(
            `Promotion ID ${handData.handResult.qualifyingPromotionWinner.promoId} not found in game promotion`
          );
          return new Error(
            `Promotion ID ${handData.handResult.qualifyingPromotionWinner.promoId} not found in game promotion`
          );
        }

        promoPlayer = await playerRepository.findOne({
          where: {id: handData.handResult.qualifyingPromotionWinner.playerId},
        });
        if (!promoPlayer) {
          logger.error(
            `Player ID ${handData.handResult.qualifyingPromotionWinner.playerId} not found`
          );
          return new Error(
            `Player ID ${handData.handResult.qualifyingPromotionWinner.playerId} not found`
          );
        }
      }

      /**
       * Assigning hand history values
       */
      const handHistory = new HandHistory();
      const wonAt: string = handData.handResult.wonAt;
      const potWinners = handData.handResult.potWinners[0];
      const seatingArrangements = handData.handResult.playersInSeats;

      handHistory.clubId = handData.clubId;
      handHistory.gameNum = handData.gameNum;
      handHistory.handNum = handData.handNum;
      handHistory.gameType = game.gameType;
      handHistory.wonAt = WonAtStatus[wonAt];
      if (wonAt === 'SHOW_DOWN') {
        handHistory.showDown = true;
        handHistory.winningCards = potWinners.hiWinners[0].winningCardsStr;
        handHistory.winningRank = potWinners.hiWinners[0].rank;
        handHistory.totalPot = handData.handResult.totalPot;
        if (potWinners.loWinners) {
          handHistory.loWinningCards = potWinners.loWinners[0].winningCardsStr;
          handHistory.loWinningRank = potWinners.loWinners[0].rank;
        }
      } else {
        handHistory.showDown = false;
      }
      handHistory.timeStarted = handData.handResult.handStartedAt;
      handHistory.timeEnded = handData.handResult.handEndedAt;
      handHistory.data = JSON.stringify(handData);

      /**
       * Assigning hand winners values
       */
      const allHandWinners = new Array<HandWinners>();
      for await (const hiWinner of potWinners.hiWinners) {
        const handWinners = new HandWinners();
        handWinners.clubId = handData.clubId;
        handWinners.gameNum = handData.gameNum;
        handWinners.handNum = handData.handNum;
        if (wonAt === 'SHOW_DOWN') {
          handWinners.winningCards = hiWinner.winningCardsStr;
          handWinners.winningRank = hiWinner.rank;
        }
        handWinners.playerId = seatingArrangements[hiWinner.seatNo - 1];
        handWinners.received = hiWinner.amount;
        allHandWinners.push(handWinners);
      }
      if (potWinners.loWinners) {
        for await (const loWinner of potWinners.loWinners) {
          const handWinners = new HandWinners();
          handWinners.clubId = handData.clubId;
          handWinners.gameNum = handData.gameNum;
          handWinners.handNum = handData.handNum;
          if (wonAt === 'SHOW_DOWN') {
            handWinners.winningCards = loWinner.winningCardsStr;
            handWinners.winningRank = loWinner.rank;
          }
          handWinners.playerId = seatingArrangements[loWinner.seatNo - 1];
          handWinners.received = loWinner.amount;
          handWinners.isHigh = false;
          allHandWinners.push(handWinners);
        }
      }

      /**
       * Assigning player chips values
       */
      const allPlayerChips = new Array<PlayerGameTracker>();
      for await (const playerData of handData.handResult.balanceAfterHand) {
        let playerChips;
        if (handData.clubId !== 0) {
          playerChips = await playersChipsRepository.findOne({
            relations: ['club', 'game', 'player'],
            where: {
              club: club.id,
              game: game.id,
              player: playerData.playerId,
            },
          });
        } else {
          playerChips = await playersChipsRepository.findOne({
            relations: ['game', 'player'],
            where: {
              game: game.id,
              player: playerData.playerId,
            },
          });
        }
        if (!playerChips) {
          logger.error(
            `Player ID ${playerData.player} not found in chips table`
          );
          return new Error(
            `Player ID ${playerData.player} not found in chips table`
          );
        }
        playerChips.stack = playerData.balance;
        allPlayerChips.push(playerChips);
      }

      /**
       * Making all DB transactions
       */
      await getManager()
        .transaction(async transactionalEntityManager => {
          await handHistoryRepository.save(handHistory);
          for await (const winner of allHandWinners) {
            await handWinnersRepository.save(winner);
          }
          for await (const chips of allPlayerChips) {
            await playersChipsRepository.save(chips);
          }

          clubRake.rake += Number.parseFloat(handData.handResult.tips);
          await clubGameRakeRepository.save(clubRake);

          if (
            handData.handResult.qualifyingPromotionWinner &&
            handData.clubId !== 0
          ) {
            const promotionWinners = await promotionWinnersRepository.find({
              where: {club: club, game: game, promoId: promotion},
            });

            let flag = true;
            if (promotionWinners.length !== 0) {
              if (
                promotionWinners[0].rank >
                handData.handResult.qualifyingPromotionWinner.rank
              ) {
                await promotionWinnersRepository.delete({
                  club: club,
                  game: game,
                  promoId: promotion,
                });
              } else if (
                promotionWinners[0].rank <
                handData.handResult.qualifyingPromotionWinner.rank
              ) {
                flag = false;
              }
            }
            if (flag) {
              const newWinner = new PromotionWinners();
              if (club) {
                newWinner.club = club;
              }
              newWinner.amountWon = 0;
              newWinner.game = game;
              newWinner.handNum = handData.handNum;
              newWinner.player = promoPlayer;
              newWinner.promoId = promotion;
              newWinner.rank =
                handData.handResult.qualifyingPromotionWinner.rank;
              newWinner.winningCards =
                handData.handResult.qualifyingPromotionWinner.cardsStr;
              await promotionWinnersRepository.save(newWinner);
            }
          }
        })
        .catch(err => {
          logger.error(
            `Error when trying to save starred hands: ${err.toString()}`
          );
          return err;
        });
      return true;
    } catch (err) {
      logger.error(
        `Error when trying to save starred hands: ${err.toString()}`
      );
      return err;
    }
  }

  public async getSpecificHandHistory(
    clubId: number,
    gameNum: number,
    handNum: number
  ): Promise<HandHistory | undefined> {
    logger.debug(clubId);
    const handHistoryRepository = getRepository(HandHistory);
    const handHistory = await handHistoryRepository.findOne({
      where: {clubId: clubId, gameNum: gameNum, handNum: handNum},
    });
    return handHistory;
  }

  public async getLastHandHistory(
    clubId: number,
    gameNum: number
  ): Promise<HandHistory | undefined> {
    logger.debug(clubId);
    const handHistoryRepository = getRepository(HandHistory);
    const hands = await handHistoryRepository.find({
      where: {clubId: clubId, gameNum: gameNum},
      order: {handNum: 'DESC'},
    });
    return hands[0];
  }

  public async getAllHandHistory(
    clubId: number,
    gameNum: number,
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
    clubId: number,
    gameNum: number,
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
    clubId: number,
    gameNum: number,
    handNum: number,
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
