import {Club} from '@src/entity/player/club';
import {EntityManager, getRepository, Not, Repository} from 'typeorm';
import {RewardType, ScheduleType} from '@src/entity/types';
import {
  GameReward,
  GameRewardTracking,
  Reward,
} from '@src/entity/player/reward';
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
import {HighHand} from '@src/entity/player/reward';
import {Player} from '@src/entity/player/player';
import {PokerGame} from '@src/entity/game/game';
import {stringCards} from '@src/utils';
const logger = getLogger('rewardRepo');

class RewardRepositoryImpl {
  public async createReward(clubCode: string, reward: RewardInputFormat) {
    try {
      const clubRepository = getRepository(Club);
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
        const repository = getRepository(Reward);
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
      const clubRepository = getRepository(Club);
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
        const rewardRepository = getRepository(Reward);
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
    let rewardTrackingId = 0;
    let gameTracking: boolean = false;
    try {
      if (gameInput.highHandTracked) {
        gameTracking = true;
      }
      if (!gameTracking) {
        if (!input.rewardTrackingIds || input.rewardTrackingIds.length === 0) {
          return null;
        }
      }
      const rank: number[] = [];
      Object.keys(input.players).forEach(async card => {
        rank.push(parseInt(input.players[card.toString()].hhRank));
      });
      const highHandRank = _.min(rank);
      if (!highHandRank) {
        return null;
      }

      if (highHandRank > MIN_FULLHOUSE_RANK) {
        return null;
      }
      let existingHighHandRank = Number.MAX_SAFE_INTEGER;

      let existingRewardTracking;
      if (gameTracking) {
      } else {
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
          rewardTrackRepo = transactionManager.getRepository(
            GameRewardTracking
          );
        } else {
          rewardTrackRepo = getRepository(GameRewardTracking);
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

      const highHandWinners = new Array<HighHandWinner>();
      const highHandPlayers = new Array<any>();
      let hhCards = '';
      for (const seatNo of Object.keys(input.players)) {
        const player = input.players[seatNo];
        if (player.hhRank === highHandRank) {
          highHandPlayers.push(player);
          hhCards = player.hhCards;

          try {
            const playerInfo = await Cache.getPlayerById(player.id);
            highHandWinners.push({
              gameCode: gameInput.gameCode,
              playerId: player.id,
              playerUuid: playerInfo.uuid,
              playerName: playerInfo.name,
              boardCards: input.boardCards,
              playerCards: player.cards,
              hhCards: player.hhCards,
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

      if (hhCards === '') {
        return null;
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
            gameHighHandRank = await this.getGameHighHandWithoutReward(
              game,
              existingRewardTracking.reward.id
            );
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

      // get existing high hand from the database
      // TODO: we need to handle multiple players with high hands
      if (winner && highHandPlayers.length > 0) {
        const highHandPlayer = highHandPlayers[0];
        const playerId = parseInt(highHandPlayer.id);

        if (!gameTracking) {
          let rewardTrackRepo: Repository<GameRewardTracking>;
          if (transactionManager) {
            rewardTrackRepo = transactionManager.getRepository(
              GameRewardTracking
            );
          } else {
            rewardTrackRepo = getRepository(GameRewardTracking);
          }
          // update high hand information in the reward tracking table

          await rewardTrackRepo.update(
            {
              id: existingRewardTracking.id,
            },
            {
              handNum: input.handNum,
              gameId: game.id,
              player: {id: playerId},
              boardCards: JSON.stringify(input.boardCards),
              playerCards: JSON.stringify(highHandPlayer.cards),
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
          JSON.stringify(highHandPlayer.cards),
          JSON.stringify(input.boardCards),
          highHandPlayer.hhCards,
          highHandRank,
          handTime,
          winner,
          existingRewardTracking?.reward
        );
        Cache.updateGameHighHand(game.gameCode, highHandRank);
      }
      return {
        rewardTrackingId: rewardTrackingId,
        winners: highHandWinners,
      };
    } catch (err) {
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
      logHighHandRepo = getRepository(HighHand);
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
      highhand.reward = reward;
      highhand.rewardTracking = rewardTracking;
    }
    highhand.gameId = game.id;
    highhand.player = player;
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
    const highHandRepo = getRepository(HighHand);
    const game = await Cache.getGame(gameCode);
    try {
      const gameHighHands = await highHandRepo.find({
        where: {gameId: game.id},
        order: {handTime: 'DESC'},
      });
      for await (const highHand of gameHighHands) {
        highHands.push({
          gameCode: gameCode,
          handNum: highHand.handNum,
          playerUuid: highHand.player.uuid,
          playerName: highHand.player.name,
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

  public async highHandByReward(gameCode: string, rewardId: number) {
    if (!gameCode || !rewardId) {
      return;
    }
    const highHands = [] as any;
    const highHandRepo = getRepository(HighHand);
    const rewardRepo = getRepository(Reward);
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
        where: {gameId: game.id, reward: {id: rewardId}},
        order: {handTime: 'DESC'},
      });
      for await (const highHand of gameHighHands) {
        highHands.push({
          gameCode: gameCode,
          handNum: highHand.handNum,
          playerUuid: highHand.player.uuid,
          playerName: highHand.player.name,
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
    const highHandRepo = getRepository(HighHand);
    const gameHighHands = await highHandRepo.find({
      where: {gameId: game.id, reward: {id: rewardId}},
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
    rewardId: number
  ): Promise<number> {
    const highHandRepo = getRepository(HighHand);
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
    const highHandRepo = getRepository(HighHand);
    const rewardRepo = getRepository(Reward);
    const game = await Cache.getGame(gameCode);
    if (!game) {
      logger.error('Invalid gameCode');
      throw new Error('Invalid gameCode');
    }

    if (!rewardId) {
      // get reward associated with the game code
      const gameRewards = await getRepository(GameReward).find({
        gameId: game.id,
      });
      if (gameRewards && gameRewards.length >= 1) {
        // get highhand reward id
        if (gameRewards.length === 1) {
          rewardId = gameRewards[0].rewardId.id;
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
      const rewardTrackRepo = getRepository(GameRewardTracking);
      const rewardtrack = await rewardTrackRepo.findOne({
        gameId: game.id,
        reward: reward,
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
        highHands.push({
          gameCode: gameCode,
          handNum: highHand.handNum,
          playerUuid: highHand.player.uuid,
          playerName: highHand.player.name,
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
    const rewardRepo = getRepository(Reward);
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
    const rewardTrackRepo = getRepository(GameRewardTracking);
    const rewardtrack = await rewardTrackRepo.find({
      where: {
        reward: {id: parseInt(rewardId)},
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
