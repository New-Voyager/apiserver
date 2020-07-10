import {GameRepository} from '@src/repositories/game';
import {GameType} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
const logger = getLogger("game");

const resolvers: any = {
  Mutation: {
    startGame: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }

      const errors = new Array<string>();
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }
      try {
        const gameInfo = await GameRepository.createPrivateGame(
          args.clubId,
          ctx.req.playerId,
          args.game
        );
        const ret: any = gameInfo as any;
        ret.gameType = GameType[gameInfo.gameType];
        logger.debug(JSON.stringify(ret));
        return ret;
      } catch (err) {
        logger.error(err);
        throw new Error(`Failed to create a new game. ${JSON.stringify(err)}`);
      }
    },
  },
};

export function getResolvers() {
  return resolvers;
}
