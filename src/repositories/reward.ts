import {Club} from '@src/entity/club';
import {getManager, getRepository} from 'typeorm';
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

  public async handleHighHand(gameCode: string, input: any, handTime: Date) {
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
      const rewardTrackRepo = getRepository(GameRewardTracking);

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

      const rewardRepo = getRepository(Reward);
      const reward = await rewardRepo.findOne({id: existingTracking.id});
      if (!reward) {
        throw new Error(`Reward ${existingTracking.id} Not found`);
      }

      let existingHighHandRank = Number.MAX_SAFE_INTEGER;
      if (existingTracking && existingTracking.highHandRank) {
        existingHighHandRank = existingTracking.highHandRank;
      }

      const highHandPlayers = new Array<any>();
      let hhCards = '';
      for (const seatNo of Object.keys(input.players)) {
        const player = input.players[seatNo];
        if (player.rank === highHandRank) {
          highHandPlayers.push(player);
          hhCards = player.bestCards;
        }
      }

      const game = await Cache.getGame(gameCode);

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
        if (highHandRank > existingHighHandRank) {
          logger.error(`Hand: ${hhCards} is not a high hand.`);
          console.log('1');
          await this.logHighHand(
            existingTracking,
            game,
            player,
            input.handNum,
            JSON.stringify(highHandPlayer.cards),
            JSON.stringify(input.boardCards),
            JSON.stringify(highHandPlayer.bestCards),
            highHandRank,
            handTime,
            false,
            reward
          );
          return;
        }
        const rewardTrackRepo = getRepository(GameRewardTracking);
        const rewardTrackResp = await rewardTrackRepo.update(
          {id: trackingId},
          {
            handNum: input.handNum,
            gameId: game,
            playerId: player,
            boardCards: JSON.stringify(input.boardCards),
            playerCards: JSON.stringify(highHandPlayer.cards),
            highHand: JSON.stringify(highHandPlayer.bestCards),
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
          JSON.stringify(highHandPlayer.bestCards),
          highHandRank,
          handTime,
          true,
          reward
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
    rewardTrackingId: GameRewardTracking,
    gameId: PokerGame,
    playerId: Player,
    handNum: number,
    playerCards: string,
    boardCards: string,
    highhand: string,
    rank: number,
    handTime: Date,
    winner: boolean,
    reward: Reward
  ) {
    const logHighHandRepo = getRepository(HighHand);
    const logHighHand = new HighHand();
    logHighHand.rewardId = reward;
    logHighHand.rewardTrackingId = rewardTrackingId;
    logHighHand.gameId = gameId;
    logHighHand.playerId = playerId;
    logHighHand.highHand = highhand;
    logHighHand.handNum = handNum;
    logHighHand.playerCards = playerCards;
    logHighHand.boardCards = boardCards;
    logHighHand.rank = rank;
    logHighHand.handTime = handTime;
    logHighHand.winner = winner;
    await logHighHandRepo.save(logHighHand);
  }

  public async highHandByGame(gameCode) {
    if (!gameCode) {
      return;
    }
    console.log('1');
    const highHand = [];
    let logHighHand: any;
    const highHandRepo = getRepository(HighHand);
    const gameRepo = getRepository(PokerGame);
    const game = await gameRepo.findOne({id: parseInt(gameCode)});
    const loggedHighHand = await highHandRepo.find({gameId: game});
    try {
      for await (logHighHand of loggedHighHand) {
        await highHand.push({
          gameCode: gameCode,
          handNum: logHighHand.handNum,
          playerUuid: logHighHand.playerId.uuid,
          playerName: logHighHand.playerId.name,
          playerCards: logHighHand.playerCards,
          boardCards: logHighHand.boardCards,
          highHand: logHighHand.highHand,
          rank: logHighHand.rank,
          handTime: logHighHand.handTime,
        });
      }
      return highHand;
    } catch (err) {
      logger.error(
        `Couldn't retrieve Highhand. retry again. Error: ${err.toString()}`
      );
      throw new Error("Couldn't retrieve highhand, please retry again");
    }
  }

  public async highHandByReward(gameCode, rewardId) {
    if (!gameCode || !rewardId) {
      return;
    }
    const highHand = [];
    let logHighHand: any;
    const highHandRepo = getRepository(HighHand);
    const rewardTrackIdRepo = getRepository(GameRewardTracking);
    const gameRepo = getRepository(PokerGame);
    const rewardRepo = getRepository(Reward);
    const playerRepo = getRepository(Player);
    const game = await gameRepo.findOne({gameCode: gameCode});
    if (!game) {
      logger.error('Invalid gameCode');
      throw new Error('Invalid gameCode');
    }
    const reward = await rewardRepo.findOne({id: rewardId});
    if (!reward) {
      logger.error('Invalid RewardId}');
      throw new Error('Invalid RewardId');
    }
    const loggedHighHand = await highHandRepo.find({
      gameId: gameCode,
      rewardId: reward,
    });
    try {
      for await (logHighHand of loggedHighHand) {
        const player = await playerRepo.findOne({
          id: parseInt(logHighHand.playerId),
        });
        if (!player) {
          throw new Error('Player not Found Error');
        }
        highHand.push({
          gameCode: gameCode,
          handNum: logHighHand.handNum,
          playerUuid: player.uuid,
          playerName: player.name,
          playerCards: logHighHand.playerCards,
          boardCards: logHighHand.boardCards,
          highHand: logHighHand.highHand,
          rank: logHighHand.rank,
          handTime: logHighHand.handTime,
        });
      }
      return highHand;
    } catch (err) {
      logger.error(
        `Couldn't retrieve Highhand. retry again. Error: ${err.toString()}`
      );
      throw new Error("Couldn't retrieve highhand, please retry again");
    }
  }
}

export const RewardRepository = new RewardRepositoryImpl();
