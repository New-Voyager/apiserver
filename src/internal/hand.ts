import {TakeBreak} from '@src/repositories/takebreak';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {Cache} from '@src/cache';
import {WonAtStatus} from '@src/entity/types';
import {HandRepository} from '@src/repositories/hand';
import {getGameConnection} from '@src/repositories';
import {errToStr, getLogger} from '@src/utils/log';
import {PlayersInGameRepository} from '@src/repositories/playersingame';
import _ from 'lodash';
import {GameUpdatesRepository} from '@src/repositories/gameupdates';
import {gameLogPrefix, PokerGameUpdates} from '@src/entity/game/game';
const logger = getLogger('internal::hand');

/**
 * Hand Server API class
 */
class HandServerAPIs {
  public async postHand(req: any, resp: any) {
    resp.status(200).send({status: 'OK'});
    return;
    // const gameID = parseInt(req.params.gameId, 10);
    // if (!gameID) {
    //   const res = {error: 'Invalid game id'};
    //   resp.status(500).send(JSON.stringify(res));
    //   return;
    // }
    // const handNum = parseInt(req.params.handNum, 10);
    // if (!handNum) {
    //   const res = {error: 'Invalid hand number'};
    //   resp.status(500).send(JSON.stringify(res));
    //   return;
    // }
    // const result = req.body;
    // if (result.playerStats) {
    //   // It seems that result.playerStats can be undefined in system tests.
    //   await processConsecutiveActionTimeouts(gameID, result.playerStats);
    // }
    // const saveResult = await postHand(gameID, handNum, result);
    // if (saveResult.success) {
    //   resp.status(200).send(saveResult);
    // } else {
    //   resp.status(500).send(saveResult);
    // }
  }

