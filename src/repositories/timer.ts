import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {NextHandUpdates, PokerGame} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';
import {errToStr, getLogger} from '@src/utils/log';
import {BuyIn} from './buyin';
import {SeatChangeProcess} from './seatchange';
import {breakTimeoutExpired} from './takebreak';
import {Cache} from '@src/cache/index';
import {
  SEATCHANGE_PROGRSS,
  WAITLIST_SEATING,
  BUYIN_TIMEOUT,
  BUYIN_APPROVAL_TIMEOUT,
  RELOAD_APPROVAL_TIMEOUT,
  NewUpdate,
  DEALER_CHOICE_TIMEOUT,
  BREAK_TIMEOUT,
  PLAYER_SEATCHANGE_PROMPT,
  GAME_COIN_CONSUME_TIME,
  CHECK_AVAILABLE_COINS,
} from './types';
import {WaitListMgmt} from './waitlist';
import {getGameRepository, getUserRepository} from '.';
import {resumeGame} from '@src/gameserver';
import {AppCoinRepository} from './appcoin';
import {TournamentRepository} from './tournament';

const logger = getLogger('repositories::timer');

export async function timerCallback(req: any, resp: any) {
  const gameID = req.params.gameID;
  if (!gameID) {
    const res = {error: 'Invalid game id'};
    resp.status(500).send(JSON.stringify(res));
    return;
  }

  const playerID = req.params.playerID;
  if (!playerID) {
    const res = {error: 'Invalid player id'};
    resp.status(500).send(JSON.stringify(res));
    return;
  }

  const purpose = req.params.purpose;
  if (!purpose) {
    const res = {error: 'Invalid player id'};
    resp.status(500).send(JSON.stringify(res));
    return;
  }

  logger.debug(
    `Timer callback for game: ${gameID} player: ${playerID} purpose: ${purpose}`
  );

  await timerCallbackHandler(gameID, playerID, purpose);
  resp.status(200).send({status: 'OK'});
}

export async function timerCallbackHandler(
  gameID: number,
  playerID: number,
  purpose: string
) {
  try {
    if (purpose === WAITLIST_SEATING) {
      await waitlistTimeoutExpired(gameID, playerID);
    } else if (purpose === BUYIN_TIMEOUT) {
      await buyInTimeoutExpired(gameID, playerID);
    } else if (purpose === BUYIN_APPROVAL_TIMEOUT) {
      await buyInApprovalTimeoutExpired(gameID, playerID);
    } else if (purpose === RELOAD_APPROVAL_TIMEOUT) {
      await reloadApprovalTimeoutExpired(gameID, playerID);
    } else if (purpose === DEALER_CHOICE_TIMEOUT) {
      await dealerChoiceTimeout(gameID, playerID);
    } else if (purpose === BREAK_TIMEOUT) {
      await breakTimeoutExpired(gameID, playerID);
    } else if (purpose === PLAYER_SEATCHANGE_PROMPT) {
      await playerSeatChangeTimeoutExpired(gameID, playerID);
    } else if (purpose === GAME_COIN_CONSUME_TIME) {
      await gameConsumeTime(gameID);
    } else if (purpose === CHECK_AVAILABLE_COINS) {
      await gameCheckAvailableCoins(gameID);
    }
  } catch (err) {
    logger.error(`Error in timer callback: ${errToStr(err)}`);
  }
}

export async function timerGenericCallback(req: any, resp: any) {
  resp.status(200).send({status: 'OK'});

  const payload = JSON.parse(req.body.payload);
  if (payload.purpose === 'LEVEL_TIMEOUT') {
    TournamentRepository.handleLevelTimeout(payload).catch(err => {
      logger.error(`handling level timeout failed: ${errToStr(err)}`);
    });
  }
}

export async function waitlistTimeoutExpired(gameID: number, playerID: number) {
  logger.debug(
    `Wait list timer expired. GameID: ${gameID}, PlayerID: ${playerID}. Go to next player`
  );
  const game = await Cache.getGameById(gameID);
  if (!game) {
    throw new Error(`Game: ${gameID} is not found`);
  }

  const waitlistMgmt = new WaitListMgmt(game);
  await waitlistMgmt.runWaitList();
}

// export async function seatChangeTimeoutExpired(gameID: number) {
//   logger.info(`Seat change timeout expired. GameID: ${gameID}`);

//   const gameRepository = getRepository(PokerGame);
//   const game = await gameRepository.findOne({id: gameID});
//   if (!game) {
//     logger.error(`Game: ${gameID} is not found`);
//   } else {
//     const seatChange = new SeatChangeProcess(game);
//     await seatChange.finish();
//   }
// }

