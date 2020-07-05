const resolvers: any = {
  Query: {
    hello: async (parent, args, ctx, info) => {
      return 'World';
    },
  },
};

export function getResolvers() {
  return resolvers;
}
