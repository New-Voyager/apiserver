import {getRepository, getManager, getConnection, Not, IsNull} from 'typeorm';
import {isPostgres} from '@src/utils';
import {GameStatus, NextHandUpdate, PlayerStatus} from '@src/entity/types';
import {GameRepository} from './game';
import {getLogger} from '@src/utils/log';
import {NextHandUpdates, PokerGame} from '@src/entity/game';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {pendingProcessDone, playerKickedOut} from '@src/gameserver';

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
      if (playerInGame) {
        // notify game server, player is kicked out
        playerKickedOut(game, update.player, playerInGame.seatNo);
      }
      // delete this update
      pendingUpdatesRepo.delete({id: update.id});
    }
  }

  await pendingProcessDone(gameId);
}
