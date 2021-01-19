import * as _ from 'lodash';
import {HandHistory, HandWinners, StarredHands} from '@src/entity/hand';
import {GameType, WonAtStatus} from '@src/entity/types';
import {getRepository, LessThan, MoreThan, getManager} from 'typeorm';
import {PageOptions} from '@src/types';
import {PokerGame, PokerGameUpdates} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {Cache} from '@src/cache';
import {RewardRepository} from './reward';
import {GameReward, GameRewardTracking} from '@src/entity/reward';
import {SaveHandResult} from './types';

const logger = getLogger('hand');

const MAX_STARRED_HAND = 25;

class HandRepositoryImpl {
  private getSummary(result: any): any {
    // returns hand summary information
    const summary: any = {};
    summary.boardCards = new Array<any>();
    if (result.boardCards) {
      summary.boardCards.push(result.boardCards);
    }
    if (result.boardCards2 && result.boardCards2.length > 0) {
      summary.boardCards.push(result.boardCards2);
    }
    let noCards = 2;
    for (const seatNo of Object.keys(result.players)) {
      const player = result.players[seatNo];
      noCards = player.cards.length;
      break;
    }
    summary.noCards = noCards;
    const isShowDown = result.wonAt === 'SHOW_DOWN';
    const log = result.handLog;
    const hiWinners = {};
    const lowWinners = {};
    for (const potNo of Object.keys(log.potWinners)) {
      const pot = log.potWinners[potNo];
      for (const winner of pot.hiWinners) {
        const seatNo = winner.seatNo;
        const player = result.players[seatNo];
        if (!hiWinners[player.id]) {
          hiWinners[player.id] = {};
          hiWinners[player.id].playerId = player.id;
          hiWinners[player.id].amount = 0;
          hiWinners[player.id].cards = player.cards;
          if (isShowDown) {
            hiWinners[player.id] = JSON.stringify(player.playerCards);
            hiWinners[player.id].rankStr = winner.rankStr;
          }
        }
        hiWinners[player.id].amount += winner.amount;
      }
      for (const winner of pot.lowWinners) {
        const seatNo = winner.seatNo;
        const player = result.players[seatNo];
        if (!lowWinners[player.id]) {
          lowWinners[player.id] = {};
          lowWinners[player.id].playerId = player.id;
          lowWinners[player.id].amount = 0;
          lowWinners[player.id].cards = player.cards;
          if (isShowDown) {
            lowWinners[player.id] = JSON.stringify(player.playerCards);
          }
        }
        lowWinners[player.id].amount += winner.amount;
      }
    }
    summary.flop = result.flop;
    summary.turn = result.turn;
    summary.river = result.river;
    summary.hiWinners = Object.values(hiWinners);
    summary.lowWinners = Object.values(lowWinners);
    if (summary.lowWinners && summary.lowWinners.length === 0) {
      delete summary.lowWinners;
    }
    return summary;
  }