  public async saveHand(req: any, resp: any) {
    const gameID = parseInt(req.params.gameId, 10);
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      logger.error(`Finished saveHand endpoint game ${gameID} 500`);
      return;
    }
    const handNum = parseInt(req.params.handNum, 10);
    if (!handNum) {
      const res = {error: 'Invalid hand number'};
      resp.status(500).send(JSON.stringify(res));
      logger.error(`Finished saveHand endpoint game ${gameID} 500`);
      return;
    }
    let processedConsecutiveTimeouts = false;
    try {
      const game = await Cache.getGameById(gameID);
      if (!game) {
        throw new Error(`Game: ${gameID} is not found`);
      }
      logger.info(
        `[${gameLogPrefix(
          game
        )}] Starting saveHand endpoint game ${gameID} hand ${handNum}`
      );
      const result = req.body;
      if (result.result?.timeoutStats) {
        await processConsecutiveActionTimeouts(
          game?.gameCode,
          gameID,
          handNum,
          result.result.timeoutStats
        );
      } else {
        logger.warn(
          `No timeoutStats present in hand result of game ${gameID} hand ${handNum}. Consecutive timeout counts will not be processed.`
        );
      }
      processedConsecutiveTimeouts = true;
      const saveResult = await saveHand(gameID, handNum, result);
      if (saveResult.success) {
        resp.status(200).send(saveResult);
        logger.info(
          `[${gameLogPrefix(
            game
          )}] Finished saveHand endpoint game ${gameID} hand ${handNum}`
        );
        return;
      } else {
        logger.error(
          `[${gameLogPrefix(
            game
          )}] Error while saving hand for game ${gameID} hand ${handNum}. saveResult is not success. saveResult: ${JSON.stringify(
            saveResult
          )}`
        );
        resp.status(500).send(saveResult);
      }
    } catch (err) {
      logger.error(
        `Error while saving hand for game ${gameID} hand ${handNum}. Error: ${errToStr(
          err
        )}. (processedConsecutiveTimeouts = ${processedConsecutiveTimeouts})`
      );
      resp.status(500).send({error: errToStr(err)});
    }
    logger.info(`Finished saveHand endpoint game ${gameID} hand ${handNum}`);
  }

  public async saveHandBinary(req: any, resp: any) {
    const gameID = parseInt(req.params.gameId, 10);
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const handNum = parseInt(req.params.handNum, 10);
    if (!handNum) {
      const res = {error: 'Invalid hand number'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    try {
      throw new Error('Unsupported');
      // const game = await Cache.getGameById(gameID);
      // if (!game) {
      //   throw new Error(`Game: ${gameID} is not found`);
      // }
      // const resultBinary: Uint8Array = toArrayBuffer(req.rawBody);
      // const handResultServer = HandResultServer.deserializeBinary(resultBinary);
      // const result = JSON.parse(
      //   JSON.stringify(handResultServer.toObject(false))
      // );

      // // result in binary format
      // // convert to json

      // if (result.result?.timeoutStats) {
      //   await processConsecutiveActionTimeouts(
      //     game?.gameCode,
      //     gameID,
      //     handNum,
      //     result.result.timeoutStatsMap
      //   );
      // } else {
      //   logger.warn(
      //     `No timeoutStats present in hand result of game ${gameID} hand ${handNum}. Consecutive timeout counts will not be processed.`
      //   );
      // }
      // const saveResult = await saveHand(gameID, handNum, result);
      // if (saveResult.success) {
      //   resp.status(200).send(saveResult);
      //   return;
      // } else {
      //   resp.status(500).send(saveResult);
      // }
    } catch (err) {
      resp.status(500).send({error: errToStr(err)});
    }
  }
}

export const HandServerAPI = new HandServerAPIs();

export async function postHand(gameID: number, handNum: number, result: any) {
  //const res = await HandRepository.saveHandNew(gameID, handNum, result);
  //return res;
  return {};
}

export async function saveHand(gameID: number, handNum: number, result: any) {
  const res = await HandRepository.saveHand(gameID, handNum, result);
  return res;
}

async function processConsecutiveActionTimeouts(
  gameCode: string,
  gameID: number,
  handNum: number,
  timeoutStats: any
) {
  const maxAllowedTimeouts = 4;

  const game = await Cache.getGameById(gameID);
  if (!game) {
    throw new Error(
      `Unable to find game with ID ${gameID} while processing consecutive action timeouts`
    );
  }
  await getGameConnection().transaction(async transactionEntityManager => {
    const pokerGameUpdates = await GameUpdatesRepository.get(
      gameCode,
      false,
      transactionEntityManager
    );
    if (!pokerGameUpdates) {
      throw new Error(
        `Unable to entry in poker game updates repo with game ID ${gameID} while processing consecutive action timeouts`
      );
    }
    if (pokerGameUpdates.lastConsecutiveTimeoutProcessedHand >= handNum) {
      logger.warn(
        `Consecutive action timeouts were already processed for game ${gameID} hand ${pokerGameUpdates.lastConsecutiveTimeoutProcessedHand}. Skipping the processing for hand ${handNum}`
      );
      return;
    }

    const playersInGameArr = await PlayersInGameRepository.getPlayersInSeats(
      gameID,
      transactionEntityManager
    );

    const playersInGame = _.keyBy(playersInGameArr, 'playerId');
    const playersInGameRepo = transactionEntityManager.getRepository(
      PlayerGameTracker
    );
    let shouldUpdateCache = false;
    for (const playerIdStr of Object.keys(timeoutStats)) {
      const currentHandTimeouts =
        timeoutStats[playerIdStr].consecutiveActionTimeouts;
      const didTheTimeoutsResetInCurrentHand =
        timeoutStats[playerIdStr].isConsecutiveActionTimeoutsReset;

      const playerID = parseInt(playerIdStr);
      const playerInGame: PlayerGameTracker | undefined =
        playersInGame[playerID];
      if (!playerInGame) {
        logger.warn(
          `Unable to find player tracker with game ID ${gameID} and player ID ${playerID} while processing consecutive action timeouts`
        );
        continue;
      }

      const prevTimeouts: number = playerInGame.consecutiveActionTimeouts;
      let newTimeouts: number;
      if (didTheTimeoutsResetInCurrentHand) {
        newTimeouts = currentHandTimeouts;
      } else {
        newTimeouts = prevTimeouts + currentHandTimeouts;
      }

      if (
        prevTimeouts <= maxAllowedTimeouts &&
        newTimeouts > maxAllowedTimeouts
      ) {
        // Put the player in break.
        const player = await Cache.getPlayerById(playerID);
        const takeBreak = new TakeBreak(game, player);
        await takeBreak.takeBreak(transactionEntityManager);
        shouldUpdateCache = true;
        newTimeouts = 0;
      }

      if (newTimeouts !== prevTimeouts) {
        await playersInGameRepo
          .createQueryBuilder()
          .update()
          .where({
            game: {id: gameID},
            playerId: playerID,
          })
          .set({
            consecutiveActionTimeouts: newTimeouts,
          })
          .execute();
      }
    }

    // Remember that we processed the consecutive timeout counts for this hand,
    // so that we don't add the count again if the game server crashes
    // and this function gets called again.
    const pokerGameUpdatesRepo = transactionEntityManager.getRepository(
      PokerGameUpdates
    );
    await pokerGameUpdatesRepo
      .createQueryBuilder()
      .update()
      .where({gameCode: game.gameCode})
      .set({lastConsecutiveTimeoutProcessedHand: handNum})
      .execute();

    if (shouldUpdateCache) {
      await Cache.updateGamePendingUpdates(game.gameCode, true);
    }
  });

  await GameUpdatesRepository.get(game.gameCode, true);
}

function toArrayBuffer(buf): Uint8Array {
  var ab = new ArrayBuffer(buf.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return view;
}
