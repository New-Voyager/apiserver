import {Firebase} from '@src/firebase';
const resolvers: any = {
  Query: {
    firebaseSettings: async (parent, args, ctx, info) => {
      return Firebase.getSettings();
    },
  },
};

export function getResolvers() {
  return resolvers;
}
