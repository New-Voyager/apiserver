import {Club} from '@src/entity/player/club';
import {EntityManager, Not, Repository} from 'typeorm';
import {GameStatus, RewardType, ScheduleType} from '@src/entity/types';
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
import {getLogger} from '@src/utils/log';
import {
  HighHandWinner,
  HighHandWinnerResult,
  MIN_FULLHOUSE_RANK,
} from './types';
import {Cache} from '@src/cache';
import _ from 'lodash';
import {Player} from '@src/entity/player/player';
import {PokerGame} from '@src/entity/game/game';
import {stringCards} from '@src/utils';
import {getGameRepository, getHistoryRepository, getUserRepository} from '.';
import {
  GameReward,
  GameRewardTracking,
  HighHand,
} from '@src/entity/game/reward';
import {HighHandHistory} from '@src/entity/history/hand';
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
          ScheduleType[
            (reward.schedule as unknown) as keyof typeof ScheduleType
          ];
        createReward.name = reward.name;
        createReward.startHour = reward.startHour;
        createReward.type =
          RewardType[(reward.type as unknown) as keyof typeof RewardType];
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
    return await this.handleHighHand(game, input, handTime);
  }

  public async handleHighHand(
    gameInput: PokerGame,
    input: any,
    handTime: Date,
    transactionManager?: EntityManager
  ): Promise<HighHandWinnerResult | null> {
    logger.debug(
      `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1`
    );
    let rewardTrackingId = 0;
    let gameTracking = false;
    try {
      if (gameInput.highHandTracked) {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.1`
        );
        gameTracking = true;
      }
      if (!gameTracking) {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.2`
        );
        if (!input.rewardTrackingIds || input.rewardTrackingIds.length === 0) {
          logger.debug(
            `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.2.1`
          );
          return null;
        }
      }
      const playersInHand = input.result.playerInfo;
      const boards = input.result.boards;
      if (boards.length === 0) {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.3`
        );
        return null;
      }

      // get rank for all the players from all the board
      const ranks = new Array<number>();
      for (const board of boards) {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.4`
        );
        const playerRank = board.playerRank;
        for (const seatNo of Object.keys(playerRank)) {
          logger.debug(
            `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.4.1`
          );
          const player = playerRank[seatNo];
          if (player.hiRank <= MIN_FULLHOUSE_RANK) {
            logger.debug(
              `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.4.1.1`
            );
            ranks.push(player.hiRank);
          }
        }
      }
      if (ranks.length === 0) {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.5`
        );
        return null;
      }

      const highHandRank = _.min(ranks);
      if (!highHandRank) {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.6`
        );
        return null;
      }

      if (highHandRank > MIN_FULLHOUSE_RANK) {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.7`
        );
        return null;
      }
      let existingHighHandRank = Number.MAX_SAFE_INTEGER;

      let existingRewardTracking;
      if (gameTracking) {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.8`
        );
      } else {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9`
        );
        if (input.rewardTrackingIds) {
          logger.debug(
            `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.1`
          );
          // right now, we handle only one reward
          if (input.rewardTrackingIds.length > 1) {
            logger.debug(
              `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.1.1`
            );
            logger.error(
              `Game: ${gameInput.gameCode} Cannot track more than one reward`
            );
            logger.debug(
              `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.1.2`
            );
            throw new Error('Not implemented');
          }

          const trackingId = input.rewardTrackingIds[0];
          rewardTrackingId = trackingId;
          let rewardTrackRepo: Repository<GameRewardTracking>;
          logger.debug(
            `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.2`
          );
          if (transactionManager) {
            logger.debug(
              `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.2.1`
            );
            rewardTrackRepo = transactionManager.getRepository(
              GameRewardTracking
            );
          } else {
            logger.debug(
              `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.2.2`
            );
            rewardTrackRepo = getGameRepository(GameRewardTracking);
          }

          logger.debug(
            `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.3`
          );
          existingRewardTracking = await rewardTrackRepo.findOne({
            id: trackingId,
            active: true,
          });
          if (!existingRewardTracking) {
            logger.debug(
              `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.3.1`
            );
            logger.error(
              `No existing active reward tracking found for id: ${trackingId}`
            );
            return null;
          }
          logger.debug(
            `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.4`
          );
          if (existingRewardTracking && existingRewardTracking.highHandRank) {
            logger.debug(
              `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 1.9.4.1`
            );
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
          if (playerRank.hiRank !== highHandRank) {
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
      const game = await Cache.getGame(
        gameInput.gameCode,
        false,
        transactionManager
      );
      if (highHandRank > existingHighHandRank) {
        winner = false;
        logger.error(`Hand: ${hhCards} is not a high hand.`);

        // is this better high hand in that game?
        let gameHighHandRank = game.highHandRank;
        if (gameHighHandRank === 0) {
          if (gameTracking) {
            gameHighHandRank = await this.getGameHighHandWithoutReward(game);
          } else {
            gameHighHandRank = await this.getGameHighHand(
              game,
              existingRewardTracking.reward.id
            );
          }
        }

        if (highHandRank > gameHighHandRank) {
          return null;
        }
      }

      logger.debug(
        `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 2`
      );
      // get existing high hand from the database
      // TODO: we need to handle multiple players with high hands
      if (winner && highHandWinners.length > 0) {
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 2.1`
        );
        const highHandPlayer = highHandWinners[0];
        const playerId = highHandPlayer.playerId;

        if (!gameTracking) {
          logger.debug(
            `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 2.1.1`
          );
          let rewardTrackRepo: Repository<GameRewardTracking>;
          if (transactionManager) {
            rewardTrackRepo = transactionManager.getRepository(
              GameRewardTracking
            );
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
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 2.2`
        );
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
          existingRewardTracking?.reward
        );
        logger.debug(
          `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 2.3`
        );
        Cache.updateGameHighHand(game.gameCode, highHandRank);
      }
      logger.debug(
        `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 3`
      );
      return {
        rewardTrackingId: rewardTrackingId,
        winners: highHandWinners,
      };
    } catch (err) {
      logger.debug(
        `In RewardRepository.handleHighHand (game ${gameInput.gameCode}) 4`
      );
      logger.error(
        `Couldn't update reward. retry again. Error: ${err.toString()}`
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

    // reset previous winners
    if (rewardTracking) {
      logHighHandRepo.update(
        {
          rewardTracking: {id: rewardTracking.id},
          rank: Not(rank),
        },
        {
          winner: false,
        }
      );
    }
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
  }

  public async highHandByGame(gameCode: string) {
    if (!gameCode) {
      return;
    }
    const highHands = [] as any;
    const game = await Cache.getGame(gameCode);

    try {
      if (!game || game.status === GameStatus.ENDED) {
        const highHandRepo = getHistoryRepository(HighHandHistory);
        const gameHighHands = await highHandRepo.find({
          where: {gameId: game.id},
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
      } else {
        const highHandRepo = getGameRepository(HighHand);
        const gameHighHands = await highHandRepo.find({
          where: {gameId: game.id},
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
        `Couldn't retrieve Highhand. retry again. Error: ${err.toString()}`
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
        `Couldn't retrieve Highhand. retry again. Error: ${err.toString()}`
      );
      throw new Error("Couldn't retrieve highhand, please retry again");
    }
  }

  public async getGameHighHand(
    game: PokerGame,
    rewardId: number
  ): Promise<number> {
    const highHandRepo = getGameRepository(HighHand);
    const gameHighHands = await highHandRepo.find({
      where: {gameId: game.id, rewardId: rewardId},
      order: {handTime: 'DESC'},
      take: 1,
    });
    if (gameHighHands && gameHighHands.length === 1) {
      return gameHighHands[0].rank;
    }
    return 0xffffffff;
  }

  public async getGameHighHandWithoutReward(game: PokerGame): Promise<number> {
    const highHandRepo = getGameRepository(HighHand);
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
      throw new Error('Invalid gameCode');
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
        `Couldn't retrieve Highhand. retry again. Error: ${err.toString()}`
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
