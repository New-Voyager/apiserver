import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {PokerGame, PokerGameSeatInfo} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
  SeatChangeProcessType,
  TableStatus,
} from '@src/entity/types';
import {getLogger} from '@src/utils/log';
import {EntityManager, IsNull, Not, Repository} from 'typeorm';
import * as _ from 'lodash';
import {cancelTimer, startTimer} from '@src/timer';
import {PLAYER_SEATCHANGE_PROMPT} from './types';
import {
  HostSeatChangeProcess,
  PlayerSeatChangeProcess,
} from '@src/entity/game/seatchange';
import {SeatMove, SeatUpdate} from '@src/types';
import {fixQuery, utcTime} from '@src/utils';
import {Nats} from '@src/nats';
import {Cache} from '@src/cache/index';
import {processPendingUpdates, switchSeatNextHand} from './pendingupdates';
import {getGameConnection, getGameManager, getGameRepository} from '.';

const logger = getLogger('repositories::seatchange');

export class SeatChangeProcess {
  game: PokerGame;

  constructor(game: PokerGame) {
    this.game = game;
  }

  public async start(openedSeat: number) {
    const players = await this.getSeatChangeRequestedPlayers();
    if (players.length === 0) {
      return;
    }

    const playerSeatChangeRepo = getGameRepository(PlayerSeatChangeProcess);
    // clear old rows if any
    await playerSeatChangeRepo.delete({
      gameCode: this.game.gameCode,
    });
    // copy the players to temp table
    for (const player of players) {
      const playerSeatChange = new PlayerSeatChangeProcess();
      playerSeatChange.gameCode = this.game.gameCode;
      playerSeatChange.playerId = player.playerId;
      playerSeatChange.seatChangeRequestedAt = player.seatChangeRequestedAt;
      playerSeatChange.name = player.playerName;
      playerSeatChange.playerUuid = player.playerUuid;
      playerSeatChange.prompted = false;
      playerSeatChange.seatNo = player.seatNo;
      playerSeatChange.stack = player.stack;
      await playerSeatChangeRepo.save(playerSeatChange);
    }

    const gameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);
    await gameSeatInfoRepo.update(
      {
        gameID: this.game.id,
      },
      {
        seatChangeOpenSeat: openedSeat,
        seatChangeInProgress: true,
      }
    );
    this.promptPlayer(openedSeat);
  }

  public async promptPlayer(openedSeat: number) {
    logger.info(
      `[${this.game.gameCode}] Seat change process. Prompting next player`
    );

    const playerSeatChangeRepo = getGameRepository(PlayerSeatChangeProcess);

    // delete the player who has the prompt
    await playerSeatChangeRepo.delete({
      gameCode: this.game.gameCode,
      prompted: true,
    });

    const seatChangeRequestedPlayers = await playerSeatChangeRepo.find({
      order: {
        seatChangeRequestedAt: 'ASC',
      },
      where: {
        gameCode: this.game.gameCode,
      },
    });

    // make sure seats are opened
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const count = await playerGameTrackerRepo.count({
      where: {game: {id: this.game.id}, status: PlayerStatus.PLAYING},
    });

    const gameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);
    if (
      seatChangeRequestedPlayers.length === 0 ||
      count === this.game.maxPlayers
    ) {
      logger.info(
        `[${this.game.gameCode}] Seat change process is done. Resuming the game`
      );
      Nats.sendPlayerSeatChangeDone(this.game.gameCode);
      await gameSeatInfoRepo.update(
        {
          gameID: this.game.id,
        },
        {
          seatChangeInProgress: false,
        }
      );
      // seat change process is over, resume game
      const game = await Cache.getGame(this.game.gameCode, true);
      processPendingUpdates(game.id);
      return;
    }
    // get the open seat
    if (openedSeat === 0) {
      const gameUpdate = await gameSeatInfoRepo.findOne({
        gameID: this.game.id,
      });
      if (
        gameUpdate === undefined ||
        gameUpdate.seatChangeOpenSeat === undefined
      ) {
        await gameSeatInfoRepo.update(
          {
            gameID: this.game.id,
          },
          {
            seatChangeInProgress: false,
          }
        );
        // seat change process is over, resume game
        const game = await Cache.getGame(this.game.gameCode, true);
        processPendingUpdates(game.id);
        //await GameRepository.restartGameIfNeeded(game);
      }
      if (gameUpdate) {
        openedSeat = gameUpdate.seatChangeOpenSeat;
      }
    }

    const player = seatChangeRequestedPlayers[0];
    logger.info(
      `[${this.game.gameCode}] Seat change process. Prompting player ${player.name}, id: ${player.id}`
    );

    const expTime = new Date();
    const promptTime = 30;
    expTime.setSeconds(expTime.getSeconds() + promptTime);
    const exp = utcTime(expTime);

    await playerSeatChangeRepo.update({id: player.id}, {prompted: true});
    await startTimer(
      this.game.id,
      player.playerId,
      PLAYER_SEATCHANGE_PROMPT,
      expTime
    );

    // pick the first player and prompt
    Nats.sendSeatChangePrompt(
      this.game.gameCode,
      openedSeat,
      player.playerId,
      player.playerUuid,
      player.name,
      exp,
      promptTime
    );
  }

  public async timerExpired(playerId: number) {
    // remove the prompted player
    const playerSeatChangeRepo = getGameRepository(PlayerSeatChangeProcess);
    await playerSeatChangeRepo.delete({
      gameCode: this.game.gameCode,
      playerId: playerId,
    });
    // go to the next player
    this.promptPlayer(0);
  }

  public async requestSeatChange(
    player: Player,
    cancel: boolean
  ): Promise<Date | null> {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      where: {
        game: {id: this.game.id},
        playerId: player.id,
      },
    });

    if (!playerInGame) {
      logger.error(`Game: ${this.game.gameCode} not available`);
      throw new Error(`Game: ${this.game.gameCode} not available`);
    }

    if (playerInGame.status !== PlayerStatus.PLAYING) {
      logger.error(`player status is ${PlayerStatus[playerInGame.status]}`);
      throw new Error(`player status is ${PlayerStatus[playerInGame.status]}`);
    }

    let seatChangeRequestedAt: Date | null = new Date();
    if (cancel) {
      seatChangeRequestedAt = null;
    }
    await playerGameTrackerRepository.update(
      {
        game: {id: this.game.id},
        playerId: player.id,
      },
      {
        seatChangeRequestedAt: seatChangeRequestedAt,
      }
    );
    return seatChangeRequestedAt;
  }

  public async seatChangeRequests(
    player: Player
  ): Promise<PlayerGameTracker[]> {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      where: {
        game: {id: this.game.id},
        playerId: player.id,
      },
    });

    if (!playerInGame) {
      logger.error(`Game: ${this.game.gameCode} not available`);
      throw new Error(`Game: ${this.game.gameCode} not available`);
    }

    if (playerInGame.status !== PlayerStatus.PLAYING) {
      logger.error(`player status is ${PlayerStatus[playerInGame.status]}`);
      throw new Error(`player status is ${PlayerStatus[playerInGame.status]}`);
    }

    const seatChangeRequestedPlayers = await playerGameTrackerRepository.find({
      order: {
        seatChangeRequestedAt: 'ASC',
      },
      where: {
        game: {id: this.game.id},
        status: PlayerStatus.PLAYING,
        seatChangeRequestedAt: Not(IsNull()),
      },
    });

    return seatChangeRequestedPlayers;
  }

  public async declineSeatChange(player: Player): Promise<boolean> {
    logger.info(
      `[${this.game.gameCode}] Received decline seat change from player. ${player.id} ${player.name}`
    );
    cancelTimer(this.game.id, player.id, PLAYER_SEATCHANGE_PROMPT);
    // send a message in NATS (the UI will do an animation)
    Nats.sendPlayerSeatChangeDeclined(
      this.game.gameCode,
      player.id,
      player.uuid,
      player.name
    );

    // move to next player
    this.promptPlayer(0);
    return true;
  }

  public async confirmSeatChange(
    player: Player,
    seatNo: number
  ): Promise<boolean> {
    const playerOldSeat = await getGameManager().transaction(async tran => {
      logger.info(
        `[${this.game.gameCode}] Received confirm seat change from player. ${player.id} ${player.name}`
      );
      cancelTimer(this.game.id, player.id, PLAYER_SEATCHANGE_PROMPT);

      const playerGameTrackerRepository = tran.getRepository(PlayerGameTracker);
      const playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: this.game.id},
          playerId: player.id,
        },
      });

      if (seatNo > this.game.maxPlayers) {
        throw new Error('Invalid seat no');
      }

      if (!playerInGame) {
        logger.error(
          `Game: ${this.game.gameCode} Player: ${player.id} is not playing in this table`
        );
        throw new Error(
          `Game: ${this.game.gameCode} Player: ${player.id} is not playing in this table`
        );
      }

      if (playerInGame.status !== PlayerStatus.PLAYING) {
        logger.error(
          `Game: ${this.game.gameCode} Player: ${player.id} is not playing in this table`
        );
        throw new Error(
          `Game: ${this.game.gameCode} Player: ${player.id} is not playing in this table`
        );
      }

      // make sure this seat is open
      const playerInSeat = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: this.game.id},
          seatNo: seatNo,
        },
      });
      if (playerInSeat) {
        const player = await Cache.getPlayer(playerInSeat.playerUuid);
        logger.error(
          `Game: ${this.game.gameCode} Player: ${player.id} A player already exists in the table`
        );
        // there is a player in the seat
        throw new Error(
          `A player ${player.name}:${playerInSeat.playerId} already sits in the seat ${seatNo} `
        );
      }

      // move the player to new seat
      await playerGameTrackerRepository.update(
        {
          game: {id: this.game.id},
          playerId: player.id,
        },
        {
          seatNo: seatNo,
          seatChangeRequestedAt: null,
        }
      );

      // make his seat open
      await playerGameTrackerRepository.update(
        {
          game: {id: this.game.id},
          seatNo: playerInGame.seatNo,
        },
        {
          seatNo: 0,
        }
      );
      const gameSeatInfoRepo = tran.getRepository(PokerGameSeatInfo);
      await gameSeatInfoRepo.update(
        {
          gameID: this.game.id,
        },
        {
          seatChangeOpenSeat: playerInGame.seatNo,
        }
      );

      // send a message in NATS (the UI will do an animation)
      Nats.sendPlayerSeatMove(
        this.game.gameCode,
        player.id,
        player.uuid,
        player.name,
        playerInGame.seatNo,
        seatNo
      );
      return playerInGame.seatNo;
    });
    // move to the next player
    this.promptPlayer(playerOldSeat);

    return true;
  }

  async getSeatChangeRequestedPlayers(transactionManager?: EntityManager) {
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;
    if (transactionManager) {
      playerGameTrackerRepository = transactionManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    }
    const players = await playerGameTrackerRepository.find({
      order: {seatChangeRequestedAt: 'ASC'},
      where: {
        game: {id: this.game.id},
        seatChangeRequestedAt: Not(IsNull()),
        status: PlayerStatus.PLAYING,
      },
    });
    return players;
  }

  public async beginHostSeatChange(host: Player) {
    await getGameManager().transaction(async transactionEntityManager => {
      const playerGameTrackerRepo = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      const seatChangeProcessRepo = transactionEntityManager.getRepository(
        HostSeatChangeProcess
      );
      const gameRepo = transactionEntityManager.getRepository(PokerGame);

      // first remove entries from the HostSeatChangeProcess table
      await seatChangeProcessRepo.delete({
        gameCode: this.game.gameCode,
      });
      await gameRepo.update(
        {
          id: this.game.id,
        },
        {
          tableStatus: TableStatus.HOST_SEATCHANGE_IN_PROGRESS,
        }
      );
      await Cache.getGame(
        this.game.gameCode,
        true /** update */,
        transactionEntityManager
      );

      // copy current seated players in the seats to the seat change process table
      const playersInSeats = await playerGameTrackerRepo.find({
        game: {id: this.game.id},
        seatNo: Not(IsNull()),
      });

      // these are the players in seats
      // convert list to map
      const playersBySeatNo = _.keyBy(playersInSeats, 'seatNo');
      for (let seatNo = 1; seatNo <= this.game.maxPlayers; seatNo++) {
        let seatChangePlayer: HostSeatChangeProcess;
        if (playersBySeatNo[seatNo]) {
          const player = playersBySeatNo[seatNo];
          // a player is in the seat
          seatChangePlayer = new HostSeatChangeProcess();
          seatChangePlayer.gameCode = this.game.gameCode;
          seatChangePlayer.name = player.playerName;
          seatChangePlayer.playerId = player.playerId;
          seatChangePlayer.playerUuid = player.playerUuid;
          seatChangePlayer.seatNo = seatNo;
          seatChangePlayer.stack = player.stack;
          seatChangePlayer.openSeat = false;
        } else {
          // open seat
          seatChangePlayer = new HostSeatChangeProcess();
          seatChangePlayer.gameCode = this.game.gameCode;
          seatChangePlayer.seatNo = seatNo;
          seatChangePlayer.openSeat = true;
        }
        await seatChangeProcessRepo.save(seatChangePlayer);
      }

      // notify the players seat change process has begun
      await Nats.hostSeatChangeProcessStarted(this.game, host.id);
    });
  }

  public async swapSeats(seatNo1: number, seatNo2: number): Promise<boolean> {
    await getGameManager().transaction(async transactionEntityManager => {
      const seatChangeProcessRepo = transactionEntityManager.getRepository(
        HostSeatChangeProcess
      );
      let seat1Open, seat2Open;
      const seatMoves = new Array<SeatMove>();
      const seatChangePlayer1 = await seatChangeProcessRepo.findOne({
        gameCode: this.game.gameCode,
        seatNo: seatNo1,
      });

      if (seatChangePlayer1 && seatChangePlayer1?.openSeat) {
        seat1Open = true;
      }

      const seatChangePlayer2 = await seatChangeProcessRepo.findOne({
        gameCode: this.game.gameCode,
        seatNo: seatNo2,
      });
      if (seatChangePlayer2 && seatChangePlayer2?.openSeat) {
        seat2Open = true;
      }

      if (seat1Open && seat2Open) {
        // do nothing, open seats cannot be moved
        return;
      }

      if (!seatChangePlayer1 || !seatChangePlayer2) {
        return;
      }

      // update seat no 1
      seatMoves.push({
        openSeat: seatChangePlayer2.openSeat,
        playerId: seatChangePlayer2.playerId,
        playerUuid: seatChangePlayer2.playerUuid,
        name: seatChangePlayer2.name,
        stack: seatChangePlayer2.stack,
        oldSeatNo: seatChangePlayer2.seatNo,
        newSeatNo: seatChangePlayer1.seatNo,
      });
      await seatChangeProcessRepo.update(
        {
          id: seatChangePlayer1.id,
        },
        {
          playerId: seatChangePlayer2.playerId,
          playerUuid: seatChangePlayer2.playerUuid,
          name: seatChangePlayer2.name,
          stack: seatChangePlayer2.stack,
          seatNo: seatChangePlayer1.seatNo,
          openSeat: seatChangePlayer2.openSeat,
        }
      );

      // update seat no 2
      seatMoves.push({
        openSeat: seatChangePlayer1.openSeat,
        playerId: seatChangePlayer1.playerId,
        playerUuid: seatChangePlayer1.playerUuid,
        name: seatChangePlayer1.name,
        stack: seatChangePlayer1.stack,
        oldSeatNo: seatChangePlayer1.seatNo,
        newSeatNo: seatChangePlayer2.seatNo,
      });
      await seatChangeProcessRepo.update(
        {
          id: seatChangePlayer2.id,
        },
        {
          playerId: seatChangePlayer1.playerId,
          playerUuid: seatChangePlayer1.playerUuid,
          name: seatChangePlayer1.name,
          stack: seatChangePlayer1.stack,
          seatNo: seatChangePlayer2.seatNo,
          openSeat: seatChangePlayer1.openSeat,
        }
      );

      // notify the players seat change process has ended
      await Nats.hostSeatChangeSeatMove(this.game, seatMoves);
    });

    return true;
  }

  public async hostSeatChangeComplete(host: Player, cancelChanges: boolean) {
    await getGameManager().transaction(async transactionEntityManager => {
      const seatChangeProcessRepo = transactionEntityManager.getRepository(
        HostSeatChangeProcess
      );
      const playerGameTrackerRepo = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      if (!cancelChanges) {
        const seatChangedPlayers = await seatChangeProcessRepo.find({
          gameCode: this.game.gameCode,
        });
        for (const player of seatChangedPlayers) {
          if (player.playerId != null) {
            await playerGameTrackerRepo.update(
              {
                game: {id: this.game.id},
                playerId: player.playerId,
              },
              {
                seatNo: player.seatNo,
              }
            );
          }
        }
      }
      const gameRepo = transactionEntityManager.getRepository(PokerGame);
      await gameRepo.update(
        {
          id: this.game.id,
        },
        {
          tableStatus: TableStatus.GAME_RUNNING,
        }
      );
      // delete rows from host seat process table
      await seatChangeProcessRepo.delete({
        gameCode: this.game.gameCode,
      });
      const currentSeatStatus = await getCurrentSeats(
        this.game,
        transactionEntityManager
      );
      // notify the players seat change process has ended
      await Nats.hostSeatChangeProcessEnded(
        this.game,
        currentSeatStatus,
        host.id
      );
    });
  }

  public async switchSeat(
    player: Player,
    seatNo: number
  ): Promise<PlayerStatus> {
    if (seatNo > this.game.maxPlayers) {
      throw new Error('Invalid seat number');
    }
    logger.info(
      `[${this.game.gameCode}] Player: ${player.name} is switching to seat: ${seatNo}`
    );
    const [playerInGame, newPlayer] = await getGameManager().transaction(
      async transactionEntityManager => {
        // get game updates
        const gameSeatInfoRepo = transactionEntityManager.getRepository(
          PokerGameSeatInfo
        );
        const gameSeatInfo = await gameSeatInfoRepo.findOne({
          where: {
            gameID: this.game.id,
          },
        });
        if (!gameSeatInfo) {
          logger.error(
            `Game status is not found for game: ${this.game.gameCode}`
          );
          throw new Error(
            `Game status is not found for game: ${this.game.gameCode}`
          );
        }
        if (
          gameSeatInfo.waitlistSeatingInprogress ||
          gameSeatInfo.seatChangeInProgress
        ) {
          throw new Error(
            `Seat change is in progress for game: ${this.game.gameCode}`
          );
        }

        const playerGameTrackerRepository = transactionEntityManager.getRepository(
          PlayerGameTracker
        );

        // make sure the seat is available
        let playerInSeat = await playerGameTrackerRepository.findOne({
          where: {
            game: {id: this.game.id},
            seatNo: seatNo,
          },
        });

        // if there is a player in the seat, return an error

        // if the current player in seat tried to sit in the same seat, do nothing
        if (playerInSeat) {
          throw new Error('A player is in the seat');
        }

        // is game running
        if (
          this.game.status === GameStatus.ACTIVE &&
          this.game.tableStatus === TableStatus.GAME_RUNNING
        ) {
          // switch seat in the next hand
          await switchSeatNextHand(
            this.game,
            player,
            seatNo,
            transactionEntityManager
          );
          await Nats.notifyPlayerSeatReserve(this.game, player, seatNo);
          return [playerInSeat, true];
        }

        // get player's old seat no
        playerInSeat = await playerGameTrackerRepository.findOne({
          where: {
            game: {id: this.game.id},
            playerId: player.id,
          },
        });
        let oldSeatNo = playerInSeat?.seatNo;
        if (!oldSeatNo) {
          oldSeatNo = 0;
        }

        await playerGameTrackerRepository.update(
          {
            game: {id: this.game.id},
            playerId: player.id,
          },
          {
            seatNo: seatNo,
          }
        );
        playerInSeat = await playerGameTrackerRepository.findOne({
          where: {
            game: {id: this.game.id},
            seatNo: seatNo,
          },
        });

        if (!playerInSeat) {
          throw new Error('Switching seat failed');
        }

        // send an update message
        await Nats.notifyPlayerSwitchSeat(
          this.game,
          player,
          playerInSeat,
          oldSeatNo
        );

        logger.info(
          `[${this.game.gameCode}] Player: ${player.name} switched to seat: ${seatNo}`
        );

        return [playerInSeat, true];
      }
    );

    if (!playerInGame) {
      return PlayerStatus.PLAYER_UNKNOWN_STATUS;
    }
    return playerInGame.status;
  }
}

