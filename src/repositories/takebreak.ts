import {PlayerGameTracker} from '@src/entity/game/chipstrack';
import {NextHandUpdates, PokerGame} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {GameStatus, NextHandUpdate, PlayerStatus} from '@src/entity/types';
import {playerStatusChanged} from '@src/gameserver';
import {startTimer} from '@src/timer';
import {utcTime} from '@src/utils';
import {getLogger} from '@src/utils/log';
import {getRepository, Repository} from 'typeorm';
import {BREAK_TIMEOUT, NewUpdate} from './types';
import {Cache} from '@src/cache/index';

const logger = getLogger('takebreak');

export class TakeBreak {
  private game: PokerGame;
  private player: Player;

  constructor(game: PokerGame, player: Player) {
    this.game = game;
    this.player = player;
  }

  public async takeBreak(): Promise<boolean> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getRepository(NextHandUpdates);
    const rows = await playerGameTrackerRepository.findOne({
      game: {id: this.game.id},
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
          game: {id: this.game.id},
          playerId: this.player.id,
        },
        {
          status: playerInGame.status,
        }
      );
      await this.startTimer(playerGameTrackerRepository);

      // update the clients with new status
      await playerStatusChanged(
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
      update.newUpdate = NextHandUpdate.TAKE_BREAK;
      await nextHandUpdatesRepository.save(update);
    }
    return true;
  }

  public async processPendingUpdate(update: NextHandUpdates) {
    logger.info(`Player ${this.player.name} is taking a break`);
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: this.game.id},
        player: {id: this.player.id},
      })
      .select('status')
      .select('seat_no', 'seatNo')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }
    const playerInGame = rows[0];

    await this.startTimer(playerGameTrackerRepository);

    const pendingUpdatesRepo = getRepository(NextHandUpdates);
    pendingUpdatesRepo.delete({id: update.id});

    // update the clients with new status
    await playerStatusChanged(
      this.game,
      this.player,
      PlayerStatus.IN_BREAK,
      NewUpdate.TAKE_BREAK,
      playerInGame.stack,
      playerInGame.seatNo
    );
  }

  private async startTimer(
    playerGameTrackerRepository: Repository<PlayerGameTracker>
  ) {
    const now = utcTime(new Date());
    const breakTimeExpAt = new Date();
    let timeoutInMins = this.game.breakLength;
    timeoutInMins = 1;
    const timeoutInSeconds = timeoutInMins * 10 * 60;
    breakTimeExpAt.setSeconds(breakTimeExpAt.getSeconds() + timeoutInSeconds);
    const exp = utcTime(breakTimeExpAt);
    logger.info(
      `Player ${
        this.player.name
      } is taking a break. Now: ${now.toISOString()} Timer expires at ${exp.toISOString()}`
    );

    await playerGameTrackerRepository.update(
      {
        game: {id: this.game.id},
        playerId: this.player.id,
      },
      {
        status: PlayerStatus.IN_BREAK,
        breakTimeExpAt: exp,
        breakTimeStartedAt: now,
      }
    );

    startTimer(this.game.id, this.player.id, BREAK_TIMEOUT, breakTimeExpAt);
  }

  public async timerExpired() {
    const now = new Date();
    const nowUtc = utcTime(now);
    logger.info(
      `Player ${
        this.player.name
      } break time expired. Current time: ${nowUtc.toISOString()}`
    );
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    let rows = await playerGameTrackerRepository.findOne({
      game: {id: this.game.id},
      playerId: this.player.id,
    });
    if (!rows) {
      throw new Error('Player is not found in the game');
    }
    const seatNo = rows.seatNo;

    await playerGameTrackerRepository.update(
      {
        game: {id: this.game.id},
        playerId: this.player.id,
      },
      {
        status: PlayerStatus.NOT_PLAYING,
        seatNo: 0,
      }
    );
    rows = await playerGameTrackerRepository.findOne({
      game: {id: this.game.id},
      playerId: this.player.id,
    });
    if (!rows) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows;
    if (!playerInGame) {
      logger.error(`Game: ${this.game.gameCode} not available`);
    } else {
      await playerStatusChanged(
        this.game,
        this.player,
        playerInGame.status,
        NewUpdate.NEWUPDATE_NOT_PLAYING,
        playerInGame.stack,
        seatNo
      );
    }
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
      `Could not handle break time out. Game: ${gameID} or Player: ${playerID}`
    );
  }
}
