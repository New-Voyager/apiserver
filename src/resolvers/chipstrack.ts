import * as _ from 'lodash';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {GameUpdatesRepository} from '@src/repositories/gameupdates';

const logger = getLogger('resolvers::chipstrack');

export async function getRakeCollected(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return await GameUpdatesRepository.getRakeCollected(playerId, gameCode);
}

const resolvers: any = {
  Query: {
    rakeCollected: async (parent, args, ctx, info) => {
      return getRakeCollected(ctx.req.playerId, args.gameCode);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
