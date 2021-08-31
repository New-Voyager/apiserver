import {TakeBreak} from '@src/repositories/takebreak';
import {getRepository, Repository} from 'typeorm';
import {PokerGame, PokerGameUpdates} from '@src/entity/game/game';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {Cache} from '@src/cache';
import {WonAtStatus} from '@src/entity/types';
import {HandRepository} from '@src/repositories/hand';
import {getGameConnection, getGameRepository} from '@src/repositories';
import {getLogger} from '@src/utils/log';
const logger = getLogger('internal::hand');

function validateHandData(handData: any): Array<string> {
  const errors = new Array<string>();
  try {
    if (!handData.clubId && handData.clubId !== 0) {
      errors.push('clubId is missing');
    }
    if (!handData.gameId) {
      errors.push('gameId is missing');
    }
    if (!handData.handNum) {
      errors.push('handNum is missing');
    }
    if (!handData.handResult) {
      errors.push('handResult is missing');
    } else {
      if (!handData.handResult.potWinners) {
        errors.push('potWinners is missing');
      } else {
        if (!handData.handResult.potWinners[0]) {
          errors.push('potWinners of 0 is missing');
        } else {
          if (
            !handData.handResult.potWinners[0].hiWinners ||
            handData.handResult.potWinners[0].hiWinners.length === 0
          ) {
            errors.push('hiWinners are missing');
          }
        }
      }
      if (!handData.handResult.handStartedAt) {
        errors.push('handStartedAt is missing');
      }
      if (!handData.handResult.handEndedAt) {
        errors.push('handEndedAt is missing');
      }
      if (
        !handData.handResult.playersInSeats ||
        handData.handResult.playersInSeats.length === 0
      ) {
        errors.push('playersInSeats is missing');
      }
      if (!handData.handResult.wonAt) {
        errors.push('wonAt is missing');
      } else {
        if (
          handData.handResult.wonAt !== WonAtStatus[WonAtStatus.FLOP] &&
          handData.handResult.wonAtt !== WonAtStatus[WonAtStatus.PREFLOP] &&
          handData.handResult.wonAt !== WonAtStatus[WonAtStatus.RIVER] &&
          handData.handResult.wonAt !== WonAtStatus[WonAtStatus.SHOW_DOWN] &&
          handData.handResult.wonAt !== WonAtStatus[WonAtStatus.TURN]
        ) {
          errors.push('invalid wonAt field');
        }
      }
      if (!handData.handResult.tips) {
        errors.push('tips is missing');
      }
      if (
        !handData.handResult.balanceAfterHand ||
        handData.handResult.balanceAfterHand.length === 0
      ) {
        errors.push('balanceAfterHand are missing');
      }
    }
    if (handData.handResult.qualifyingPromotionWinner) {
      if (!handData.handResult.qualifyingPromotionWinner.promoId) {
        errors.push('promoId field is missing');
      }
      if (!handData.handResult.qualifyingPromotionWinner.playerId) {
        errors.push('playerId field is missing');
      }
    }
  } catch (err) {
    errors.push('INTERNAL');
    return errors;
  }
  return errors;
}

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
      return;
    }
    const handNum = parseInt(req.params.handNum, 10);
    if (!handNum) {
      const res = {error: 'Invalid hand number'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    try {
      const result = req.body;
      if (result.result?.timeoutStats) {
        await processConsecutiveActionTimeouts(
          gameID,
          handNum,
          result.result.timeoutStats
        );
      } else {
        logger.warn(
          `No timeoutStats present in hand result of game ${gameID} hand ${handNum}. Consecutive timeout counts will not be processed.`
        );
      }
      const saveResult = await saveHand(gameID, handNum, result);
      if (saveResult.success) {
        resp.status(200).send(saveResult);
        return;
      } else {
        resp.status(500).send(saveResult);
      }
    } catch (err) {
      resp.status(500).send({error: err.message});
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
  gameID: number,
  handNum: number,
  timeoutStats: any
) {
  const maxAllowedTimeouts = 4;

  const gameRespository: Repository<PokerGame> = getGameRepository(PokerGame);
  const game: PokerGame | undefined = await gameRespository.findOne({
    id: gameID,
  });
  if (!game) {
    throw new Error(
      `Unable to find game with ID ${gameID} while processing consecutive action timeouts`
    );
  }

  await getGameConnection().transaction(async transactionEntityManager => {
    const pokerGameUpdatesRepo: Repository<PokerGameUpdates> = transactionEntityManager.getRepository(
      PokerGameUpdates
    );
    const pokerGameUpdates:
      | PokerGameUpdates
      | undefined = await pokerGameUpdatesRepo.findOne({
      gameID: gameID,
    });
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

    const playerGameTrackerRepository: Repository<PlayerGameTracker> = transactionEntityManager.getRepository(
      PlayerGameTracker
    );

    const playersInGameArr: Array<PlayerGameTracker> = await playerGameTrackerRepository.find(
      {
        game: {id: gameID},
      }
    );
    if (!playersInGameArr) {
      throw new Error(
        `Unable to find player tracker records with game ID ${gameID} while processing consecutive action timeouts`
      );
    }

    const playersInGame = Object.assign(
      {},
      ...playersInGameArr.map(p => ({[p.playerId]: p}))
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
        throw new Error(
          `Unable to find player tracker with game ID ${gameID} and player ID ${playerID} while processing consecutive action timeouts`
        );
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

      if (newTimeouts != prevTimeouts) {
        await playerGameTrackerRepository
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
    await pokerGameUpdatesRepo
      .createQueryBuilder()
      .update()
      .where({gameID: gameID})
      .set({lastConsecutiveTimeoutProcessedHand: handNum})
      .execute();

    if (shouldUpdateCache) {
      await Cache.updateGamePendingUpdates(game.gameCode, true);
    }
  });
}
