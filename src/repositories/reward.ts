import {Club} from '@src/entity/player/club';
import {EntityManager, Not, Repository} from 'typeorm';
import {
  GameStatus,
  GameType,
  RewardType,
  ScheduleType,
} from '@src/entity/types';
import {Reward} from '@src/entity/player/reward';
export interface RewardInputFormat {
  name: string;
  type: RewardType;
  amount: number;
  minRank: number;
  startHour: number;
  endHour: number;
  schedule: ScheduleType;
}
import {errToStr, getLogger} from '@src/utils/log';
import {
  HighHandWinner,
  HighHandWinnerResult,
  MIN_FOUR_OF_A_KIND_RANK,
  MIN_FULLHOUSE_RANK,
  MIN_STRAIGHT_FLUSH_RANK,
} from './types';
import {Cache} from '@src/cache';
import _, {result} from 'lodash';
import {Player} from '@src/entity/player/player';
import {PokerGame} from '@src/entity/game/game';
import {fixQuery, stringCards} from '@src/utils';
import {
  getGameRepository,
  getHistoryConnection,
  getHistoryRepository,
  getUserRepository,
} from '.';
import {
  GameReward,
  GameRewardTracking,
  HighHand,
} from '@src/entity/game/reward';
import {HighHandHistory, HighRank} from '@src/entity/history/hand';
import {Metrics} from '@src/internal/metrics';
import {GameNotFoundError} from '@src/errors';
import {GameHistory} from '@src/entity/history/game';
import {HistoryRepository} from './history';
import {GameUpdatesRepository} from './gameupdates';

const logger = getLogger('repositories::reward');

