import {Firebase} from '@src/firebase';

const resolvers: any = {
  Query: {
    availableIapProducts: async (parent, args, ctx, info) => {
      return Firebase.getAvailableProducts();
    },
  },
};

export function getResolvers() {
  return resolvers;
}