  public async saveHandNew(
    gameID: number,
    handNum: number,
    result: any
  ): Promise<SaveHandResult> {
    let game: PokerGame;
    let gameCode = '';
    try {
      const gameFromCache = await Cache.getGameById(gameID);
      if (!gameFromCache) {
        throw new Error(`Game ${gameID} is not found`);
      }
      gameCode = gameFromCache.gameCode;
      game = gameFromCache;
      const playersInHand = result.players;

      /**
       * Assigning hand history values
       */
      const handHistory = new HandHistory();
      const handLog = result.handLog;
      const wonAt: string = handLog.wonAt;
      const potWinners = handLog.potWinners[0];

      handHistory.gameId = gameID;
      handHistory.handNum = handNum;
      handHistory.gameType = GameType[result.gameType as keyof typeof GameType];
      handHistory.wonAt = WonAtStatus[wonAt];
      // get it from main pot
      handHistory.totalPot = potWinners.hiWinners[0].amount;
      if (wonAt === 'SHOW_DOWN') {
        handHistory.showDown = true;
        handHistory.winningCards = JSON.stringify(
          potWinners.hiWinners[0].winningCards
        );
        handHistory.winningRank = potWinners.hiWinners[0].rank;
        if (potWinners.loWinners) {
          handHistory.loWinningCards = JSON.stringify(
            potWinners.loWinners[0].winningCards
          );
          handHistory.loWinningRank = potWinners.loWinners[0].rank;
        }
      } else {
        handHistory.showDown = false;
      }
      handHistory.timeStarted = handLog.handStartedAt;
      handHistory.timeEnded = handLog.handEndedAt;
      handHistory.data = JSON.stringify(result);
      handHistory.summary = JSON.stringify(this.getSummary(result));

      if (typeof handLog.handStartedAt === 'string') {
        handLog.handStartedAt = parseInt(handLog.handStartedAt);
      }

      if (typeof handLog.handEndedAt === 'string') {
        handLog.handEndedAt = parseInt(handLog.handEndedAt);
      }

      handHistory.timeStarted = new Date(handLog.handStartedAt * 1000);
      handHistory.timeEnded = new Date(handLog.handEndedAt * 1000);
      const winners = {};
      /**
       * Assigning hand winners values
       */
      const allHandWinners = new Array<HandWinners>();
      for await (const hiWinner of potWinners.hiWinners) {
        const handWinners = new HandWinners();
        handWinners.gameId = gameID;
        handWinners.handNum = handNum;
        if (wonAt === 'SHOW_DOWN') {
          handWinners.winningCards = JSON.stringify(hiWinner.winningCards);
          handWinners.winningRank = hiWinner.rank; // undefined
        }
        handWinners.playerId = parseInt(playersInHand[hiWinner.seatNo].id);
        handWinners.received = hiWinner.amount;
        allHandWinners.push(handWinners);
        winners[handWinners.playerId] = true;
      }
      if (potWinners.loWinners) {
        for await (const loWinner of potWinners.loWinners) {
          const handWinners = new HandWinners();
          handWinners.gameId = gameID;
          handWinners.handNum = handNum;
          if (wonAt === 'SHOW_DOWN') {
            handWinners.winningCards = JSON.stringify(loWinner.winningCards);
            handWinners.winningRank = loWinner.rank; // undefined
          }
          handWinners.playerId = parseInt(playersInHand[loWinner.seatNo].id);
          handWinners.received = loWinner.amount;
          handWinners.isHigh = false;
          winners[handWinners.playerId] = true;
          allHandWinners.push(handWinners);
        }
      }

      const sessionTime =
        new Date(handLog.handEndedAt).getTime() -
        new Date(handLog.handStartedAt).getTime();

      // we want to track player stats until what stage he played
      const playerRound = {};
      for (const seatNo of Object.keys(result.players)) {
        const player = result.players[seatNo];
        const playerId = player.id;
        playerRound[playerId] = {
          preflop: 0,
          flop: 0,
          turn: 0,
          river: 0,
          showdown: 0,
        };
        switch (player.playedUntil) {
          case 'PREFLOP':
            playerRound[playerId].preflop = 1;
            break;
          case 'FLOP':
            playerRound[playerId].flop = 1;
            break;
          case 'TURN':
            //playerRound[playerId].flop = 1;
            playerRound[playerId].turn = 1;
            break;
          case 'RIVER':
            //playerRound[playerId].flop = 1;
            //playerRound[playerId].turn = 1;
            playerRound[playerId].river = 1;
            break;
          case 'SHOW_DOWN':
            //playerRound[playerId].flop = 1;
            //playerRound[playerId].turn = 1;
            //playerRound[playerId].river = 1;
            playerRound[playerId].showdown = 1;
            break;
        }
      }

      // get the total rake collected from the hand and track each player paid the rake
      let handRake = 0.0;
      if (result.rakeCollected) {
        handRake = result.rakeCollected;
        handHistory.rake = handRake;
      }

      // extract player before/after balance
      const playerBalance = {};
      for (const playerID of Object.keys(result.players)) {
        playerBalance[playerID] = result.players[playerID].balance;
      }
      handHistory.playersStack = JSON.stringify(playerBalance);
      logger.info('****** STARTING TRANSACTION TO SAVE a hand result');
      const saveResult = await getManager().transaction(
        async transactionEntityManager => {
          /**
           * Assigning player chips values
           */
          for await (const seatNo of Object.keys(result.players)) {
            const player = result.players[seatNo];
            const playerId = parseInt(player.id);
            const round = playerRound[playerId];
            let wonHand = 0;
            if (winners[playerId]) {
              wonHand = 1;
            }
            let rakePaidByPlayer = 0.0;
            if (player.rakePaid) {
              rakePaidByPlayer = player.rakePaid;
            }
            await transactionEntityManager
              .getRepository(PlayerGameTracker)
              .createQueryBuilder()
              .update()
              .set({
                stack: player.balance.after,
                sessionTime: () => `session_time + ${sessionTime}`,
                noHandsWon: () => `no_hands_won + ${wonHand}`,
                seenFlop: () => `seen_flop + ${round.flop}`,
                seenTurn: () => `seen_turn + ${round.turn}`,
                seenRiver: () => `seen_river + ${round.river}`,
                inShowDown: () => `in_showdown + ${round.showdown}`,
                noHandsPlayed: () => 'no_hands_played + 1',
                rakePaid: () => `rake_paid + ${rakePaidByPlayer}`,
              })
              .where({
                game: {id: gameID},
                player: {id: playerId},
              })
              .execute();
          }
          await transactionEntityManager
            .getRepository(HandHistory)
            .save(handHistory);
          // update game rake and last hand number
          await transactionEntityManager
            .getRepository(PokerGameUpdates)
            .createQueryBuilder()
            .update()
            .set({
              rake: () => `rake + ${handRake}`,
              lastHandNum: handNum,
            })
            .where({
              gameID: gameID,
            })
            .execute();
          const saveResult: SaveHandResult = {
            gameCode: game.gameCode,
            handNum: result.handNum,
            success: true,
          };
          const highhandWinners = await RewardRepository.handleHighHand(
            game.gameCode,
            result,
            handHistory.timeEnded,
            transactionEntityManager
          );

          if (
            highhandWinners !== null &&
            highhandWinners.rewardTrackingId !== 0
          ) {
            // new high hand winners
            // get the game codes associated with the reward tracking id
            const games = await getRepository(GameReward).find({
              rewardTrackingId: {id: highhandWinners.rewardTrackingId},
            });
            const gameCodes = games.map(e => e.gameId.gameCode);
            saveResult.highHand = {
              gameCode: game.gameCode,
              handNum: handNum,
              rewardTrackingId: highhandWinners.rewardTrackingId,
              associatedGames: gameCodes,
              winners: highhandWinners.winners,
            };
          }
          return saveResult;
        }
      );
      logger.info(`Result: ${JSON.stringify(saveResult)}`);
      logger.info('****** ENDING TRANSACTION TO SAVE a hand result');
      return saveResult;
    } catch (err) {
      logger.error(`Error when trying to save hand log: ${err.toString()}`);
      return {
        gameCode: gameCode,
        handNum: handNum,
        success: false,
        error: err.message,
      };
    }
  }

