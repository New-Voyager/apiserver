import {PlayerGameTracker} from '@src/entity/chipstrack';
import {NextHandUpdates, PokerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {NextHandUpdate, PlayerStatus} from '@src/entity/types';
import { playerStatusChanged } from '@src/gameserver';
import {getLogger} from '@src/utils/log';
import {getRepository} from 'typeorm';
import {SeatChangeProcess} from './seatchange';
import {
  SEATCHANGE_PROGRSS,
  WAITLIST_SEATING,
  BUYIN_TIMEOUT,
  BUYIN_APPROVAL_TIMEOUT,
  RELOAD_APPROVAL_TIMEOUT,
  NewUpdate,
} from './types';
import {WaitListMgmt} from './waitlist';

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

  if (purpose === WAITLIST_SEATING) {
    await waitlistTimeoutExpired(gameID, playerID);
  } else if (purpose === SEATCHANGE_PROGRSS) {
    await seatChangeTimeoutExpired(gameID);
  } else if (purpose === BUYIN_TIMEOUT) {
    await buyInTimeoutExpired(gameID, playerID);
  } else if (purpose === BUYIN_APPROVAL_TIMEOUT) {
    await buyInApprovalTimeoutExpired(gameID, playerID);
  } else if (purpose === RELOAD_APPROVAL_TIMEOUT) {
    await reloadApprovalTimeoutExpired(gameID, playerID);
  }

  resp.status(200).send({status: 'OK'});
}

export async function waitlistTimeoutExpired(gameID: number, playerID: number) {
  logger.info(
    `Wait list timer expired. GameID: ${gameID}, PlayerID: ${playerID}. Go to next player`
  );
  const gameRepository = getRepository(PokerGame);
  const game = await gameRepository.findOne({id: gameID});
  if (!game) {
    throw new Error(`Game: ${gameID} is not found`);
  }

  const waitlistMgmt = new WaitListMgmt(game);
  await waitlistMgmt.runWaitList();
}

export async function seatChangeTimeoutExpired(gameID: number) {
  logger.info(`Seat change timeout expired. GameID: ${gameID}`);
  const gameRepository = getRepository(PokerGame);
  const game = await gameRepository.findOne({id: gameID});
  if (!game) {
    throw new Error(`Game: ${gameID} is not found`);
  }
  const seatChange = new SeatChangeProcess(game);
  await seatChange.finish();
}

export async function buyInTimeoutExpired(gameID: number, playerID: number) {
  logger.info(
    `Buyin timeout expired. GameID: ${gameID}, playerID: ${playerID}`
  );
  const gameRepository = getRepository(PokerGame);
  const game = await gameRepository.findOne({id: gameID});
  if (!game) {
    throw new Error(`Game: ${gameID} is not found`);
  }

  const playerRepository = getRepository(Player);
  const player = await playerRepository.findOne({id: playerID});
  if (!player) {
    throw new Error(`Player: ${playerID} is not found`);
  }


  const playerGameTrackerRepository = getRepository(PlayerGameTracker);

  // find the player
  const playerInSeat = await playerGameTrackerRepository.findOne({
    relations: ['player'],
    where: {
      game: {id: game.id},
      player: {id: player.id},
    },
  });

  if (!playerInSeat) {
    // We shouldn't be here
    return;
  }

  if (playerInSeat.status == PlayerStatus.WAIT_FOR_BUYIN) {
    // buyin timeout expired

    // mark the player as not playing
    await playerGameTrackerRepository.update(
      {
        game: {id: game.id},
        player: {id: player.id},
      },
      {
        status: PlayerStatus.NOT_PLAYING,
        seatNo: 0,
      }
    );

    // update the clients with new status
    playerStatusChanged(game, player, playerInSeat.status, NewUpdate.BUYIN_TIMEDOUT, playerInSeat.seatNo);

  } else if(playerInSeat.status == PlayerStatus.PLAYING) {
    // cancel timer wasn't called (ignore the timeout callback)
  }
}

export async function buyInApprovalTimeoutExpired(
  gameID: number,
  playerID: number
) {
  logger.info(
    `Buyin approval timeout expired. GameID: ${gameID}, playerID: ${playerID}`
  );
  const gameRepository = getRepository(PokerGame);
  const game = await gameRepository.findOne({id: gameID});
  if (!game) {
    throw new Error(`Game: ${gameID} is not found`);
  }

  const playerRepository = getRepository(Player);
  const player = await playerRepository.findOne({id: playerID});
  if (!player) {
    throw new Error(`Player: ${playerID} is not found`);
  }

  // handle buyin approval timeout
  const nextHandUpdatesRepository = getRepository(NextHandUpdates);
  await nextHandUpdatesRepository
    .createQueryBuilder()
    .delete()
    .where({
      game: {id: gameID},
      player: {id: playerID},
      newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
    })
    .execute();

  const playerGameTrackerRepository = getRepository(PlayerGameTracker);
  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      player: {id: player.id},
    },
    {
      status: PlayerStatus.NOT_PLAYING,
      seatNo: 0,
    }
  );
}

export async function reloadApprovalTimeoutExpired(
  gameID: number,
  playerID: number
) {
  logger.info(
    `Reload approval timeout expired. GameID: ${gameID}, playerID: ${playerID}`
  );
  const gameRepository = getRepository(PokerGame);
  const game = await gameRepository.findOne({id: gameID});
  if (!game) {
    throw new Error(`Game: ${gameID} is not found`);
  }

  const playerRepository = getRepository(Player);
  const player = await playerRepository.findOne({id: playerID});
  if (!player) {
    throw new Error(`Player: ${playerID} is not found`);
  }

  // handle reload approval timeout
  const nextHandUpdatesRepository = getRepository(NextHandUpdates);
  await nextHandUpdatesRepository
    .createQueryBuilder()
    .delete()
    .where({
      game: {id: gameID},
      player: {id: playerID},
      newUpdate: NextHandUpdate.WAIT_RELOAD_APPROVAL,
    })
    .execute();

  const playerGameTrackerRepository = getRepository(PlayerGameTracker);
  const playerInGames = await playerGameTrackerRepository
    .createQueryBuilder()
    .where({
      game: {id: game.id},
      player: {id: player.id},
    })
    .select('stack')
    .execute();

  const playerInGame = playerInGames[0];
  if (!playerInGame) {
    logger.error(`Player ${player.uuid} is not in the game: ${game.gameCode}`);
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
        player: {id: player.id},
      })
      .execute();
  }
}
