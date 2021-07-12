import {TakeBreak} from '@src/repositories/takebreak';
import {getRepository, Repository} from 'typeorm';
import {PokerGame} from '@src/entity/game/game';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {Cache} from '@src/cache';
import {WonAtStatus} from '@src/entity/types';
import {HandRepository} from '@src/repositories/hand';
import {getGameRepository} from '@src/repositories';

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
    const result = req.body;
    if (result.playerStats) {
      // It seems that result.playerStats can be undefined in system tests.
      await processConsecutiveActionTimeouts(gameID, result.playerStats);
    }
    const saveResult = await postHand(gameID, handNum, result);
    if (saveResult.success) {
      resp.status(200).send(saveResult);
    } else {
      resp.status(500).send(saveResult);
    }
  }
}

export const HandServerAPI = new HandServerAPIs();

export async function postHand(gameID: number, handNum: number, result: any) {
  const res = await HandRepository.saveHandNew(gameID, handNum, result);
  return res;
}

async function processConsecutiveActionTimeouts(
  gameID: number,
  playerStats: any
) {
  // TODO: Make this function idempotent.
  // Add hand number to the player_action_tracker table and check it
  // before accumulating the timeout counts so that we don't add the count multiple times
  // and put the player in break prematurely if game server crashes and this
  // function gets called more than once.

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
  const playerGameTrackerRepository: Repository<PlayerGameTracker> = getGameRepository(
    PlayerGameTracker
  );

  for (const playerIdStr of Object.keys(playerStats)) {
    const currentHandTimeouts =
      playerStats[playerIdStr].consecutiveActionTimeouts;
    const didTheTimeoutsResetInCurrentHand =
      playerStats[playerIdStr].isConsecutiveActionTimeoutsReset;

    const playerID = parseInt(playerIdStr);
    const playerInGame:
      | PlayerGameTracker
      | undefined = await playerGameTrackerRepository.findOne({
      game: {id: gameID},
      playerId: playerID,
    });
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
      await takeBreak.takeBreak();
      newTimeouts = 0;
    }

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

  if (game) {
    await Cache.updateGamePendingUpdates(game.gameCode, true);
  }
}
