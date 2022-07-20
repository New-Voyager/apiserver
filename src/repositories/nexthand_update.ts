import {NextHandUpdates, PokerGame} from '@src/entity/game/game';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {Player} from '@src/entity/player/player';
import {
  GameEndReason,
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';
import {Nats} from '@src/nats';
import {cancelTimer} from '@src/timer';
import {fixQuery} from '@src/utils';
import {getLogger} from '@src/utils/log';
import {getGameConnection, getGameManager, getGameRepository} from '.';
import {GameRepository} from './game';
import {GameSettingsRepository} from './gamesettings';
import {LocationCheck} from './locationcheck';
import {BREAK_TIMEOUT, NewUpdate} from './types';

const logger = getLogger('repositories::nexthand_update');

class NextHandUpdatesRepositoryImpl {
  public async leaveGame(player: Player, game: PokerGame): Promise<boolean> {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        playerId: player.id,
      })
      .select('status')
      .addSelect('session_time', 'sessionTime')
      .addSelect('sat_at', 'satAt')
      .addSelect('seat_no', 'seatNo')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];

    if (
      game.status === GameStatus.ACTIVE &&
      (game.tableStatus == TableStatus.GAME_RUNNING ||
        game.tableStatus === TableStatus.HOST_SEATCHANGE_IN_PROGRESS) &&
      playerInGame.status === PlayerStatus.PLAYING
    ) {
      const nextHandUpdate = await nextHandUpdatesRepository.findOne({
        where: {
          game: {id: game.id},
          playerId: player.id,
          newUpdate: NextHandUpdate.LEAVE,
        },
      });

      if (!nextHandUpdate) {
        const update = new NextHandUpdates();
        update.game = game;
        update.playerId = player.id;
        update.playerUuid = player.uuid;
        update.playerName = player.name;
        update.newUpdate = NextHandUpdate.LEAVE;
        await nextHandUpdatesRepository.save(update);
      }
    } else {
      playerInGame.status = PlayerStatus.NOT_PLAYING;
      const seatNo = playerInGame.seatNo;
      playerInGame.seatNo = 0;
      const setProps: any = {
        status: PlayerStatus.NOT_PLAYING,
        seatNo: 0,
      };

      if (playerInGame.satAt) {
        const satAt = new Date(Date.parse(playerInGame.satAt.toString()));
        // calculate session time
        let sessionTime = playerInGame.sessionTime;
        const currentSessionTime = new Date().getTime() - satAt.getTime();
        const roundSeconds = Math.round(currentSessionTime / 1000);
        sessionTime = sessionTime + roundSeconds;
        setProps.satAt = undefined;
        setProps.sessionTime = sessionTime;
      }
      await playerGameTrackerRepository.update(
        {
          game: {id: game.id},
          playerId: player.id,
        },
        setProps
      );

      if (seatNo !== 0) {
        await GameRepository.seatOpened(game, seatNo);
      }

      // playerLeftGame(game, player, seatNo);
    }
    return true;
  }

  public async sitBack(
    player: Player,
    game: PokerGame,
    ip: string,
    location: any
  ): Promise<void> {
    await getGameManager().transaction(async transactionEntityManager => {
      const playerGameTrackerRepository =
        transactionEntityManager.getRepository(PlayerGameTracker);
      const nextHandUpdatesRepository =
        transactionEntityManager.getRepository(NextHandUpdates);
      const rows = await playerGameTrackerRepository
        .createQueryBuilder()
        .where({
          game: {id: game.id},
          playerId: player.id,
        })
        .select('stack')
        .select('status')
        .select('seat_no', 'seatNo')
        .execute();
      if (!rows && rows.length === 0) {
        throw new Error('Player is not found in the game');
      }

      const playerInGame = rows[0];
      if (!playerInGame) {
        logger.error(`Game: ${game.gameCode} not available`);
        throw new Error(`Game: ${game.gameCode} not available`);
      }
      const gameSettings = await GameSettingsRepository.get(
        game.gameCode,
        false,
        transactionEntityManager
      );
      if (!gameSettings) {
        throw new Error(
          `Game: ${game.gameCode} is not found in PokerGameSettings`
        );
      }
      if (gameSettings.gpsCheck || gameSettings.ipCheck) {
        const locationCheck = new LocationCheck(game, gameSettings);
        await locationCheck.checkForOnePlayer(
          player,
          ip,
          location,
          undefined,
          transactionEntityManager
        );
      }

      cancelTimer(game.id, player.id, BREAK_TIMEOUT).catch(e => {
        logger.error(`Failed to cancel break timeout. Error: ${e.message}`);
      });
      playerInGame.status = PlayerStatus.PLAYING.valueOf();
      const sitBackQuery = `UPDATE player_game_tracker 
              SET status = ${playerInGame.status},
                  break_time_started_at = NULL,
                  break_time_exp_at = NULL, 
                  consecutive_action_timeouts = 0
              WHERE pgt_game_id = ${game.id} AND pgt_player_id = ${player.id}`;
      await transactionEntityManager.query(sitBackQuery);

      // update the clients with new status
      await Nats.playerStatusChanged(
        game,
        player,
        playerInGame.status,
        NewUpdate.SIT_BACK,
        playerInGame.stack,
        playerInGame.seatNo
      );
      const nextHandUpdate = await nextHandUpdatesRepository.findOne({
        where: {
          game: {id: game.id},
          playerId: player.id,
          newUpdate: NextHandUpdate.TAKE_BREAK,
        },
      });

      if (nextHandUpdate) {
        await nextHandUpdatesRepository.delete({id: nextHandUpdate.id});
      }
    });
    await GameRepository.restartGameIfNeeded(game, true, false);
  }

  public async endGameNextHand(
    player: Player | null,
    gameId: number,
    endReason: GameEndReason
  ) {
    // check to see if the game is already marked to be ended
    const repository = getGameRepository(NextHandUpdates);
    const query = fixQuery(
      'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
    );
    const resp = await getGameConnection().query(query, [
      gameId,
      NextHandUpdate.END_GAME,
    ]);
    if (resp[0]['updates'] === 0) {
      const nextHandUpdate = new NextHandUpdates();
      const game = new PokerGame();
      game.id = gameId;
      nextHandUpdate.game = game;
      if (player) {
        nextHandUpdate.playerId = player.id;
        nextHandUpdate.playerName = player.name;
        nextHandUpdate.playerUuid = player.uuid;
      } else {
        nextHandUpdate.playerId = 0;
        nextHandUpdate.playerName = 'SYSTEM';
        nextHandUpdate.playerUuid = 'SYSTEM_UUID';
      }
      nextHandUpdate.endReason = endReason;
      nextHandUpdate.newUpdate = NextHandUpdate.END_GAME;
      await repository.save(nextHandUpdate);

      // notify users that the game will end in the next hand
    }
  }

  public async expireGameNextHand(gameId: number) {
    // check to see if the game is already marked to be ended
    const repository = getGameRepository(NextHandUpdates);
    const query = fixQuery(
      'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
    );
    const resp = await getGameConnection().query(query, [
      gameId,
      NextHandUpdate.END_GAME,
    ]);
    if (resp[0]['updates'] === 0) {
      const nextHandUpdate = new NextHandUpdates();
      const game = new PokerGame();
      game.id = gameId;
      nextHandUpdate.game = game;
      nextHandUpdate.endReason = GameEndReason.SYSTEM_TERMINATED;
      nextHandUpdate.newUpdate = NextHandUpdate.END_GAME;
      await repository.save(nextHandUpdate);
    }
  }

  public async pauseGameNextHand(gameId: number) {
    // check to see if the game is already marked to be ended
    const repository = getGameRepository(NextHandUpdates);
    const query = fixQuery(
      'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
    );
    const resp = await getGameConnection().query(query, [
      gameId,
      NextHandUpdate.PAUSE_GAME,
    ]);
    if (resp[0]['updates'] === 0) {
      const nextHandUpdate = new NextHandUpdates();
      const game = new PokerGame();
      game.id = gameId;
      nextHandUpdate.game = game;
      nextHandUpdate.newUpdate = NextHandUpdate.PAUSE_GAME;
      await repository.save(nextHandUpdate);

      // notify users that the game will pause in the next hand
    }
  }
}

export const NextHandUpdatesRepository = new NextHandUpdatesRepositoryImpl();
