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

  public async handleRewards(gameCode: string, input: any) {
    return this.handleHighHand(gameCode, input);
  }

  public async handleHighHand(gameCode: string, input: any) {
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
      if (highHandRank > existingHighHandRank) {
        logger.error(`Hand: ${hhCards} is not a high hand.`);
        return;
      }

      const game = await Cache.getGame(gameCode);

      // get existing high hand from the database

      // TODO: we need to handle multiple players with high hands
      await getManager().transaction(async () => {
        if (highHandPlayers.length > 0) {
          const highHandPlayer = highHandPlayers[0];
          const rewardTrackRepo = getRepository(GameRewardTracking);
          await rewardTrackRepo
            .createQueryBuilder()
            .update()
            .set({
              handNum: input.handNum,
              gameId: game,
              playerId: highHandPlayer.id,
              boardCards: JSON.stringify(input.boardCards),
              playerCards: JSON.stringify(highHandPlayer.cards),
              highHand: JSON.stringify(highHandPlayer.bestCards),
              highHandRank: highHandRank,
            })
            .execute();
        }
      });
      return true;
    } catch (err) {
      logger.error(
        `Couldn't update reward. retry again. Error: ${err.toString()}`
      );
      throw new Error("Couldn't update reward, please retry again");
    }
  }
}

export const RewardRepository = new RewardRepositoryImpl();
