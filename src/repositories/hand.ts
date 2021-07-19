import * as _ from 'lodash';
import {SavedHands} from '@src/entity/player/player';
import {HandHistory} from '@src/entity/history/hand';
import {
  ClubMessageType,
  GameType,
  PlayerStatus,
  WonAtStatus,
} from '@src/entity/types';
import {LessThan, MoreThan, getManager} from 'typeorm';
import {PageOptions} from '@src/types';
import {PokerGame, PokerGameUpdates} from '@src/entity/game/game';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {Cache} from '@src/cache';
import {RewardRepository} from './reward';
import {SaveHandResult} from './types';
import {Player} from '@src/entity/player/player';
import {Club} from '@src/entity/player/club';
import {StatsRepository} from './stats';
import {ClubMessageInput} from '@src/entity/player/clubmessage';
import {Nats} from '@src/nats';
import {
  getGameManager,
  getGameRepository,
  getHistoryRepository,
  getUserManager,
  getUserRepository,
} from '.';
import {GameReward} from '@src/entity/game/reward';
import {HistoryRepository} from './history';

const logger = getLogger('hand');

const MAX_STARRED_HAND = 25;

class HandRepositoryImpl {
  private async getSummary(result: any): Promise<any> {
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
          const cachedPlayer = await Cache.getPlayerById(player.id);
          hiWinners[player.id] = {};
          hiWinners[player.id].playerId = player.id;
          hiWinners[player.id].playerName = cachedPlayer.name;
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
          const cachedPlayer = await Cache.getPlayerById(player.id);
          lowWinners[player.id] = {};
          lowWinners[player.id].playerId = player.id;
          lowWinners[player.id].playerName = cachedPlayer.name;
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

      if (handNum === 1) {
        if (game.clubId) {
          try {
            let gameType: GameType = GameType.UNKNOWN;
            switch (game.gameType) {
              case GameType.HOLDEM:
                gameType = GameType.HOLDEM;
                break;
              case GameType.PLO:
              case GameType.PLO_HILO:
                gameType = GameType.PLO;
                break;
              case GameType.FIVE_CARD_PLO:
              case GameType.FIVE_CARD_PLO_HILO:
                gameType = GameType.FIVE_CARD_PLO;
                break;
            }

            if (gameType !== GameType.UNKNOWN) {
              await StatsRepository.newClubGame(gameType, game.clubId);
            }
          } catch (err) {}
        }
      }

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
      for await (const hiWinner of potWinners.hiWinners) {
        const playerId = parseInt(playersInHand[hiWinner.seatNo].id);
        winners[playerId] = true;
      }
      if (potWinners.loWinners) {
        for await (const loWinner of potWinners.loWinners) {
          const playerId = parseInt(playersInHand[loWinner.seatNo].id);
          winners[playerId] = true;
          winners[playerId] = true;
        }
      }

      // store the player name
      for (const seatNo of Object.keys(result.players)) {
        const player = result.players[seatNo];
        const playerId = player.id;
        const cachedPlayer = await Cache.getPlayerById(player.id);
        player.name = cachedPlayer.name;
      }

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
            playerRound[playerId].turn = 1;
            break;
          case 'RIVER':
            playerRound[playerId].river = 1;
            break;
          case 'SHOW_DOWN':
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
      const playerIdsInHand = new Array<number>();
      for (const seatNo of Object.keys(result.players)) {
        const player = result.players[seatNo];
        const balance: any = {};

        // reduce json key
        // b: before, a: after
        balance['b'] = player.balance.before;
        balance['a'] = player.balance.after;
        playerBalance[player.id] = balance;

        playerIdsInHand.push(player.id);
      }
      result.gameCode = game.gameCode;
      const playerStats = result.playerStats;
      // don't store player stats
      delete result.playerStats;
      handHistory.playersStack = JSON.stringify(playerBalance);
      handHistory.data = JSON.stringify(result);
      const summary = await this.getSummary(result);
      handHistory.summary = JSON.stringify(summary);
      handHistory.players = JSON.stringify(playerIdsInHand);

      result.playerStats = playerStats;
      result.playerRound = playerRound;

      //logger.info('****** STARTING TRANSACTION TO SAVE a hand result');
      const saveResult = await getGameManager().transaction(
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
                noHandsWon: () => `no_hands_won + ${wonHand}`,
                noHandsPlayed: () => 'no_hands_played + 1',
                rakePaid: () => `rake_paid + ${rakePaidByPlayer}`,
              })
              .where({
                game: {id: gameID},
                playerId: playerId,
              })
              .execute();
          }
          await getHistoryRepository(HandHistory).save(handHistory);
          // update game rake and last hand number
          await transactionEntityManager
            .getRepository(PokerGameUpdates)
            .createQueryBuilder()
            .update()
            .set({
              rake: () => `rake + ${handRake}`,
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
            game,
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
            const games = await getGameRepository(GameReward).find({
              rewardTrackingId: {id: highhandWinners.rewardTrackingId},
            });
            const gameCodes = games.map(e => e.gameCode);
            saveResult.highHand = {
              gameCode: game.gameCode,
              handNum: handNum,
              rewardTrackingId: highhandWinners.rewardTrackingId,
              associatedGames: gameCodes,
              winners: highhandWinners.winners,
            };
          }

          if (highhandWinners !== null) {
            Nats.sendHighHandWinners(
              game,
              result.boardCards,
              handNum,
              highhandWinners.winners
            );
          }

          await StatsRepository.saveHandStats(
            game,
            result,
            handNum
            //transactionEntityManager
          );
          return saveResult;
        }
      );

      for (const seatNo of Object.keys(result.players)) {
        const player = result.players[seatNo];
        if (player.balance.after == 0) {
          logger.info(
            `Game [${game.gameCode}]: A player balance stack went to 0`
          );
          await Cache.updateGamePendingUpdates(game.gameCode, true);
          break;
        }
      }

      //logger.info(`Result: ${JSON.stringify(saveResult)}`);
      //logger.info('****** ENDING TRANSACTION TO SAVE a hand result');
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
    const handHistoryRepository = getHistoryRepository(HandHistory);
    const handHistory = await handHistoryRepository.findOne({
      where: {gameId: gameId, handNum: handNum},
    });
    return handHistory;
  }

  public async getLastHandHistory(
    gameId: number
  ): Promise<HandHistory | undefined> {
    const handHistoryRepository = getHistoryRepository(HandHistory);
    const hands = await handHistoryRepository.find({
      where: {gameId: gameId},
      order: {handNum: 'DESC'},
      take: 1,
    });
    if (hands.length === 0) {
      return undefined;
    }
    return hands[0];
  }

  public async getAllHandHistory(
    gameId: number,
    pageOptions?: PageOptions
  ): Promise<Array<HandHistory>> {
    if (!pageOptions) {
      pageOptions = {
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

    //logger.info(`pageOptions count: ${pageOptions.count}`);

    const findOptions: any = {
      where: {
        gameId: gameId,
      },
      order: order,
    };

    const take = pageOptions.count;
    if (take) {
      findOptions.take = take;
    }

    if (pageWhere) {
      findOptions['where']['id'] = pageWhere;
    }
    const handHistoryRepository = getHistoryRepository(HandHistory);
    /*
      pageId: Int
      handNum: Int!
      noWinners: Int!
      noLoWinners: Int
      gameType: GameType!
      wonAt: WonAtStatus!
      showDown: Boolean!
      playerCards: [Int],
      winningCards: String
      winningRank: Int
      loWinningCards: String
      loWinningRank: Int
      timeStarted: DateTime!
      timeEnded: DateTime!
      handTime: Int
      winners: Json
      totalPot: Float!
      playersInHand: [Int!]
      data: Json
      summary: String
    */
    findOptions['select'] = [
      'id',
      'handNum',
      'gameType',
      'wonAt',
      'showDown',
      'winningCards',
      'loWinningCards',
      'loWinningRank',
      'winningRank',
      'timeStarted',
      'timeEnded',
      'totalPot',
      'players',
      'summary',
    ];
    //findOptions
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

    /*
    // summary
        {
          "boardCards": [
            [33, 66, 17, 168, 146]
          ],
          "noCards": 2,
          "flop": [33, 66, 17],
          "turn": 168,
          "river": 146,
          "hiWinners": [{
            "playerId": "303",
            "playerName": "yong",
            "amount": 7,
            "cards": [34, 104]
          }]
        }
    */
    const myHands = _.filter(allHands, e => e.summary.includes(playerIdMatch));
    return myHands;
  }

  public async bookmarkHand(
    game: PokerGame,
    player: Player,
    handHistory: HandHistory
  ): Promise<number> {
    try {
      const savedHandsRepository = getUserRepository(SavedHands);

      let bookmarkedHand = await savedHandsRepository.findOne({
        gameCode: game.gameCode,
        handNum: handHistory.handNum,
        savedBy: {id: player.id},
      });

      if (!bookmarkedHand) {
        bookmarkedHand = new SavedHands();
        bookmarkedHand.gameCode = game.gameCode;
        bookmarkedHand.gameType = game.gameType;
        bookmarkedHand.handNum = handHistory.handNum;
        bookmarkedHand.savedBy = player;
        bookmarkedHand.data = handHistory.data;
      }

      const resp = await savedHandsRepository.save(bookmarkedHand);
      return resp.id;
    } catch (error) {
      logger.error(
        `Error when trying to save bookmarked hand: ${error.toString}`
      );
      throw error;
    }
  }

  public async removeBookmark(
    player: Player,
    bookmarkId: number
  ): Promise<void> {
    try {
      const savedHandsRepository = getUserRepository(SavedHands);

      const bookmarkedHand = await savedHandsRepository.findOne({
        savedBy: {id: player.id},
        id: bookmarkId,
      });

      if (bookmarkedHand) {
        await savedHandsRepository.delete({
          id: bookmarkId,
        });
        logger.info('Bookmark is removed');
      } else {
        logger.info('Bookmark is not found');
      }
    } catch (error) {
      logger.error(
        `Error when trying to deleting bookmarked hand: ${error.toString}`
      );
      throw error;
    }
  }

  public async shareHand(
    game: PokerGame,
    player: Player,
    club: Club,
    handHistory: HandHistory
  ): Promise<number> {
    try {
      const id = await getUserManager().transaction(
        async transactionEntityManager => {
          const savedHandsRepository = transactionEntityManager.getRepository(
            SavedHands
          );

          let sharedHand = await savedHandsRepository.findOne({
            gameCode: game.gameCode,
            handNum: handHistory.handNum,
            savedBy: {id: player.id},
            sharedTo: {id: club.id},
          });

          if (!sharedHand) {
            sharedHand = new SavedHands();
            sharedHand.gameCode = game.gameCode;
            sharedHand.gameType = game.gameType;
            sharedHand.handNum = handHistory.handNum;
            sharedHand.sharedBy = player;
            sharedHand.sharedTo = club;
            sharedHand.data = handHistory.data;
          }

          const resp = await savedHandsRepository.save(sharedHand);
          const clubMsgRepo = transactionEntityManager.getRepository(
            ClubMessageInput
          );
          const message = new ClubMessageInput();
          message.clubCode = club.clubCode;
          message.player = player;
          message.messageType = ClubMessageType.HAND;
          message.sharedHand = resp;
          await clubMsgRepo.save(message);
          return resp.id;
        }
      );
      return id;
    } catch (error) {
      logger.error(`Error when trying to share hands: ${error.toString()}`);
      throw error;
    }
  }

  public async sharedHand(id: number): Promise<any> {
    try {
      const savedHandsRepository = getUserRepository(SavedHands);
      const sharedHand = await savedHandsRepository.findOne({
        relations: ['sharedBy', 'sharedTo'],
        where: {
          id: id,
        },
      });
      return sharedHand;
    } catch (error) {
      logger.error(`Error when trying to get shared hand: ${error.toString}`);
      throw error;
    }
  }

  public async sharedHands(club: Club): Promise<any> {
    try {
      const savedHandsRepository = getUserRepository(SavedHands);

      const sharedHands = await savedHandsRepository.find({
        relations: ['sharedBy', 'sharedTo'],
        where: {
          sharedTo: {id: club.id},
        },
        order: {id: 'DESC'},
      });
      return sharedHands;
    } catch (error) {
      logger.error(`Error when trying to get shared hands: ${error.toString}`);
      throw error;
    }
  }

  public async bookmarkedHands(player: Player): Promise<any> {
    try {
      const savedHandsRepository = getUserRepository(SavedHands);

      const bookmarkedHands = await savedHandsRepository.find({
        relations: ['savedBy'],
        where: {
          savedBy: {id: player.id},
        },
        order: {id: 'DESC'},
      });

      for (const hand of bookmarkedHands) {
        hand.data = JSON.parse(hand.data);
      }
      return bookmarkedHands;
    } catch (error) {
      logger.error(
        `Error when trying to get bookmarked hands: ${error.toString}`
      );
      throw error;
    }
  }

  public async bookmarkedHandsByGame(
    player: Player,
    gameCode: string
  ): Promise<any> {
    try {
      const savedHandsRepository = getUserRepository(SavedHands);

      const bookmarkedHands = await savedHandsRepository.find({
        relations: ['savedBy'],
        where: {
          gameCode: gameCode,
          savedBy: {id: player.id},
        },
        order: {id: 'DESC'},
      });

      for (const hand of bookmarkedHands) {
        hand.data = JSON.parse(hand.data);
      }
      return bookmarkedHands;
    } catch (error) {
      logger.error(
        `Error when trying to get bookmarked hands: ${error.toString}`
      );
      throw error;
    }
  }

  public async getHandLog(gameCode: string, handNum: number): Promise<any> {
    const game = await Cache.getGame(gameCode);
    let gameId: number;
    if (game) {
      gameId = game.id;
    } else {
      const historyGame = await HistoryRepository.getCompletedGameByCode(
        gameCode
      );
      if (!historyGame) {
        throw new Error(`Game with code ${gameCode} is not found`);
      }
      gameId = historyGame.gameId;
    }
    const handHistoryRepo = getHistoryRepository(HandHistory);
    const hand = await handHistoryRepo.findOne({
      gameId: gameId,
      handNum: handNum,
    });
    if (!hand) {
      return null;
    }
    return JSON.parse(hand.data);
  }
}

export const HandRepository = new HandRepositoryImpl();
