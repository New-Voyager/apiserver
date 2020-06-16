import {PlayerRepository} from "@src/repositories/player";

const resolvers: any = {
    Mutation: {
        createPlayer: async (parent, args, ctx, info) => {
          let errors = new Array<string>();
          if(!args.player) {
            errors.push("player object not found");
          }
          if(args.player.name === "") {
            errors.push("name is a required field");
          }
          if(args.player.deviceId === "") {
            errors.push("deviceId is a required field");
          }
          if(errors.length > 0) {
            throw new Error(errors.join("\n"));
          }

          try {
            const playerInput = args.player;
            return PlayerRepository.createPlayer(playerInput.name, playerInput.deviceId);
          } catch(err) {
            console.log(err);
            throw new Error("Failed to register Player");
          }
        }
    },
};

export function getResolvers() {
    return resolvers;
}
