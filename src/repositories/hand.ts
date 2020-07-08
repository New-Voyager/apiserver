import {HandHistory, HandWinners, WonAtStatus} from '@src/entity/hand';
import {getRepository, LessThan, MoreThan} from 'typeorm';
import {PageOptions} from '@src/types';
import { GameType } from '@src/entity/game';

class HandRepositoryImpl {
  public async saveHand(handData: any){
    try {
      const handHistoryRepository = getRepository(HandHistory);
      const handWinnersRepository = getRepository(HandWinners);

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
          handHistory.winningCards = handData.Result.winning_cards.join(
            ', '
          );
          handHistory.winningRank = handData.Result.rank_num;
        }
        handHistory.totalPot = handData.Result.total_pot;
      }
      handHistory.timeStarted = handData.StartedAt;
      handHistory.timeEnded = handData.EndedAt;
      handHistory.data = JSON.stringify(handData);
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
              player: string;
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
              player: string;
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
              player: string;
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
          async (winner: {player: string; received: number}) => {
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
      return true;
    } catch (err) {
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

    console.log(`pageOptions count: ${pageOptions.count}`);
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
    playerId: string,
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

    console.log(`pageOptions count: ${pageOptions.count}`);
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
}

export const HandRepository = new HandRepositoryImpl();
