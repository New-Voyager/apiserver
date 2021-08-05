import {Firebase} from '@src/firebase';
const resolvers: any = {
  Query: {
    backgroundAssets: async (parent, args, ctx, info) => {
      var list = await Firebase.getGameBackgroundAssets();
      return list;
    },
    tableAssets: async (parent, args, ctx, info) => {
      var list = await Firebase.getTableAssets();
      return list;
    },
  },
};

export function getResolvers() {
  return resolvers;
}
