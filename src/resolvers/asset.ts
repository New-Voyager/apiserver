import {Firebase} from '@src/firebase';
const resolvers: any = {
  Query: {
    getBackgroundAssets: async (parent, args, ctx, info) => {
      var list =await Firebase.getBackGroundAssets();
      return list;
    },
  },
  
};

export function getResolvers() {
  return resolvers;
}
