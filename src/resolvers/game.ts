import {GameRepository} from "@src/repositories/game";

const resolvers: any = {
    Mutation: {
      startGame: async (parent, args, ctx, info) => {
          if(!ctx.req.playerId) {
            throw new Error(`Unauthorized`);
          }

          let errors = new Array<string>();
          if(errors.length > 0) {
            throw new Error(errors.join("\n"));
          }
          try {
            const gameInfo = await GameRepository.createPrivateGame(args.clubId, ctx.req.playerId, args.game);
            return gameInfo;
          } catch(err) {
            console.log(err);
            throw new Error("Failed to create a new game. Please retry");
          }
        }
    },
};

export function getResolvers() {
    return resolvers;
}
