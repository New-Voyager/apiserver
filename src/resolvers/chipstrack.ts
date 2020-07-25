import * as _ from 'lodash';
import {ChipsTrackRepository} from '@src/repositories/chipstrack';
import {getLogger} from '@src/utils/log';
const logger = getLogger('chipstrack-resolver');

export async function getClubBalanceAmount(playerId: string, data: any) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (data.clubId === '') {
    errors.push('ClubId is a mandatory field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return await ChipsTrackRepository.getClubBalance(data.clubId);
}

export async function getPlayerBalanceAmount(playerId: string, data: any) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (data.clubId === '') {
    errors.push('ClubId is mandatory field');
  }
  if (data.playerId === '') {
    errors.push('PlayerId is mandatory field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return await ChipsTrackRepository.getPlayerBalance(
    data.playerId,
    data.clubId
  );
}

const resolvers: any = {
  Query: {
    clubBalance: async (parent, args, ctx, info) => {
      return getClubBalanceAmount(ctx.req.playerId, args);
    },

    playerBalance: async (parent, args, ctx, info) => {
      return getPlayerBalanceAmount(ctx.req.playerId, args);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
