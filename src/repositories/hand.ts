import * as _ from 'lodash';
import * as zlib from 'zlib';
import {SavedHands} from '@src/entity/player/player';
import {HandHistory} from '@src/entity/history/hand';
import {
  ChipUnit,
  ClubMessageType,
  GameType,
  HandDataType,
  PlayerStatus,
  WonAtStatus,
} from '@src/entity/types';
import {LessThan, MoreThan, getManager, EntityManager} from 'typeorm';
import {PageOptions} from '@src/types';
import {PokerGame} from '@src/entity/game/game';
import {errToStr, getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {Cache} from '@src/cache';
import {RewardRepository} from './reward';
import {SaveHandResult} from './types';
import {Player} from '@src/entity/player/player';
import {Club} from '@src/entity/player/club';
import {StatsRepository} from './stats';
import {ClubMessageInput} from '@src/entity/player/clubmessage';
import {
  getGameManager,
  getGameRepository,
  getHistoryConnection,
  getHistoryRepository,
  getUserManager,
  getUserRepository,
} from '.';
import {GameReward} from '@src/entity/game/reward';
import {HistoryRepository} from './history';
import * as lz from 'lzutf8';
import {getAppSettings} from '@src/firebase';
import {GameUpdatesRepository} from './gameupdates';
import {GameHistory} from '@src/entity/history/game';
import {GameNotFoundError} from '@src/errors';
import Axios from 'axios';
import {floorToNearest} from '@src/utils';
const logger = getLogger('repositories::hand');

const MAX_STARRED_HAND = 25;
let totalHandsSaved = 0;
let totalHandsDataLen = 0;
let totalHandsCompressedDataLen = 0;
const HIGH_RANK = 166;

class HandRepositoryImpl {
  public async getSpecificHandHistory(
    gameId: number,
    handNum: number
  ): Promise<HandHistory | undefined> {
    const allHands = await this.getAllHandHistory(gameId);
    const hands = _.filter(allHands, {handNum: handNum});
    if (!hands || hands.length == 0) {
      return undefined;
    }
    return hands[0];
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

  public async getAllHandHistory1(
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

  public async getAllHandHistory(
    gameId: number,
    pageOptions?: PageOptions
  ): Promise<Array<HandHistory>> {
    const gameHistory = getHistoryRepository(GameHistory);
    const game = await gameHistory.findOne({gameId: gameId});
    if (!game) {
      throw new GameNotFoundError(gameId.toString());
    }

    if (!game.handDataLink) {
      const handHistoryRepository = getHistoryRepository(HandHistory);
      const handHistory = await handHistoryRepository.find({
        gameId: gameId,
      });
      return handHistory;
    } else {
      // hand is uploaded to S3
      // download the link
      let handLink = game.handDataLink;
      // handLink =
      //   'https://hands-pokerclub.nyc3.digitaloceanspaces.com/game/cgtypkmp/hand.dat';
      const resp = await Axios.request({
        responseType: 'arraybuffer',
        url: handLink,
        method: 'get',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });
      //Axios.get(game.handDataLink);
      let handData: any = {};
      if (game.handsDataCompressed) {
        const data = Buffer.from(resp.data);
        const json = zlib.inflateSync(data).toString();
        handData = JSON.parse(json);
      } else {
        handData = JSON.parse(resp.data);
      }
      let hands = _.values(handData);
      hands = _.sortBy(hands, function (hand) {
        return hand.handNum * -1;
      });

      const handList = hands.map(e => {
        const history = new HandHistory();
        history.handNum = e.handNum;
        history.data = e.data;
        history.timeStarted = new Date(Date.parse(e.timeStarted));
        history.timeEnded = new Date(Date.parse(e.timeEnded));
        history.playersStack = e.playersStack;
        history.rake = e.tips;
        history.showDown = e.showDown;
        history.wonAt = e.wonAt;
        history.totalPot = e.totalPot;
        history.summary = e.summary;
        return history;
      });
      return handList;
    }
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
    const myHands = _.filter(allHands, e => {
      const summary = JSON.stringify(e.summary);
      return summary.includes(playerIdMatch);
    });
    return myHands;
  }

  public async bookmarkHand(
    gameCode: string,
    gameType: GameType,
    player: Player,
    handHistory: HandHistory
  ): Promise<number> {
    try {
      const savedHandsRepository = getUserRepository(SavedHands);

      let bookmarkedHand = await savedHandsRepository.findOne({
        gameCode: gameCode,
        handNum: handHistory.handNum,
        savedBy: {id: player.id},
      });

      if (!bookmarkedHand) {
        bookmarkedHand = new SavedHands();
        bookmarkedHand.gameCode = gameCode;
        bookmarkedHand.gameType = gameType;
        bookmarkedHand.handNum = handHistory.handNum;
        bookmarkedHand.savedBy = player;
        bookmarkedHand.data = this.getHandData(handHistory);
      }

      const resp = await savedHandsRepository.save(bookmarkedHand);
      return resp.id;
    } catch (error) {
      logger.error(
        `Error when trying to save bookmarked hand: ${errToStr(error)}`
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
      }
    } catch (error) {
      logger.error(
        `Error when trying to deleting bookmarked hand: ${errToStr(error)}`
      );
      throw error;
    }
  }

  public getHandData(handHistory: HandHistory): string {
    let data: string = '{}';
    if (handHistory.compressed) {
      if (handHistory.dataType === HandDataType.COMPRESSED_JSON_BASE64) {
        const buf = Buffer.from(handHistory.dataBinary.toString(), 'base64');
        data = lz.decompress(buf);
      } else if (handHistory.dataType === HandDataType.COMPRESSED_JSON) {
        data = lz.decompress(handHistory.dataBinary);
      } else {
        data = handHistory.data.toString();
      }
    } else {
      data = JSON.stringify(handHistory.data);
    }
    return data;
  }

  public async shareHand(
    gameCode: string,
    gameType: GameType,
    player: Player,
    club: Club,
    handHistory: HandHistory
  ): Promise<number> {
    try {
      const id = await getUserManager().transaction(
        async transactionEntityManager => {
          const savedHandsRepository =
            transactionEntityManager.getRepository(SavedHands);

          let sharedHand = await savedHandsRepository.findOne({
            gameCode: gameCode,
            handNum: handHistory.handNum,
            savedBy: {id: player.id},
            sharedTo: {id: club.id},
          });

          if (!sharedHand) {
            sharedHand = new SavedHands();
            sharedHand.gameCode = gameCode;
            sharedHand.gameType = gameType;
            sharedHand.handNum = handHistory.handNum;
            sharedHand.sharedBy = player;
            sharedHand.sharedTo = club;
            sharedHand.data = this.getHandData(handHistory);
          }

          const resp = await savedHandsRepository.save(sharedHand);
          const clubMsgRepo =
            transactionEntityManager.getRepository(ClubMessageInput);
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
      logger.error(`Error when trying to share hands: ${errToStr(error)}`);
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
      logger.error(`Error when trying to get shared hand: ${errToStr(error)}`);
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
      logger.error(`Error when trying to get shared hands: ${errToStr(error)}`);
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
        `Error when trying to get bookmarked hands: ${errToStr(error)}`
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
        `Error when trying to get bookmarked hands: ${errToStr(error)}`
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

    // try to decompress
    let data = '{}';
    try {
      if (hand.compressed) {
        data = lz.decompress(hand.data);
      }
    } catch (err) {
      return null;
    }

    return JSON.parse(data);
  }

  public async cleanUpOldData(): Promise<number | null | undefined> {
    const envDays = parseInt(process.env.HAND_HISTORY_RETENTION_DAYS || '');
    const daysToKeep = Number.isInteger(envDays) ? envDays : 30;

    logger.info(
      `Starting hand history retention. Keeping ${daysToKeep} days records`
    );

    const start = Date.now();
    const result = await getHistoryConnection()
      .createQueryBuilder()
      .delete()
      .from(HandHistory)
      .where(
        `
        (retention_days IS NULL AND time_ended < NOW() - INTERVAL '${daysToKeep} days')
        OR
        (time_ended < NOW() - INTERVAL '1 day' * retention_days)
        `
      )
      .execute();

    const end = Date.now();

    logger.info(
      `Finished hand history retention. Deleted ${result.affected} rows in ${
        end - start
      } ms`
    );

    return result.affected;
  }

  public async saveHand(
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
      const gameUpdates = await GameUpdatesRepository.get(
        gameFromCache.gameCode,
        true
      );
      if (!gameUpdates) {
        throw new Error(`Game ${gameID} is not found`);
      }

      game = gameFromCache;
      const playersInHand = result.result.playerInfo;
      let gameType = GameType[result.gameType as keyof typeof GameType];
      if (handNum === 1) {
        if (game.clubId) {
          try {
            let statGameType = GameType.UNKNOWN;
            switch (gameType) {
              case GameType.HOLDEM:
                statGameType = GameType.HOLDEM;
                break;
              case GameType.PLO:
              case GameType.PLO_HILO:
                statGameType = GameType.PLO;
                break;
              case GameType.FIVE_CARD_PLO:
              case GameType.FIVE_CARD_PLO_HILO:
                statGameType = GameType.FIVE_CARD_PLO;
                break;
              case GameType.SIX_CARD_PLO:
              case GameType.SIX_CARD_PLO_HILO:
                statGameType = GameType.SIX_CARD_PLO;
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
      const handResult = result.result;
      const mainPotWinners = handResult.potWinners[0];

      handHistory.gameId = gameID;
      handHistory.handNum = handNum;
      handHistory.gameType = gameType;
      handHistory.wonAt = WonAtStatus[wonAt];
      // get it from main pot
      handHistory.totalPot = mainPotWinners.amount;
      if (wonAt === 'SHOW_DOWN') {
        handHistory.showDown = true;
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

      // get all the winners of the hand
      for (const pot of handResult.potWinners) {
        for (const boardWinners of pot.boardWinners) {
          for (const seatNo of Object.keys(boardWinners.hiWinners)) {
            const hiWinner = boardWinners.hiWinners[seatNo];
            const playerId = parseInt(playersInHand[hiWinner.seatNo].id);
            winners[playerId] = true;
          }
          if (boardWinners.lowWinners) {
            for (const seatNo of Object.keys(boardWinners.lowWinners)) {
              const lowWinner = boardWinners.lowWinners[seatNo];
              const playerId = parseInt(playersInHand[lowWinner.seatNo].id);
              winners[playerId] = true;
            }
          }
        }
      }

      // store the player name
      for (const seatNo of Object.keys(playersInHand)) {
        const player = playersInHand[seatNo];
        const playerId = player.id;
        const cachedPlayer = await Cache.getPlayerById(player.id);
        player.name = cachedPlayer.name;
      }

      // we want to track player stats until what stage he played
      const playerRound = {};
      for (const seatNo of Object.keys(playersInHand)) {
        const player = playersInHand[seatNo];
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
      if (handResult.tipsCollected) {
        handRake = handResult.tipsCollected;
        handHistory.rake = handRake;
      }

      // extract player before/after balance
      const playerBalance = {};
      const playerIdsInHand = new Array<number>();
      for (const seatNo of Object.keys(playersInHand)) {
        const player = playersInHand[seatNo];
        const balance: any = {};

        // reduce json key
        // b: before, a: after
        balance['b'] = player.balance.before;
        balance['a'] = player.balance.after;
        playerBalance[player.id] = balance;

        playerIdsInHand.push(player.id);
      }

      // extract player stats and store it in a column
      const playerStats = {
        playerStats: result.result.playerStats,
        playerRound: playerRound,
      };

      handHistory.playersStats = JSON.stringify(playerStats);
      // await StatsRepository.saveHandStats(game, playerStats, handNum);

      result.result.playerStats = undefined;
      result.result.timeoutStats = undefined;
      result.playerRound = undefined;

      result.gameCode = game.gameCode;
      handHistory.playersStack = JSON.stringify(playerBalance);
      const data = JSON.stringify(result);
      const appSettings = getAppSettings();
      totalHandsSaved++;
      let compressedDataLen = 0;
      let dataLen = data.length;
      totalHandsDataLen += dataLen;
      if (appSettings.compressHandData) {
        const compressedData = lz.compress(data);
        handHistory.dataType = HandDataType.COMPRESSED_JSON_BASE64;
        const compressedDataBuffer = Buffer.from(compressedData);
        const base64Data = compressedDataBuffer.toString('base64');
        handHistory.dataBinary = Buffer.from(base64Data);
        handHistory.compressed = true;
        compressedDataLen = handHistory.dataBinary.length;
        totalHandsCompressedDataLen += compressedDataLen;

        if (totalHandsSaved !== 0 && totalHandsSaved % 100 === 0) {
          const savings =
            ((totalHandsDataLen - totalHandsCompressedDataLen) /
              totalHandsDataLen) *
            100.0;
          logger.info(
            `Total hands: ${totalHandsSaved} data len: ${totalHandsDataLen} compressed data len: ${totalHandsCompressedDataLen} savings: ${savings}`
          );
        }
      } else {
        handHistory.dataType = HandDataType.JSON;
        handHistory.data = Buffer.from(data);
        handHistory.compressed = false;
      }
      const [summary, playerHiRank] = await this.getSummary2(
        result.noCards,
        playersInHand,
        handResult
      );
      if (playerHiRank) {
        handHistory.highRank = JSON.stringify(playerHiRank);
      }
      handHistory.summary = JSON.stringify(summary);
      handHistory.players = JSON.stringify(playerIdsInHand);

      let saveResult: any = {};
      saveResult = await getGameManager().transaction(
        async transactionEntityManager => {
          if (gameUpdates.lastResultProcessedHand >= handNum) {
            // This is a rare condition that could be hit when game server crashes and
            // this function gets called more than once for the same hand.
            // We are just guarding against incrementing some stats multiple times when
            // that happens.
            logger.warn(
              `Hand result was already processed for game ${gameID} hand ${gameUpdates.lastResultProcessedHand}. Skipping the processing for hand ${handNum}`
            );
            const saveResult: SaveHandResult = {
              gameCode: gameUpdates.gameCode,
              handNum: handNum,
              success: true,
              skipped: true,
            };
            return saveResult;
          }

          let playerRakes = {};
          for (const seatNo of Object.keys(playersInHand)) {
            playerRakes[seatNo] = 0;
          }

          if (handRake > 0) {
            let sumPotContributions: number = 0;
            for (const seatNo of Object.keys(playersInHand)) {
              const player = playersInHand[seatNo];
              if (player.potContribution) {
                sumPotContributions += player.potContribution;
              }
            }
            let rakeAccountedFor: number = 0;
            for (const seatNo of Object.keys(playersInHand)) {
              const player = playersInHand[seatNo];
              let rakePaidByPlayer = 0.0;
              if (typeof player.potContribution === 'number') {
                const playerRakeRaw =
                  handRake * (player.potContribution / sumPotContributions);
                if (game.chipUnit === ChipUnit.CENT) {
                  rakePaidByPlayer = floorToNearest(playerRakeRaw, 1);
                } else {
                  rakePaidByPlayer = floorToNearest(playerRakeRaw, 100);
                }
                playerRakes[seatNo] = rakePaidByPlayer;
                rakeAccountedFor += rakePaidByPlayer;
              }
            }

            if (rakeAccountedFor < handRake) {
              for (const seatNo of Object.keys(playersInHand)) {
                if (game.chipUnit === ChipUnit.CENT) {
                  playerRakes[seatNo] += 1;
                  rakeAccountedFor = rakeAccountedFor + 1;
                } else {
                  playerRakes[seatNo] += 100;
                  rakeAccountedFor += 100;
                }
                if (rakeAccountedFor >= handRake) {
                  break;
                }
              }
            }
          }

          /**
           * Assigning player chips values
           */
          for await (const seatNo of Object.keys(playersInHand)) {
            const player = playersInHand[seatNo];
            const playerId = parseInt(player.id);
            const round = playerRound[playerId];
            let wonHand = 0;
            if (winners[playerId]) {
              wonHand = 1;
            }
            const rakePaidByPlayer = playerRakes[seatNo];
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
          // update game rake and last hand number
          await GameUpdatesRepository.updateHandResult(
            game,
            handNum,
            handRake,
            transactionEntityManager
          );

          // goes to different database (history)
          await getHistoryRepository(HandHistory).save(handHistory);
          const saveResult: SaveHandResult = {
            gameCode: game.gameCode,
            handNum: result.handNum,
            success: true,
            skipped: false,
          };
          await this.handleHighHand(
            game,
            result,
            handHistory.timeEnded,
            saveResult,
            transactionEntityManager
          );
          await this.handleHighRanks(
            game,
            result,
            handHistory.timeEnded,
            saveResult,
            transactionEntityManager
          );
          // TODO: save hand stats will be handled differently
          // await StatsRepository.saveHandStats(game, result, handNum);
          return saveResult;
        }
      );

      if (saveResult.skipped) {
        return saveResult;
      }

      // we need to refresh to reflect last processed hand
      await GameUpdatesRepository.get(game.gameCode, true);

      let pendingUpdates = false;
      // handle stack reload functionality
      const reloadPlayers = await Cache.getAutoReloadPlayers(game.id);
      if (reloadPlayers && reloadPlayers.length > 0) {
        // check to see any reload players stack went down to threshold
        const reloadPlayersMap = _.keyBy(reloadPlayers, 'playerId');
        for (const seatNo of Object.keys(playersInHand)) {
          const player = playersInHand[seatNo];
          const playerId = parseInt(player.id);
          if (reloadPlayersMap[playerId]) {
            if (
              player.balance.after < reloadPlayersMap[playerId].lowThreshold
            ) {
              pendingUpdates = true;
              break;
            }
          }
        }
      }

      if (pendingUpdates) {
        await Cache.updateGamePendingUpdates(game.gameCode, true);
      }

      if (!pendingUpdates) {
        for (const seatNo of Object.keys(playersInHand)) {
          const player = playersInHand[seatNo];
          if (player.balance.after <= game.ante) {
            await Cache.updateGamePendingUpdates(game.gameCode, true);
            pendingUpdates = true;
            break;
          }
        }
      }

      // try {
      //   if (game.appCoinsNeeded) {
      //     const continueGame = await AppCoinRepository.canGameContinue(
      //       game.gameCode
      //     );
      //     if (!continueGame) {
      //       // end the game in the update
      //       logger.info(
      //         `[${game.gameCode}] will end due to insufficient coins`
      //       );

      //       // set pending updates true
      //       await Cache.updateGamePendingUpdates(game.gameCode, true);
      //       const player = await Cache.getPlayer(game.hostUuid);
      //       await NextHandUpdatesRepository.endGameNextHand(player, game.id);
      //       pendingUpdates = true;
      //     }
      //   }
      //   // } catch (err) {}
      // } catch (err) {
      //   logger.error(errToStr(err));
      // }

      if (!pendingUpdates) {
        if (gameUpdates.lastIpGpsCheckTime) {
          const now = new Date();
          const diff = Math.ceil(
            (now.getTime() - gameUpdates.lastIpGpsCheckTime.getTime()) / 1000
          );
          if (diff > getAppSettings().ipGpsCheckInterval) {
            logger.debug(`Game: [${game.gameCode}] time to check IP/GPS`);
            await Cache.updateGamePendingUpdates(game.gameCode, true);
          }
        }
      }
      //logger.info(`Hand ended`);
      return saveResult;
    } catch (err) {
      logger.error(`Error when trying to save hand log: ${errToStr(err)}`);
      return {
        gameCode: gameCode,
        handNum: handNum,
        success: false,
        skipped: false,
        error: errToStr(err),
      };
    }
  }

  private async handleHighRanks(
    game: PokerGame,
    result: any,
    timeEnded: Date,
    saveResult: any,
    transactionEntityManager: EntityManager
  ) {
    await RewardRepository.handleHighRanks(game, result, timeEnded);
  }

  private async handleHighHand(
    game: PokerGame,
    result: any,
    timeEnded: Date,
    saveResult: any,
    transactionEntityManager: EntityManager
  ) {
    const highhandWinners = await RewardRepository.handleHighHand(
      game,
      result,
      timeEnded,
      transactionEntityManager
    );

    if (highhandWinners !== null && highhandWinners.rewardTrackingId !== 0) {
      logger.error(
        `SHOULD NOT BE HERE (highhandWinners !== null && highhandWinners.rewardTrackingId !== 0) game ${game.gameCode} hand ${result.handNum}`
      );
      // new high hand winners
      // get the game codes associated with the reward tracking id
      const games = await transactionEntityManager
        .getRepository(GameReward)
        .find({
          rewardTrackingId: {id: highhandWinners.rewardTrackingId},
        });
      const gameCodes = games.map(e => e.gameCode);
      saveResult.highHand = {
        gameCode: game.gameCode,
        handNum: result.handNum,
        rewardTrackingId: highhandWinners.rewardTrackingId,
        associatedGames: gameCodes,
        winners: highhandWinners.winners,
      };
    }

    // if (highhandWinners !== null) {
    //   Nats.sendHighHandWinners(
    //     game,
    //     result.boardCards,
    //     result.handNum,
    //     highhandWinners.winners
    //   );
    // }
  }

  private async getSummary2(
    noCards: number,
    playersInHand: any,
    handResult: any
  ): Promise<[any, any]> {
    // returns hand summary information
    const summary: any = {};
    let playerHiRank: {[key: number]: number} | undefined = {};

    summary.boardCards = new Array<any>();

    if (handResult.boards) {
      for (const board of handResult.boards) {
        summary.boardCards.push(board.cards);
      }
    }
    summary.noCards = noCards;
    const isShowDown = handResult.wonAt === 'SHOW_DOWN';
    //const log = result.handLog;
    const hiWinners = {};
    const lowWinners = {};
    for (const pot of handResult.potWinners) {
      // we only do main pot here
      for (const board of pot.boardWinners) {
        for (const resultBoard of handResult.boards) {
          for (const playerId of Object.keys(resultBoard.playerRank)) {
            const boardRank = resultBoard.playerRank[playerId].hiRank;
            if (boardRank <= HIGH_RANK) {
              if (playerHiRank[playerId]) {
                if (playerHiRank[playerId] < boardRank) {
                  playerHiRank[playerId] = boardRank;
                }
              } else {
                playerHiRank[playerId] = boardRank;
              }
            }
          }
          break;
        }
        for (const seatNo of Object.keys(playersInHand)) {
          const player = playersInHand[seatNo];
          const hiWinner = board.hiWinners[seatNo];
          const lowWinner = board.lowWinners[seatNo];
          if (hiWinner) {
            if (!hiWinners[player.id]) {
              const cachedPlayer = await Cache.getPlayerById(player.id);
              hiWinners[player.id] = {};
              hiWinners[player.id].playerId = player.id;
              hiWinners[player.id].playerName = cachedPlayer.name;
              hiWinners[player.id].amount = 0;
              hiWinners[player.id].cards = player.cards;
              if (isShowDown) {
                hiWinners[player.id].rankStr = board.hiRankText;
              }
            }
            hiWinners[player.id].amount += hiWinner.amount;
          }
          if (lowWinner) {
            if (!lowWinner[player.id]) {
              const cachedPlayer = await Cache.getPlayerById(player.id);
              lowWinner[player.id] = {};
              lowWinner[player.id].playerId = player.id;
              lowWinner[player.id].playerName = cachedPlayer.name;
              lowWinner[player.id].amount = 0;
              lowWinner[player.id].cards = player.cards;
              if (isShowDown) {
                lowWinner[player.id].rankStr = board.hiRankText;
              }
            }
            lowWinner[player.id].amount += lowWinner.amount;
          }
        }
      }
      break;
    }
    summary.hiWinners = Object.values(hiWinners);
    summary.lowWinners = Object.values(lowWinners);
    if (summary.lowWinners && summary.lowWinners.length === 0) {
      delete summary.lowWinners;
    }
    if (Object.keys(playerHiRank).length === 0) {
      playerHiRank = undefined;
    }
    return [summary, playerHiRank];
  }
}

export const HandRepository = new HandRepositoryImpl();
