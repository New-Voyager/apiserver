import {getLogger, errToLogString} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {default as _} from 'lodash';
import {isHostOrManagerOrOwner} from './util';
import {GamePlayerSettings} from '@src/repositories/types';
import {GameSettingsRepository} from '@src/repositories/gamesettings';
import {PlayersInGameRepository} from '@src/repositories/playersingame';
import {GameNotFoundError} from '@src/errors';

const logger = getLogger('resolvers::gamesettings');

const resolvers: any = {
  Query: {
    gameSettings: async (parent, args, ctx, info) => {
      return await gameSettings(ctx.req.playerId, args.gameCode);
    },
    myGameSettings: async (parent, args, ctx, info) => {
      return await myGameSettings(ctx.req.playerId, args.gameCode);
    },
  },
  Mutation: {
    updateGameSettings: async (parent, args, ctx, info) => {
      return updateGameSettings(ctx.req.playerId, args.gameCode, args.settings);
    },
    updateGamePlayerSettings: async (parent, args, ctx, info) => {
      return updateGamePlayerSettings(
        ctx.req.playerId,
        args.gameCode,
        args.settings as GamePlayerSettings
      );
    },
  },
};

export async function gameSettings(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const gameSettings = await GameSettingsRepository.get(gameCode);
    if (!gameSettings) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    if (gameSettings.bombPotInterval) {
      gameSettings.bombPotInterval = Math.floor(
        gameSettings.bombPotInterval / 60
      );
    }
    if (gameSettings.waitlistSittingTimeout) {
      gameSettings.waitlistSittingTimeout = Math.floor(
        gameSettings.waitlistSittingTimeout / 60
      );
    }
    const roeGames = gameSettings.roeGames;
    const dealerChoiceGames = gameSettings.dealerChoiceGames;
    const gameSettingsRet = gameSettings as any;
    gameSettingsRet.roeGames = [];
    gameSettingsRet.dealerChoiceGames = [];
    if (roeGames) {
      gameSettingsRet.roeGames = roeGames.split(',');
    }
    if (dealerChoiceGames) {
      gameSettingsRet.dealerChoiceGames = dealerChoiceGames.split(',');
    }

    return gameSettingsRet;
  } catch (err) {
    logger.error(
      `Error while getting game settings. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Getting game settings failed`);
  }
}

export async function myGameSettings(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    // const gameSettings = await GameSettingsRepository.get(gameCode);
    // if (!gameSettings) {
    //   throw new Error(`Game ${gameCode} is not found`);
    // }
    // return gameSettings;
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }
    const player = await Cache.getPlayer(playerUuid);
    const playerSettings = await PlayersInGameRepository.getPlayerGameSettings(
      player,
      game
    );
    return playerSettings;
  } catch (err) {
    logger.error(
      `Error while getting game settings. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Getting game settings failed`);
  }
}
export async function updateGameSettings(
  playerId: string,
  gameCode: string,
  settings: any
): Promise<boolean> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }
    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot end the game`
      );
      throw new Error(
        `Player: ${playerId} is not a own9er or a manager ${game.clubName}. Cannot end the game`
      );
    }

    // update game settings
    await GameSettingsRepository.update(game, gameCode, settings);
    return true;
  } catch (err) {
    logger.error(
      `Error while updating game settings. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed updating game settings:  ${err.message}. Game code: ${gameCode}`
    );
  }
}

export async function updateGamePlayerSettings(
  playerId: string,
  gameCode: string,
  settings: GamePlayerSettings
): Promise<boolean> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }
    const player = await Cache.getPlayer(playerId);
    // update player game settings
    return PlayersInGameRepository.updatePlayerGameSettings(
      player,
      game,
      settings
    );
  } catch (err) {
    logger.error(
      `Error while updating player settings. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed while updating player settings:  ${err.message}. Game code: ${gameCode}`
    );
  }
}
export function getResolvers() {
  return resolvers;
}