export async function playerSeatChangeTimeoutExpired(
  gameID: number,
  playerID: number
) {
  logger.debug(`Seat change timeout expired. GameID: ${gameID}`);

  const game = await Cache.getGameById(gameID);
  if (!game) {
    logger.error(`Game: ${gameID} is not found`);
  } else {
    const seatChange = new SeatChangeProcess(game);
    await seatChange.timerExpired(playerID);
  }
}

export async function buyInTimeoutExpired(gameID: number, playerID: number) {
  const game = await Cache.getGameById(gameID);
  if (!game) {
    logger.error(`Game: ${gameID} is not found`);
  } else {
    const player = await Cache.getPlayerById(playerID);
    if (!player) {
      logger.error(`Player: ${playerID} is not found`);
    } else {
      logger.debug(
        `[${game.gameCode}] Buyin timeout expired. player: ${player.name}`
      );

      const buyIn = new BuyIn(game, player);
      await buyIn.timerExpired();
    }
  }
}

export async function buyInApprovalTimeoutExpired(
  gameID: number,
  playerID: number
) {
  logger.debug(
    `Buyin approval timeout expired. GameID: ${gameID}, playerID: ${playerID}`
  );
  const game = await Cache.getGameById(gameID);
  if (!game) {
    logger.error(`Game: ${gameID} is not found`);
  } else {
    const player = await Cache.getPlayerById(playerID);
    if (!player) {
      logger.error(`Player: ${playerID} is not found`);
    } else {
      logger.debug(
        `[${game.gameCode}] Buyin timeout expired. player: ${player.name}`
      );
      // handle buyin approval timeout
      const nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
      await nextHandUpdatesRepository
        .createQueryBuilder()
        .delete()
        .where({
          game: {id: gameID},
          player: {id: playerID},
          newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
        })
        .execute();

      const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
      await playerGameTrackerRepository.update(
        {
          game: {id: game.id},
          playerId: player.id,
        },
        {
          status: PlayerStatus.NOT_PLAYING,
          seatNo: 0,
        }
      );
    }
  }
}

export async function reloadApprovalTimeoutExpired(
  gameID: number,
  playerID: number
) {
  logger.debug(
    `Reload approval timeout expired. GameID: ${gameID}, playerID: ${playerID}`
  );
  const game = await Cache.getGameById(gameID);
  if (!game) {
    logger.error(`Game: ${gameID} is not found`);
  } else {
    const player = await Cache.getPlayerById(playerID);
    if (!player) {
      logger.error(`Player: ${playerID} is not found`);
    } else {
      // handle reload approval timeout
      const nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
      await nextHandUpdatesRepository
        .createQueryBuilder()
        .delete()
        .where({
          game: {id: gameID},
          playerId: playerID,
          newUpdate: NextHandUpdate.WAIT_RELOAD_APPROVAL,
        })
        .execute();

      const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
      const playerInGames = await playerGameTrackerRepository
        .createQueryBuilder()
        .where({
          game: {id: game.id},
          playerId: player.id,
        })
        .select('stack')
        .execute();

      const playerInGame = playerInGames[0];
      if (!playerInGame) {
        logger.error(
          `Player ${player.uuid} is not in the game: ${game.gameCode}`
        );
        throw new Error(`Player ${player.uuid} is not in the game`);
      }

      if (playerInGame.stack <= 0) {
        await playerGameTrackerRepository
          .createQueryBuilder()
          .update()
          .set({
            status: PlayerStatus.NOT_PLAYING,
            seatNo: 0,
          })
          .where({
            game: {id: game.id},
            playerId: player.id,
          })
          .execute();
      }
    }
  }
}

export async function dealerChoiceTimeout(gameID: number, playerID: number) {
  logger.debug(
    `Dealer choice timeout expired. GameID: ${gameID}, playerID: ${playerID}`
  );
  await resumeGame(gameID);
}

export async function gameConsumeTime(gameID: number) {
  const game = await Cache.getGameById(gameID);
  if (!game) {
    logger.error(`Game: ${gameID} is not found. Game may have ended already`);
  } else {
    await AppCoinRepository.consumeGameCoins(game);
  }
}

export async function gameCheckAvailableCoins(gameID: number) {
  const game = await Cache.getGameById(gameID);
  if (!game) {
    logger.error(`Game: ${gameID} is not found. Game may have ended already`);
  } else {
    await AppCoinRepository.gameCheckAvailableCoins(game);
  }
}
