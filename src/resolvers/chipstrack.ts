import * as _ from 'lodash';
import {ChipsTrackRepository} from '@src/repositories/chipstrack';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {GameUpdatesRepository} from '@src/repositories/gameupdates';

const logger = getLogger('resolvers::chipstrack');

export async function getClubBalanceAmount(playerId: string, data: any) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (data.clubCode === '') {
    errors.push('ClubCode is a mandatory field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return 0;
  //return await ChipsTrackRepository.getClubBalance(data.clubCode);
}

export async function getPlayerBalanceAmount(playerId: string, data: any) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (data.clubCode === '') {
    errors.push('ClubCode is mandatory field');
  }
  let queryPlayerId = playerId;
  if (data.playerId === '') {
    queryPlayerId = data.playerId;
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // is the player a club member
  const clubMember = await Cache.getClubMember(queryPlayerId, data.clubCode);
  if (!clubMember) {
    throw new Error(
      `Player ${queryPlayerId} is not a club member ${data.clubCode}`
    );
  }
  return 0;
  // return await ChipsTrackRepository.getPlayerBalance(
  //   queryPlayerId,
  //   data.clubCode
  // );
}

export async function getRakeCollected(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return await GameUpdatesRepository.getRakeCollected(playerId, gameCode);
}

const resolvers: any = {
  Query: {
    clubBalance: async (parent, args, ctx, info) => {
      return getClubBalanceAmount(ctx.req.playerId, args);
    },

    playerBalance: async (parent, args, ctx, info) => {
      return getPlayerBalanceAmount(ctx.req.playerId, args);
    },
    rakeCollected: async (parent, args, ctx, info) => {
      return getRakeCollected(ctx.req.playerId, args.gameCode);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