  public async getSpecificHandHistory(
    gameId: number,
    handNum: number
  ): Promise<HandHistory | undefined> {
    const handHistoryRepository = getRepository(HandHistory);
    const handHistory = await handHistoryRepository.findOne({
      where: {gameId: gameId, handNum: handNum},
    });
    return handHistory;
  }

  public async getLastHandHistory(
    gameId: number
  ): Promise<HandHistory | undefined> {
    const handHistoryRepository = getRepository(HandHistory);
    const hands = await handHistoryRepository.find({
      where: {gameId: gameId},
      order: {handNum: 'DESC'},
    });
    return hands[0];
  }

  public async getAllHandHistory(
    gameId: number,
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
    let take: number | undefined = pageOptions.count;
    if (!take || take > 10) {
      take = 10;
    }
    take = undefined;
    const findOptions: any = {
      where: {
        gameId: gameId,
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
    gameId: number,
    playerId: number,
    pageOptions?: PageOptions
  ): Promise<Array<HandHistory>> {
    const allHands = await this.getAllHandHistory(gameId);
    const playerIdMatch = `"playerId":"${playerId}"`;
    const myHands = _.filter(allHands, e => e.summary.includes(playerIdMatch));
    return myHands;
  }

  public async saveStarredHand(
    gameId: number,
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
      starredHand.gameId = gameId;
      starredHand.handNum = handNum;
      starredHand.playerId = playerId;
      starredHand.handHistory = handHistory;
      await getManager().transaction(async transactionEntityManager => {
        await transactionEntityManager
          .getRepository(StarredHands)
          .save(starredHand);
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