class RewardRepositoryImpl {
  public async createReward(clubCode: string, reward: RewardInputFormat) {
    try {
      const clubRepository = getUserRepository(Club);
      const club = await clubRepository.findOne({
        where: {clubCode: clubCode},
      });
      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      } else {
        const createReward = new Reward();
        createReward.clubId = club;
        createReward.amount = reward.amount;
        createReward.endHour = reward.endHour;
        createReward.minRank = reward.minRank;
        createReward.schedule =
          ScheduleType[reward.schedule as unknown as keyof typeof ScheduleType];
        createReward.name = reward.name;
        createReward.startHour = reward.startHour;
        createReward.type =
          RewardType[reward.type as unknown as keyof typeof RewardType];
        const repository = getUserRepository(Reward);
        const response = await repository.save(createReward);
        return response.id;
      }
    } catch (e) {
      logger.error(`Creating reward failed. Error: ${JSON.stringify(e)}`);
      throw e;
    }
  }

  public async getRewards(clubCode: string): Promise<Array<any>> {
    try {
      const clubRepository = getUserRepository(Club);
      const club = await clubRepository.findOne({
        where: {clubCode: clubCode},
      });
      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      } else {
        const findOptions: any = {
          where: {
            clubId: club.id,
          },
        };
        const rewardRepository = getUserRepository(Reward);
        const rewards = await rewardRepository.find(findOptions);
        return rewards;
      }
    } catch (e) {
      logger.error(
        `Gettings rewards for club ${clubCode} failed. Error: ${JSON.stringify(
          e
        )}`
      );
      throw e;
    }
  }

  public async handleRewards(gameCode: string, input: any, handTime: Date) {
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }

    return await this.handleHighHand(game, input, handTime);
  }

  /*
  startTime is inclusive.
  endTime is not inclusive.
  */
  public async searchHighRankHands(
    clubCode: string,
    startTime: Date,
    endTime: Date,
    minRank: number,
    gameTypes: Array<GameType>
  ) {
    let gameTypeInClause: string;
    let args: Array<any> = [clubCode, startTime, endTime, minRank];
    if (!gameTypes) {
      gameTypeInClause = '';
    } else {
      gameTypeInClause = 'AND hr.game_type = ANY(?)';
      const gameTypeNums = gameTypes.map(g => parseInt(GameType[g]));
      args.push(gameTypeNums);
    }
    const query = fixQuery(`
        SELECT game_code AS "gameCode", hand_num AS "handNum", hand_time AS "handTime",
            high_rank AS rank, game_type AS "gameType"
        FROM high_rank hr
        WHERE hr.club_code = ?
        AND hr.hand_time >= ?
        AND hr.hand_time < ?
        AND hr.high_rank <= ?
        ${gameTypeInClause};
    `);
    const dbResult = await getHistoryConnection().query(query, args);
    const result: Array<any> = [];
    for (const r of dbResult) {
      const hand = {...r};
      hand.gameType = GameType[r.gameType];
      result.push(hand);
    }
    return result;
  }

  private async logHighRank(
    gameId: number,
    gameCode: string,
    clubCode: string,
    gameType: GameType,
    handNum: number,
    handTime: Date,
    highRank: number,
    secondRank: number
  ) {
    if (highRank > MIN_FULLHOUSE_RANK) {
      return;
    }
    const highRankRepo = getHistoryRepository(HighRank);
    const record = new HighRank();
    record.gameId = gameId;
    record.gameCode = gameCode;
    record.clubCode = clubCode;
    record.gameType = gameType;
    record.handNum = handNum;
    record.handTime = handTime;
    record.rank = highRank;
    if (secondRank) {
      record.secondRank = secondRank;
    }
    await highRankRepo.save(record);
  }

  public async handleHighRanks(
    game: PokerGame,
    input: any,
    handTime: Date,
    transactionEntityManager: EntityManager
  ) {
    const boards = input.result.boards;
    if (boards.length === 0) {
      return;
    }
    // if (player.hiRank >= 1 && player.hiRank <= 10) {
    //   // straight flush
    //   ret.straightFlushes.push(board);
    // } else if (player.hiRank <= 166) {
    //   // four of a kind
    //   ret.fourOfKinds.push(board);
    // } else if (player.hiRank <= 322) {
    //   // full house
    //   ret.fullHouseHands.push(board);
    // }

    let straightFlushes = 0;
    let fourOfKinds = 0;

    // get rank for all the players from all the board
    const activeSeats: Array<number> = input.result.activeSeats;
    const ranks = new Array<number>();
    for (const board of boards) {
      const playerRank = board.playerRank;
      for (const seatNoStr of Object.keys(playerRank)) {
        const seatNo: number = parseInt(seatNoStr);
        if (!activeSeats.includes(seatNo)) {
          // Must be one of the active seats to be counted as the high rank.
          continue;
        }
        const player = playerRank[seatNoStr];
        if (player.hhRank && player.hhRank <= MIN_FULLHOUSE_RANK) {
          ranks.push(player.hhRank);
        }

        if (player.hhRank) {
          if (player.hhRank <= MIN_STRAIGHT_FLUSH_RANK) {
            straightFlushes++;
          } else if (player.hhRank <= MIN_FOUR_OF_A_KIND_RANK) {
            fourOfKinds++;
          }
        }
      }
    }

    // update high rank stats in redis
    await Cache.updateHighRankStats(game, straightFlushes, fourOfKinds);

    // update high rank stats in db
    if (straightFlushes > 0 || fourOfKinds > 0) {
      await GameUpdatesRepository.updateHighRankStats(
        transactionEntityManager,
        game,
        straightFlushes,
        fourOfKinds
      );
    }

    if (ranks.length === 0) {
      return;
    }

    // Sort the numbers in ascending order.
    ranks.sort((a, b) => a - b);
    const highRank = ranks[0];
    const secondRank = ranks[1];
    if (!highRank) {
      return;
    }

    const gameTypeStr: string = input['gameType'];
    const gameType: GameType = GameType[gameTypeStr];

    await this.logHighRank(
      game.id,
      game.gameCode,
      game.clubCode,
      gameType,
      input.handNum,
      handTime,
      highRank,
      secondRank
    );
  }

  public async handleHighHand(
    gameInput: PokerGame,
    input: any,
    handTime: Date,
    transactionManager?: EntityManager
  ): Promise<HighHandWinnerResult | null> {
    let rewardTrackingId = 0;
    let gameTracking = false;
    try {
      if (gameInput.highHandTracked) {
        gameTracking = true;
      }
      if (!gameTracking) {
        if (!input.rewardTrackingIds || input.rewardTrackingIds.length === 0) {
          return null;
        }
      }
      const playersInHand = input.result.playerInfo;
      const boards = input.result.boards;
      if (boards.length === 0) {
        return null;
      }

      // get rank for all the players from all the board
      const ranks = new Array<number>();
      for (const board of boards) {
        const playerRank = board.playerRank;
        for (const seatNo of Object.keys(playerRank)) {
          const player = playerRank[seatNo];
          if (player.hhRank <= MIN_FULLHOUSE_RANK) {
            ranks.push(player.hhRank);
          }
        }
      }
      if (ranks.length === 0) {
        return null;
      }

      const highHandRank = _.min(ranks);
      if (!highHandRank) {
        return null;
      }

      if (highHandRank > MIN_FULLHOUSE_RANK) {
        return null;
      }
      let existingHighHandRank = Number.MAX_SAFE_INTEGER;
      let existingRewardTracking;

      const game = await Cache.getGame(
        gameInput.gameCode,
        false,
        transactionManager
      );
      if (!game) {
        throw new GameNotFoundError(gameInput.gameCode);
      }

      if (gameTracking) {
        existingHighHandRank = game.highHandRank;
      } else {
        if (input.rewardTrackingIds) {
          // right now, we handle only one reward
          if (input.rewardTrackingIds.length > 1) {
            logger.error(
              `Game: ${gameInput.gameCode} Cannot track more than one reward`
            );
            throw new Error('Not implemented');
          }

          const trackingId = input.rewardTrackingIds[0];
          rewardTrackingId = trackingId;
          let rewardTrackRepo: Repository<GameRewardTracking>;
          if (transactionManager) {
            rewardTrackRepo =
              transactionManager.getRepository(GameRewardTracking);
          } else {
            rewardTrackRepo = getGameRepository(GameRewardTracking);
          }

          existingRewardTracking = await rewardTrackRepo.findOne({
            id: trackingId,
            active: true,
          });
          if (!existingRewardTracking) {
            logger.error(
              `No existing active reward tracking found for id: ${trackingId}`
            );
            return null;
          }
          if (existingRewardTracking && existingRewardTracking.highHandRank) {
            existingHighHandRank = existingRewardTracking.highHandRank;
          }
        }
      }

      const highHandWinners = new Array<HighHandWinner>();
      let hhCards = '';
      for (const board of boards) {
        const playersRank = board.playerRank;
        for (const seatNo of Object.keys(playersRank)) {
          const playerRank = playersRank[seatNo];
          if (playerRank.hhRank !== highHandRank) {
            continue;
          }

          // matches high hand rank
          // let us get the player information
          const playerInSeat = playersInHand[seatNo];
          const playerId = playerInSeat.id;
          const playerInfo = await Cache.getPlayerById(playerId);

          try {
            highHandWinners.push({
              gameCode: gameInput.gameCode,
              playerId: playerInfo.id,
              playerUuid: playerInfo.uuid,
              playerName: playerInfo.name,
              boardCards: board.cards,
              playerCards: playerInSeat.cards,
              hhCards: playerRank.hiCards,
            });
          } catch (err) {
            logger.error(
              `Cannot update high hand winners. Error occurred: ${JSON.stringify(
                err
              )}`
            );
          }
        }
      }

      let winner = true;

      if (existingHighHandRank != 0 && highHandRank > existingHighHandRank) {
        winner = false;
        logger.error(`Hand: ${hhCards} is not a high hand.`);

        // is this better high hand in that game?
        let gameHighHandRank = game.highHandRank;
        if (gameHighHandRank === 0) {
          gameHighHandRank = await this.getGameHighHand(
            game,
            existingRewardTracking.reward.id,
            transactionManager
          );
          // if (gameTracking) {
          //   gameHighHandRank = await this.getGameHighHandWithoutReward(
          //     game,
          //     transactionManager
          //   );
          // } else {
          //   gameHighHandRank = await this.getGameHighHand(
          //     game,
          //     existingRewardTracking.reward.id,
          //     transactionManager
          //   );
          // }
        }

        if (highHandRank > gameHighHandRank) {
          return null;
        }
      }

      // get existing high hand from the database
      // TODO: we need to handle multiple players with high hands
      if (winner && highHandWinners.length > 0) {
        const highHandPlayer = highHandWinners[0];
        const playerId = highHandPlayer.playerId;

        if (!gameTracking) {
          let rewardTrackRepo: Repository<GameRewardTracking>;
          if (transactionManager) {
            rewardTrackRepo =
              transactionManager.getRepository(GameRewardTracking);
          } else {
            rewardTrackRepo = getGameRepository(GameRewardTracking);
          }
          // update high hand information in the reward tracking table

          await rewardTrackRepo.update(
            {
              id: existingRewardTracking.id,
            },
            {
              handNum: input.handNum,
              gameId: game.id,
              playerId: playerId,
              boardCards: JSON.stringify(highHandPlayer.boardCards),
              playerCards: JSON.stringify(highHandPlayer.playerCards),
              highHand: JSON.stringify(highHandPlayer.hhCards),
              highHandRank: highHandRank,
            }
          );
        }
        await this.logHighHand(
          existingRewardTracking,
          game.id,
          playerId,
          input.handNum,
          JSON.stringify(highHandPlayer.playerCards),
          JSON.stringify(highHandPlayer.boardCards),
          highHandPlayer.hhCards,
          highHandRank,
          handTime,
          winner,
          existingRewardTracking?.reward,
          transactionManager
        );
        await Cache.updateGameHighHand(game.gameCode, highHandRank);
      }
      return {
        rewardTrackingId: rewardTrackingId,
        winners: highHandWinners,
      };
    } catch (err) {
      logger.error(
        `Couldn't update reward. retry again. Error: ${errToStr(err)}`
      );
      throw new Error("Couldn't update reward, please retry again");
    }
  }

  private async logHighHand(
    rewardTracking: GameRewardTracking,
    gameId: number,
    playerId: number,
    handNum: number,
    playerCards: string,
    boardCards: string,
    highhandCards: Array<number>,
    rank: number,
    handTime: Date,
    winner: boolean,
    reward: Reward,
    transactionManager?: EntityManager
  ) {
    let logHighHandRepo: Repository<HighHand>;
    if (transactionManager) {
      logHighHandRepo = transactionManager.getRepository(HighHand);
    } else {
      logHighHandRepo = getGameRepository(HighHand);
    }

    await logHighHandRepo.update(
      {
        gameId: gameId,
        rank: Not(rank),
      },
      {
        winner: false,
      }
    );

    const player = new Player();
    player.id = playerId;
    const game = new PokerGame();
    game.id = gameId;
    const highhand = new HighHand();
    if (rewardTracking) {
      highhand.rewardId = rewardTracking.rewardId;
      highhand.rewardTracking = rewardTracking;
    }
    highhand.gameId = game.id;
    highhand.playerId = player.id;
    highhand.highHand = JSON.stringify(highhandCards);
    highhand.handNum = handNum;
    highhand.playerCards = playerCards;
    highhand.boardCards = boardCards;
    highhand.rank = rank;
    highhand.handTime = handTime;
    highhand.winner = winner;
    highhand.highHandCards = JSON.stringify(stringCards(highhandCards));
    await logHighHandRepo.save(highhand);
    Metrics.incHighHand();
  }

  public async highHandByGame(gameCode: string) {
    if (!gameCode) {
      return;
    }
    const highHands = [] as any;
    const liveGame = await Cache.getGame(gameCode);
    let historyGame: GameHistory | undefined;
    if (!liveGame) {
      historyGame = await HistoryRepository.getHistoryGame(gameCode);
      if (!historyGame) {
        throw new GameNotFoundError(gameCode);
      }
    }

    try {
      if (historyGame && historyGame.status === GameStatus.ENDED) {
        const highHandRepo = getHistoryRepository(HighHandHistory);
        const gameHighHands = await highHandRepo.find({
          where: {gameId: historyGame.gameId},
          order: {handTime: 'DESC'},
        });
        for await (const highHand of gameHighHands) {
          const player = await Cache.getPlayerById(highHand.playerId);
          highHands.push({
            gameCode: gameCode,
            handNum: highHand.handNum,
            playerUuid: player.uuid,
            playerName: player.name,
            playerCards: highHand.playerCards,
            boardCards: highHand.boardCards,
            highHand: highHand.highHand,
            rank: highHand.rank,
            handTime: highHand.handTime,
            highHandCards: highHand.highHandCards,
            winner: highHand.winner,
          });
        }
      } else if (liveGame) {
        const highHandRepo = getGameRepository(HighHand);
        const gameHighHands = await highHandRepo.find({
          where: {gameId: liveGame.id},
          order: {handTime: 'DESC'},
        });
        for await (const highHand of gameHighHands) {
          const player = await Cache.getPlayerById(highHand.playerId);
          highHands.push({
            gameCode: gameCode,
            handNum: highHand.handNum,
            playerUuid: player.uuid,
            playerName: player.name,
            playerCards: highHand.playerCards,
            boardCards: highHand.boardCards,
            highHand: highHand.highHand,
            rank: highHand.rank,
            handTime: highHand.handTime,
            highHandCards: highHand.highHandCards,
            winner: highHand.winner,
          });
        }
      }
      return highHands;
    } catch (err) {
      logger.error(
        `Couldn't retrieve Highhand. retry again. Error: ${errToStr(err)}`
      );
      throw new Error("Couldn't retrieve highhand, please retry again");
    }
  }

  public async highHandByReward(gameCode: string, rewardId: number) {
    if (!gameCode || !rewardId) {
      return;
    }
    const highHands = [] as any;
    const highHandRepo = getGameRepository(HighHand);
    const rewardRepo = getUserRepository(Reward);
    const game = await Cache.getGame(gameCode);
    if (!game) {
      logger.error('Invalid gameCode');
      throw new Error('Invalid gameCode');
    }
    const reward = await rewardRepo.findOne({id: rewardId});
    if (!reward) {
      logger.error(`Invalid RewardId. ${rewardId}`);
      throw new Error('Invalid RewardId');
    }
    try {
      const gameHighHands = await highHandRepo.find({
        where: {gameId: game.id, rewardId: rewardId},
        order: {handTime: 'DESC'},
      });
      for await (const highHand of gameHighHands) {
        const player = await Cache.getPlayerById(highHand.playerId);

        highHands.push({
          gameCode: gameCode,
          handNum: highHand.handNum,
          playerUuid: player.uuid,
          playerName: player.name,
          playerCards: highHand.playerCards,
          boardCards: highHand.boardCards,
          highHand: highHand.highHand,
          rank: highHand.rank,
          handTime: highHand.handTime,
          highHandCards: highHand.highHandCards,
          winner: highHand.winner,
        });
      }
      return highHands;
    } catch (err) {
      logger.error(
        `Couldn't retrieve Highhand. retry again. Error: ${errToStr(err)}`
      );
      throw new Error("Couldn't retrieve highhand, please retry again");
    }
  }

  public async getGameHighHand(
    game: PokerGame,
    rewardId: number,
    transactionManager?: EntityManager
  ): Promise<number> {
    let highHandRepo: Repository<HighHand>;
    if (transactionManager) {
      highHandRepo = transactionManager.getRepository(HighHand);
    } else {
      highHandRepo = getGameRepository(HighHand);
    }

    const gameHighHands = await highHandRepo.find({
      where: {gameId: game.id},
      order: {handTime: 'DESC'},
      take: 1,
    });
    if (gameHighHands && gameHighHands.length === 1) {
      return gameHighHands[0].rank;
    }
    return 0xffffffff;
  }

  public async getGameHighHandWithoutReward(
    game: PokerGame,
    transactionManager?: EntityManager
  ): Promise<number> {
    let highHandRepo: Repository<HighHand>;
    if (transactionManager) {
      highHandRepo = transactionManager.getRepository(HighHand);
    } else {
      highHandRepo = getGameRepository(HighHand);
    }

    const gameHighHands = await highHandRepo.find({
      where: {gameId: game.id},
      order: {handTime: 'DESC'},
      take: 1,
    });
    if (gameHighHands && gameHighHands.length === 1) {
      return gameHighHands[0].rank;
    }
    return 0xffffffff;
  }

  public async highHandWinners(gameCode: string, rewardId: number) {
    if (!gameCode) {
      return;
    }
    const highHands = [] as any;
    const highHandRepo = getGameRepository(HighHand);
    const rewardRepo = getUserRepository(Reward);
    const game = await Cache.getGame(gameCode);
    if (!game) {
      logger.error('Invalid gameCode');
      throw new GameNotFoundError(gameCode);
    }

    if (!rewardId) {
      // get reward associated with the game code
      const gameRewards = await getGameRepository(GameReward).find({
        gameId: game.id,
      });
      if (gameRewards && gameRewards.length >= 1) {
        // get highhand reward id
        if (gameRewards.length === 1) {
          rewardId = gameRewards[0].rewardId;
        }
      }
    }

    let gameHighHands;
    // no highhand rewards attached to the game
    if (rewardId) {
      const reward = await rewardRepo.findOne({id: rewardId});
      if (!reward) {
        logger.error(`Invalid Reward. ${rewardId}`);
        return [];
      }
      const rewardTrackRepo = getGameRepository(GameRewardTracking);
      const rewardtrack = await rewardTrackRepo.findOne({
        gameId: game.id,
        rewardId: reward.id,
      });
      if (!rewardtrack) {
        logger.error('RewardTrackId not found.');
        return [];
      }
      gameHighHands = await highHandRepo.find({
        where: {rewardTracking: {id: rewardtrack.id}, winner: true},
      });
    } else {
      gameHighHands = await highHandRepo.find({
        where: {gameId: game.id, winner: true},
      });
    }
    try {
      for await (const highHand of gameHighHands) {
        const player = await Cache.getPlayerById(highHand.playerId);

        highHands.push({
          gameCode: gameCode,
          handNum: highHand.handNum,
          playerUuid: player.uuid,
          playerName: player.name,
          playerCards: highHand.playerCards,
          boardCards: highHand.boardCards,
          highHand: highHand.highHand,
          rank: highHand.rank,
          handTime: highHand.handTime,
          highHandCards: highHand.highHandCards,
          winner: highHand.winner,
        });
      }
      return highHands;
    } catch (err) {
      logger.error(
        `Couldn't retrieve Highhand. retry again. Error: ${errToStr(err)}`
      );
      throw new Error("Couldn't retrieve highhand, please retry again");
    }
  }

  public async getRewardTrack(gameCode: string, rewardId: string) {
    if (!gameCode || !rewardId) {
      return;
    }
    const rewardRepo = getUserRepository(Reward);
    const game = await Cache.getGame(gameCode);
    if (!game) {
      logger.error('Invalid gameCode');
      throw new Error('Invalid gameCode');
    }
    const reward = await rewardRepo.findOne({id: parseInt(rewardId)});
    if (!reward) {
      logger.error(`Invalid RewardId. ${rewardId}`);
      throw new Error('Invalid RewardId');
    }
    const rewardTrackRepo = getGameRepository(GameRewardTracking);
    const rewardtrack = await rewardTrackRepo.find({
      where: {
        rewardId: parseInt(rewardId),
      },
    });
    if (!rewardtrack) {
      logger.error('RewardTrackId not found.');
      throw new Error('RewardTrackId not found.');
    }
    return rewardtrack;
  }
}

export const RewardRepository = new RewardRepositoryImpl();
