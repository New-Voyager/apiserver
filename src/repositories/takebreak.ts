import { PlayerGameTracker } from '@src/entity/game/player_game_tracker';
import {
  gameLogPrefix,
  NextHandUpdates,
  PokerGame,
  PokerGameUpdates,
} from '@src/entity/game/game';
import { Player } from '@src/entity/player/player';
import {
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';
import { startTimer } from '@src/timer';
import { utcTime } from '@src/utils';
import { errToStr, getLogger } from '@src/utils/log';
import { EntityManager, Repository } from 'typeorm';
import { BREAK_TIMEOUT, NewUpdate } from './types';
import { Cache } from '@src/cache/index';
import { getGameRepository } from '.';
import { GameRepository } from './game';
import { Nats } from '@src/nats';
import { GameUpdatesRepository } from './gameupdates';
import { PlayersInGameRepository } from './playersingame';
const logger = getLogger('repositories::takebreak');

export class TakeBreak {
  private game: PokerGame;
  private player: Player;

  constructor(game: PokerGame, player: Player) {
    this.game = game;
    this.player = player;
  }

  public async takeBreak(transactionManager?: EntityManager): Promise<boolean> {
    let playerGameTrackerRepository;
    let nextHandUpdatesRepository;
    if (transactionManager) {
      playerGameTrackerRepository =
        transactionManager.getRepository(PlayerGameTracker);
      nextHandUpdatesRepository =
        transactionManager.getRepository(NextHandUpdates);
    } else {
      playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
      nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
    }
    const rows = await playerGameTrackerRepository.findOne({
      game: { id: this.game.id },
      playerId: this.player.id,
    });
    if (!rows) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows;
    if (!playerInGame) {
      logger.error(`Game: ${this.game.gameCode} not available`);
      throw new Error(`Game: ${this.game.gameCode} not available`);
    }

    if (playerInGame.status === PlayerStatus.IN_BREAK) {
      return true;
    }

    if (playerInGame.status !== PlayerStatus.PLAYING) {
      logger.error(
        `Player in game status is ${PlayerStatus[playerInGame.status]}`
      );
      throw new Error(
        `Player in game status is ${PlayerStatus[playerInGame.status]}`
      );
    }

    if (this.game.status !== GameStatus.ACTIVE) {
      playerInGame.status = PlayerStatus.IN_BREAK;
      playerGameTrackerRepository.update(
        {
          game: { id: this.game.id },
          playerId: this.player.id,
        },
        {
          status: playerInGame.status,
        }
      );
      await this.startTimer(playerGameTrackerRepository, transactionManager);

      // update the clients with new status
      await Nats.playerStatusChanged(
        this.game,
        this.player,
        playerInGame.status,
        NewUpdate.TAKE_BREAK,
        playerInGame.stack,
        playerInGame.seatNo
      );
    } else {
      const update = new NextHandUpdates();
      update.game = this.game;
      update.playerId = this.player.id;
      update.playerUuid = this.player.uuid;
      update.playerName = this.player.name;
      update.newUpdate = NextHandUpdate.TAKE_BREAK;
      await nextHandUpdatesRepository.save(update);
    }
    return true;
  }

  public async processPendingUpdate(update: NextHandUpdates | null) {
    logger.debug(`Player ${this.player.name} is taking a break`);
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: { id: this.game.id },
        playerId: this.player.id,
      })
      .select('status')
      .select('seat_no', 'seatNo')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }
    const playerInGame = rows[0];

    await this.startTimer(playerGameTrackerRepository);
    if (update) {
      const pendingUpdatesRepo = getGameRepository(NextHandUpdates);
      await pendingUpdatesRepo.delete({ id: update.id });
    }

    // update the clients with new status
    await Nats.playerStatusChanged(
      this.game,
      this.player,
      PlayerStatus.IN_BREAK,
      NewUpdate.TAKE_BREAK,
      playerInGame.stack,
      playerInGame.seatNo
    );

    // if active player count is 1, then mark the game not enough players
    const playingCount = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: { id: this.game.id },
        status: PlayerStatus.PLAYING,
      })
      .getCount();

    if (playingCount <= 1) {
      const gameRepo = getGameRepository(PokerGame);
      await gameRepo.update(
        {
          gameCode: this.game.gameCode,
        },
        {
          tableStatus: TableStatus.NOT_ENOUGH_PLAYERS,
        }
      );
      await Cache.getGame(this.game.gameCode, true);
    }
  }

  private async startTimer(
    playerGameTrackerRepository: Repository<PlayerGameTracker>,
    transactionManager?: EntityManager
  ) {
    const gameSettings = await Cache.getGameSettings(
      this.game.gameCode,
      false,
      transactionManager
    );
    if (!gameSettings) {
      throw new Error(
        `Game code: ${this.game.gameCode} is not found in PokerGameSettings`
      );
    }

    const now = utcTime(new Date());
    const breakTimeExpAt = new Date();
    let timeoutInMins = gameSettings.breakLength;
    const timeoutInSeconds = timeoutInMins * 60;
    breakTimeExpAt.setSeconds(breakTimeExpAt.getSeconds() + timeoutInSeconds);
    const exp = utcTime(breakTimeExpAt);
    logger.debug(
      `Player ${this.player.name
      } is taking a break. Now: ${now.toISOString()} Timer expires at ${exp.toISOString()}`
    );

    await playerGameTrackerRepository.update(
      {
        game: { id: this.game.id },
        playerId: this.player.id,
      },
      {
        status: PlayerStatus.IN_BREAK,
        breakTimeExpAt: exp,
        breakTimeStartedAt: now,
      }
    );

    startTimer(
      this.game.id,
      this.player.id,
      BREAK_TIMEOUT,
      breakTimeExpAt
    ).catch(e => {
      logger.error(
        `[${gameLogPrefix(this.game)}] Starting break timer failed. Error: ${e.message
        }`
      );
    });
  }

  public async timerExpired() {
    const now = new Date();
    const nowUtc = utcTime(now);
    logger.debug(
      `Player ${this.player.name
      } break time expired. Current time: ${nowUtc.toISOString()}`
    );
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    let rows = await playerGameTrackerRepository.findOne({
      game: { id: this.game.id },
      playerId: this.player.id,
    });
    if (!rows) {
      throw new Error('Player is not found in the game');
    }
    const seatNo = rows.seatNo;

    await PlayersInGameRepository.leaveGame(
      playerGameTrackerRepository,
      this.game,
      this.player.id,
    );

    rows = await playerGameTrackerRepository.findOne({
      game: { id: this.game.id },
      playerId: this.player.id,
    });
    if (!rows) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows;
    if (!playerInGame) {
      logger.error(`Game: ${this.game.gameCode} not available`);
    } else {
      await Nats.playerStatusChanged(
        this.game,
        this.player,
        playerInGame.status,
        NewUpdate.NEWUPDATE_NOT_PLAYING,
        playerInGame.stack,
        seatNo
      );
    }
    await Cache.updateGamePendingUpdates(this.game.gameCode, true);
  }
}

export async function breakTimeoutExpired(gameID: number, playerID: number) {
  try {
    const game = await Cache.getGameById(gameID);
    const player = await Cache.getPlayerById(playerID);
    if (!game || !player) {
      throw new Error(`Game: ${gameID} or Player: ${playerID} not found`);
    }
    const takeBreak = new TakeBreak(game, player);
    await takeBreak.timerExpired();
  } catch (err) {
    logger.error(
      `Could not handle break time out. Game: ${gameID} or Player: ${playerID}. Error: ${errToStr(
        err
      )}`
    );
  }
}
