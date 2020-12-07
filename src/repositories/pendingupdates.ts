import {getRepository, getConnection, Not, IsNull} from 'typeorm';
import {isPostgres} from '@src/utils';
import {GameStatus, NextHandUpdate, PlayerStatus} from '@src/entity/types';
import {GameRepository} from './game';
import {getLogger} from '@src/utils/log';
import {NextHandUpdates, PokerGame, PokerGameUpdates} from '@src/entity/game';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {pendingProcessDone, playerKickedOut} from '@src/gameserver';
import {occupiedSeats, WaitListMgmt} from './waitlist';
import {SeatChangeProcess} from './seatchange';

const logger = getLogger('pending-updates');

export async function processPendingUpdates(gameId: number) {
  // this flag indicates whether we need to start seat change process or not
  // seat change is done, only if a player leaves, kicked out, or left due to connection issues
  let newOpenSeat = false;

  const gameRespository = getRepository(PokerGame);
  const game = await gameRespository.findOne({id: gameId});
  if (!game) {
    throw new Error(`Game: ${gameId} is not found`);
  }
  const gameUpdatesRepo = getRepository(PokerGameUpdates);
  const gameUpdate = await gameUpdatesRepo.findOne({gameID: game.id});
  if (!gameUpdate) {
    return;
  }

  logger.info(`Processing pending updates for game id: ${game.gameCode}`);
  if (gameUpdate.seatChangeInProgress) {
    logger.info(
      `Seat change is in progress for game id: ${game.gameCode}. No updates will be performed.`
    );
    return;
  }

  // if there is an end game update, let us end the game first
  let placeHolder1 = '$1';
  let placeHolder2 = '$2';
  if (!isPostgres()) {
    placeHolder1 = '?';
    placeHolder2 = '?';
  }
  const query = `SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ${placeHolder1} AND new_update = ${placeHolder2}`;
  const resp = await getConnection().query(query, [
    gameId,
    NextHandUpdate.END_GAME,
  ]);
  if (resp[0]['updates'] > 0) {
    // game ended
    await GameRepository.markGameStatus(gameId, GameStatus.ENDED);
    return;
  }

  const pendingUpdatesRepo = getRepository(NextHandUpdates);
  const updates = await pendingUpdatesRepo.find({
    relations: ['game', 'player'],
    where: {
      game: {id: gameId},
    },
  });

  if (updates.length === 0) {
    return;
  }
  const playerGameTrackerRepository = getRepository(PlayerGameTracker);

  for (const update of updates) {
    // walk through each update
    if (update.newUpdate === NextHandUpdate.KICKOUT) {
      // kick out a player
      await kickoutPlayer(
        playerGameTrackerRepository,
        game,
        update,
        pendingUpdatesRepo
      );
      newOpenSeat = true;
    }
  }

  let endPendingProcess = true;
  let seatChangeInProgress = false;
  const seats = await occupiedSeats(game.id);
  if (game.seatChangeAllowed) {
    if (newOpenSeat && seats < game.maxPlayers) {
      // open seat
      endPendingProcess = false;
      const seatChangeProcess = new SeatChangeProcess(game);
      await seatChangeProcess.start();
      seatChangeInProgress = true;
    }
  }

  if (!seatChangeInProgress && game.waitlistAllowed) {
    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.runWaitList();
  }

  if (endPendingProcess) {
    await pendingProcessDone(gameId);
  }
}

async function kickoutPlayer(
  playerGameTrackerRepository: any,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo
) {
  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      player: {id: update.player.id},
    },
    {
      status: PlayerStatus.KICKED_OUT,
      seatNo: 0,
    }
  );

  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      player: {id: update.player.id},
    },
  });

  const count = await playerGameTrackerRepository.count({
    where: {
      game: {id: game.id},
      status: PlayerStatus.PLAYING,
    },
  });

  const gameUpdatesRepo = getRepository(PokerGameUpdates);
  await gameUpdatesRepo.update(
    {
      gameID: game.id,
    },
    {playersInSeats: count}
  );

  if (playerInGame) {
    // notify game server, player is kicked out
    playerKickedOut(game, update.player, playerInGame.seatNo);
  }
  // delete this update
  pendingUpdatesRepo.delete({id: update.id});
}
