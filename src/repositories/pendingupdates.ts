import {getRepository, getConnection, Not, IsNull} from 'typeorm';
import {isPostgres} from '@src/utils';
import {GameStatus, NextHandUpdate, PlayerStatus} from '@src/entity/types';
import {GameRepository} from './game';
import {getLogger} from '@src/utils/log';
import {NextHandUpdates, PokerGame, PokerGameUpdates} from '@src/entity/game';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {
  gameUpdate,
  pendingProcessDone,
  playerKickedOut,
  startTimer,
} from '@src/gameserver';
import {WAITLIST_SEATING} from './types';

const logger = getLogger('pending-updates');

export async function processPendingUpdates(gameId: number) {
  const gameRespository = getRepository(PokerGame);
  const game = await gameRespository.findOne({id: gameId});
  if (!game) {
    throw new Error(`Game: ${gameId} is not found`);
  }
  logger.info(`Processing pending updates for game id: ${game.gameCode}`);
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
    }
  }
  const seatsTaken = await occupiedSeats(gameId);
  if (seatsTaken < game.maxPlayers) {
    // open seats
    await runWaitList(gameId);
  }

  await pendingProcessDone(gameId);
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

async function occupiedSeats(gameId: number): Promise<number> {
  logger.info(`Processing pending updates for game id: ${gameId}`);
  // if there is an end game update, let us end the game first
  let placeHolder1 = '$1';
  let placeHolder2 = '$2';
  if (!isPostgres()) {
    placeHolder1 = '?';
    placeHolder2 = '?';
  }
  const query = `SELECT COUNT(*) as occupied FROM player_game_tracker WHERE pgt_game_id = ${placeHolder1} AND status = ${placeHolder2}`;
  const resp = await getConnection().query(query, [
    gameId,
    PlayerStatus.PLAYING,
  ]);
  return resp[0]['occupied'];
}

// get the first guy from the wait list
// if the timer expired, cancel the timer and change the user to status, NOT_PLAYING, waitingFrom: null, waitlist_sitting_exp: null
// if no-one is in the wait list, set waitlist seating in progress to false
// mark waitlist seating in progress to true
// update status: WAITLIST_SEATING waitlist_sitting_exp timeout
// start the timer
// notify game server to send message to players
export async function runWaitList(gameId: number) {
  const playerGameTrackerRepository = getRepository(PlayerGameTracker);

  // eslint-disable-next-line no-constant-condition
  // get the first guy from the wait list
  const waitingPlayers = await playerGameTrackerRepository.find({
    relations: ['game', 'player'],
    where: {
      game: {id: gameId},
      waitingFrom: Not(IsNull()),
    },
    order: {
      waitingFrom: 'ASC',
    },
  });
  if (waitingPlayers.length === 0) {
    logger.info(`Game: ${gameId} No players in the waiting list`);
    return;
  }

  let nextPlayer: PlayerGameTracker | null = null;
  for (const player of waitingPlayers) {
    // check the player status
    if (player.status === PlayerStatus.WAITLIST_SEATING) {
      const now = new Date();
      let expTime = 0;
      if (player.waitingListTimeExp !== null) {
        expTime = player.waitingListTimeExp.getTime();
      }
      if (expTime !== 0 && expTime <= now.getTime()) {
        // remove this player from the waiting list
        await playerGameTrackerRepository.update(
          {
            game: {id: gameId},
            player: {id: player.player.id},
          },
          {
            status: PlayerStatus.NOT_PLAYING,
            waitingFrom: null,
            waitingListTimeExp: null,
          }
        );
        // timer probably got cancelled
        continue;
      } else {
        // we are still waiting for a player to respond
        return;
      }
    }

    nextPlayer = player;
    break;
  }

  const gameUpdatesRepo = getRepository(PokerGameUpdates);
  if (!nextPlayer) {
    logger.info(`Game: ${gameId} No players in the waiting list`);
    // notify all the users waiting list process is complete
    await gameUpdatesRepo.update(
      {gameID: gameId},
      {waitlistSeatingInprogress: false}
    );
    return;
  }

  const waitingListTimeExp = new Date();
  const timeout = 30; // nextPlayer.game.waitListSittingTimeout
  waitingListTimeExp.setSeconds(waitingListTimeExp.getSeconds() + timeout);
  await playerGameTrackerRepository.update(
    {
      game: {id: gameId},
      player: {id: nextPlayer.player.id},
    },
    {
      status: PlayerStatus.WAITLIST_SEATING,
      waitingListTimeExp: waitingListTimeExp,
    }
  );
  await gameUpdatesRepo.update(
    {gameID: nextPlayer.game.id},
    {waitlistSeatingInprogress: true}
  );

  startTimer(
    nextPlayer.game.id,
    nextPlayer.player.id,
    WAITLIST_SEATING,
    waitingListTimeExp
  );

  // we will send a notification which player is coming to the table
  gameUpdate(nextPlayer.game, WAITLIST_SEATING, {
    data: {
      player: nextPlayer.player.id,
      name: nextPlayer.player.name,
    },
  });
}

// join game waitlist seating in progress flag
// if set to true, only the player with WAITLIST_SEATING is allowed to sit
// if WAITLIST_SEATING player is sitting, change status to PLAYING, update waitingFrom, waitlist_sitting_exp
// cancel timer
// update no of players in the table
// if there is an open seat, run seat change routine
// if there is no seat change, if there are more players in the waiting list, runWaitList