export async function getCurrentSeats(
  game: PokerGame,
  transactionManager?: EntityManager
): Promise<Array<SeatUpdate>> {
  let repository: Repository<PlayerGameTracker>;
  if (transactionManager) {
    repository = transactionManager.getRepository(PlayerGameTracker);
  } else {
    repository = getGameRepository(PlayerGameTracker);
  }

  // query using the seat number and send update
  const seatUpdates = new Array<SeatUpdate>();
  for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
    const playersInSeat = await repository.find({
      game: {id: game.id},
      seatNo: seatNo,
    });

    if (playersInSeat.length > 1) {
      // trouble here
      logger.error(
        `${game.gameCode} Unexpected number of players sitting in the same seat`
      );
    }
    if (playersInSeat.length === 0) {
      // open seat
      seatUpdates.push({
        seatNo: seatNo,
        openSeat: true,
      });
    } else {
      // a player is in the seat
      const playerInSeat = playersInSeat[0];
      seatUpdates.push({
        seatNo: seatNo,
        openSeat: false,
        playerId: playerInSeat.playerId,
        playerUuid: playerInSeat.playerUuid,
        name: playerInSeat.playerName,
        stack: playerInSeat.stack,
        status: playerInSeat.status,
      });
    }
  }
  return seatUpdates;
}

export async function hostSeatChangePlayers(
  gameCode: string,
  transactionManager?: EntityManager
): Promise<Array<any>> {
  const query = fixQuery(`SELECT player_id as "playerId", name, 
        player_uuid as "playerUuid", stack, 
        seat_no as "seatNo", open_seat as "openSeat" 
        FROM host_seat_change_process WHERE game_code=? ORDER BY seat_no`);
  let resp;
  if (transactionManager) {
    resp = await transactionManager.query(query, [gameCode]);
  } else {
    resp = await getGameConnection().query(query, [gameCode]);
  }
  return resp;
}
