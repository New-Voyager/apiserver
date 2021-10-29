import {Firebase} from '@src/firebase';
const resolvers: any = {
  Query: {
    firebaseSettings: async (parent, args, ctx, info) => {
      return Firebase.getSettings(ctx.req.playerId);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
