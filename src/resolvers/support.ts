import {Cache} from '@src/cache/index';
import {DevRepository} from '@src/repositories/dev';

async function reportBug(playerId: string, bug: string) {
  const player = await Cache.getPlayer(playerId);
  return await DevRepository.reportBug(player, bug);
}

async function requestFeature(playerId: string, bug: string) {
  const player = await Cache.getPlayer(playerId);
  return await DevRepository.requestFeature(player, bug);
}

const resolvers: any = {
  Mutation: {
    reportBug: async (parent, args, ctx, info) => {
      return reportBug(ctx.req.playerId, args.bug);
    },
    requestFeature: async (parent, args, ctx, info) => {
      return requestFeature(ctx.req.playerId, args.feature);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
