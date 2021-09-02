import {EntityManager, Not, Repository} from 'typeorm';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {getGameManager, getGameRepository} from '.';
import {getLogger} from '@src/utils/log';
import {
  NextHandUpdates,
  PokerGame,
  PokerGameSeatInfo,
  PokerGameSettings,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {Cache} from '@src/cache';
import {NextHandUpdate, PlayerStatus, TableStatus} from '@src/entity/types';
import {Nats} from '@src/nats';
import {startTimer} from '@src/timer';
import {utcTime} from '@src/utils';
import _ from 'lodash';
import {BUYIN_TIMEOUT} from './types';
import {getAgoraToken} from '@src/3rdparty/agora';

const logger = getLogger('players_in_game');

class PlayersInGameRepositoryImpl {
  public async getPlayersInSeats(
    gameId: number,
    transactionManager?: EntityManager
  ): Promise<Array<PlayerGameTracker>> {
    let playerGameTrackerRepo;
    if (transactionManager) {
      playerGameTrackerRepo = transactionManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    }
    const resp = await playerGameTrackerRepo.find({
      game: {id: gameId},
      seatNo: Not(0),
    });
    return resp;
  }

  public async getSeatInfo(
    gameId: number,
    seatNo: number,
    transactionManager?: EntityManager
  ): Promise<any> {
    let playerGameTrackerRepo;
    if (transactionManager) {
      playerGameTrackerRepo = transactionManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    }
    logger.info('getSeatInfo');
    const resp = await playerGameTrackerRepo.findOne({
      game: {id: gameId},
      seatNo: seatNo,
    });
    return resp;
  }

  public async getGamePlayerState(
    game: PokerGame,
    player: Player
  ): Promise<PlayerGameTracker | null> {
    //logger.info(`getGamePlayerState is called`);
    const repo = getGameRepository(PlayerGameTracker);
    const resp = await repo.find({
      playerId: player.id,
      game: {id: game.id},
    });
    return resp[0];
  }

  public async kickOutPlayer(gameCode: string, player: Player) {
    await getGameManager().transaction(async transactionEntityManager => {
      // find game
      const game = await Cache.getGame(gameCode);
      if (!game) {
        throw new Error(`Game ${gameCode} is not found`);
      }
      const playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      logger.info('kickOutPlayer');
      const playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: game.id},
          playerId: player.id,
        },
      });

      if (!playerInGame) {
        // player is not in game
        throw new Error(`Player ${player.name} is not in the game`);
      }

      if (game.tableStatus !== TableStatus.GAME_RUNNING) {
        // we can mark the user as KICKED_OUT from the player game tracker
        await playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            playerId: player.id,
          },
          {
            seatNo: 0,
            status: PlayerStatus.KICKED_OUT,
          }
        );
        const count = await playerGameTrackerRepository.count({
          where: {
            game: {id: game.id},
            status: PlayerStatus.PLAYING,
          },
        });

        const gameSeatInfoRepo = transactionEntityManager.getRepository(
          PokerGameSeatInfo
        );
        await gameSeatInfoRepo.update(
          {
            gameID: game.id,
          },
          {playersInSeats: count}
        );
        await Cache.getGameUpdates(game.gameCode, true);

        Nats.playerKickedOut(game, player, playerInGame.seatNo);
      } else {
        // game is running, so kickout the user in next hand
        // deal with this in the next hand update
        const nextHandUpdatesRepository = transactionEntityManager.getRepository(
          NextHandUpdates
        );
        const update = new NextHandUpdates();
        update.game = game;
        update.playerId = player.id;
        update.playerUuid = player.uuid;
        update.playerName = player.name;
        update.newUpdate = NextHandUpdate.KICKOUT;
        await nextHandUpdatesRepository.save(update);
      }
    });
  }

  public async getAudioToken(
    player: Player,
    game: PokerGame,
    transactionEntityManager?: EntityManager
  ): Promise<string> {
    logger.info(`getAudioToken is called`);
    let playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    if (transactionEntityManager) {
      playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
    }
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        playerId: player.id,
      })
      .select('audio_token')
      .addSelect('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }
    let token;
    if (rows && rows.length >= 1) {
      const playerInGame = rows[0];
      token = playerInGame.audio_token;
    }

    // TODO: agora will be used only for the player who are in the seats
    // if the player is not playing, then the player cannot join
    // if (playerInGame.status !== PlayerStatus.PLAYING) {
    //   return '';
    // }

    if (!token) {
      token = await getAgoraToken(game.gameCode, player.id);

      if (rows && rows.length === 1) {
        // update the record
        await playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            playerId: player.id,
          },
          {
            audioToken: token,
          }
        );
      }
    }

    return token;
  }

  public async updatePlayerGameConfig(
    player: Player,
    game: PokerGame,
    config: any
  ): Promise<void> {
    await getGameManager().transaction(async transactionEntityManager => {
      //logger.info(`updatePlayerConfig is called`);
      const updates: any = {};
      if (config.muckLosingHand !== undefined) {
        updates.muckLosingHand = config.muckLosingHand;
      }
      if (config.runItTwicePrompt !== undefined) {
        updates.runItTwicePrompt = config.runItTwicePrompt;
      }

      // get game updates
      const playerGameTrackerRepo = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      logger.info('updatePlayerGameConfig');

      let row = await playerGameTrackerRepo.findOne({
        game: {id: game.id},
        playerId: player.id,
      });
      if (row !== null) {
        await playerGameTrackerRepo.update(
          {
            game: {id: game.id},
            playerId: player.id,
          },
          updates
        );
      } else {
        // create a row
        const playerTrack = new PlayerGameTracker();
        playerTrack.game = game;
        playerTrack.playerId = player.id;
        playerTrack.playerUuid = player.uuid;
        playerTrack.playerName = player.name;
        playerTrack.status = PlayerStatus.NOT_PLAYING;
        playerTrack.buyIn = 0;
        playerTrack.stack = 0;
        if (config.muckLosingHand !== undefined) {
          playerTrack.muckLosingHand = config.muckLosingHand;
        }
        if (config.runItTwicePrompt !== undefined) {
          playerTrack.runItTwicePrompt = config.runItTwicePrompt;
        }
        await playerGameTrackerRepo.save(playerTrack);
      }
    });
  }

  public async startBuyinTimer(
    game: PokerGame,
    playerId: number,
    playerName: string,
    props?: any,
    transactionEntityManager?: EntityManager
  ) {
    logger.debug(
      `[${game.gameCode}] Starting buyin timer for player: ${playerName}`
    );
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;

    if (transactionEntityManager) {
      playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    }
    // TODO: start a buy-in timer
    const gameSettingsRepo = getGameRepository(PokerGameSettings);
    const gameSettings = await gameSettingsRepo.findOne({
      gameCode: game.gameCode,
    });
    let timeout = 60;
    if (gameSettings) {
      timeout = gameSettings.buyInTimeout;
    }
    const buyinTimeExp = new Date();
    buyinTimeExp.setSeconds(buyinTimeExp.getSeconds() + timeout);
    const exp = utcTime(buyinTimeExp);
    let setProps: any = {};
    if (props) {
      setProps = _.merge(setProps, props);
    }
    setProps.buyInExpAt = exp;
    await playerGameTrackerRepository.update(
      {
        game: {id: game.id},
        playerId: playerId,
      },
      setProps
    );

    startTimer(game.id, playerId, BUYIN_TIMEOUT, buyinTimeExp);
  }
}

export const PlayersInGameRepository = new PlayersInGameRepositoryImpl();
