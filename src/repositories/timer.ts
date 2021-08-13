import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {NextHandUpdates, PokerGame} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';
import {pendingProcessDone, playerStatusChanged} from '@src/gameserver';
import {getLogger} from '@src/utils/log';
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
} from './types';
import {WaitListMgmt} from './waitlist';
import {getGameRepository, getUserRepository} from '.';

const logger = getLogger('timer');

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

  logger.info(
    `Timer callback for game: ${gameID} player: ${playerID} purpose: ${purpose}`
  );

  try {
    if (purpose === WAITLIST_SEATING) {
      await waitlistTimeoutExpired(gameID, playerID);
      // } else if (purpose === SEATCHANGE_PROGRSS) {
      //   await seatChangeTimeoutExpired(gameID);
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
    }
  } catch (err) {
    logger.error(`Error in timer callback: ${err.message}`);
  }
  resp.status(200).send({status: 'OK'});
}

export async function waitlistTimeoutExpired(gameID: number, playerID: number) {
  logger.info(
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
  logger.info(`Seat change timeout expired. GameID: ${gameID}`);

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
      logger.info(
        `[${game.gameCode}] Buyin timeout expired. player: ${player.name}`
      );

      const buyIn = new BuyIn(game, player);
      buyIn.timerExpired();
    }
  }
}

export async function buyInApprovalTimeoutExpired(
  gameID: number,
  playerID: number
) {
  logger.info(
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
      logger.info(
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
  logger.info(
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
  logger.info(
    `Dealer choice timeout expired. GameID: ${gameID}, playerID: ${playerID}`
  );
  // pending updates done (resume game)
  const game = await Cache.getGameById(gameID);
  let gameStatus: GameStatus = GameStatus.ACTIVE;
  let tableStatus: TableStatus = TableStatus.GAME_RUNNING;
  if (game) {
    gameStatus = game.status;
    tableStatus = game.tableStatus;
  }
  await pendingProcessDone(gameID, gameStatus, tableStatus);
}
