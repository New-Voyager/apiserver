import {Club} from '@src/entity/club';
import {EntityManager, getRepository, Not, Repository} from 'typeorm';
import {RewardType, ScheduleType} from '@src/entity/types';
import {GameRewardTracking, Reward} from '@src/entity/reward';
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
import {MIN_FULLHOUSE_RANK} from './types';
import {Cache} from '@src/cache';
import _ from 'lodash';
import {HighHand} from '@src/entity/reward';
import {Player} from '@src/entity/player';
import {PokerGame} from '@src/entity/game';
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
    return await this.handleHighHand(gameCode, input, handTime);
  }

  public async handleHighHand(
    gameCode: string,
    input: any,
    handTime: Date,
    transactionManager?: EntityManager
  ) {
    try {
      if (!input.rewardTrackingIds || input.rewardTrackingIds.length === 0) {
        return;
      }
      const rank: number[] = [];
      Object.keys(input.players).forEach(async card => {
        rank.push(parseInt(input.players[card.toString()].rank));
      });
      const highHandRank = _.min(rank);
      if (!highHandRank) {
        return;
      }

      if (highHandRank > MIN_FULLHOUSE_RANK) {
        return;
      }

      // TODO: multiple players can have the same hand (we need to deal with this)
      // May be store the winning player information in a json
      // get the players who had this rank
      // right now, we handle only one reward
      if (input.rewardTrackingIds.length > 1) {
        logger.error(`Game: ${gameCode} Cannot track more than one reward`);
        throw new Error('Not implemented');
      }

      const trackingId = input.rewardTrackingIds[0];
      let rewardTrackRepo: Repository<GameRewardTracking>;
      if (transactionManager) {
        rewardTrackRepo = transactionManager.getRepository(GameRewardTracking);
      } else {
        rewardTrackRepo = getRepository(GameRewardTracking);
      }

      const existingTracking = await rewardTrackRepo.findOne({
        id: trackingId,
        active: true,
      });
      if (!existingTracking) {
        logger.error(
          `No existing active reward tracking found for id: ${trackingId}`
        );
        return;
      }

      let existingHighHandRank = Number.MAX_SAFE_INTEGER;
      if (existingTracking && existingTracking.highHandRank) {
        existingHighHandRank = existingTracking.highHandRank;
      }

      const highHandPlayers = new Array<any>();
      let hhCards = '';
      for (const seatNo of Object.keys(input.players)) {
        const player = input.players[seatNo];
        if (player.hhRank === highHandRank) {
          highHandPlayers.push(player);
          hhCards = player.hhCards;
        }
      }
      if (highHandRank > existingHighHandRank) {
        logger.error(`Hand: ${hhCards} is not a high hand.`);
        return;
      }
      const game = await Cache.getGame(gameCode, false, transactionManager);

      // get existing high hand from the database
      // TODO: we need to handle multiple players with high hands
      if (highHandPlayers.length > 0) {
        const highHandPlayer = highHandPlayers[0];
        const playerRepo = getRepository(Player);
        const player = await playerRepo.findOne({
          id: parseInt(highHandPlayer.id),
        });
        if (!player) {
          throw new Error('Player not found');
        }
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
            id: existingTracking.id,
          },
          {
            handNum: input.handNum,
            game: game,
            player: player,
            boardCards: JSON.stringify(input.boardCards),
            playerCards: JSON.stringify(highHandPlayer.cards),
            highHand: JSON.stringify(highHandPlayer.hhCards),
            highHandRank: highHandRank,
          }
        );

        await this.logHighHand(
          existingTracking,
          game,
          player,
          input.handNum,
          JSON.stringify(highHandPlayer.cards),
          JSON.stringify(input.boardCards),
          highHandPlayer.hhCards,
          highHandRank,
          handTime,
          true,
          existingTracking.reward
        );
      }
      return true;
    } catch (err) {
      logger.error(
        `Couldn't update reward. retry again. Error: ${err.toString()}`
      );
      throw new Error("Couldn't update reward, please retry again");
    }
  }

  public async logHighHand(
    rewardTracking: GameRewardTracking,
    game: PokerGame,
    player: Player,
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

    const highhand = new HighHand();
    highhand.reward = reward;
    highhand.rewardTracking = rewardTracking;
    highhand.game = game;
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
        where: {game: {id: game.id}},
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
        where: {game: {id: game.id}, reward: {id: rewardId}},
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

  public async getTrackId(rewardId: string) {
    // We should use both gameCode and rewardId to get tracking id
    // a multiple games may be associated with a rewardId
    if (!rewardId) {
      throw new Error('RewardId is empty');
    }
    const gameTrackRepo = getRepository(GameRewardTracking);
    const rewardRepo = getRepository(Reward);
    const reward = await rewardRepo.findOne({id: parseInt(rewardId)});
    if (!reward) {
      throw new Error(`Reward ${rewardId} is not found`);
    }
    const gameTrack = await gameTrackRepo.findOne({reward: {id: reward.id}});
    if (!gameTrack) {
      throw new Error(`Reward-id ${rewardId} not found`);
    }
    return gameTrack.id;
  }
}

export const RewardRepository = new RewardRepositoryImpl();
