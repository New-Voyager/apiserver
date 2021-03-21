import {PlayerGameTracker} from '@src/entity/chipstrack';
import {NextHandUpdates, PokerGame, PokerGameUpdates} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {
  NextHandUpdate,
  PlayerStatus,
  SeatChangeProcessType,
} from '@src/entity/types';
import {getLogger} from '@src/utils/log';
import {
  EntityManager,
  getConnection,
  getManager,
  getRepository,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import * as _ from 'lodash';
import {
  initiateSeatChangeProcess,
  pendingProcessDone,
  playerSwitchSeat,
  startTimer,
  hostSeatChangeProcessEnded,
  hostSeatChangeProcessStarted,
  hostSeatChangeSeatMove,
} from '@src/gameserver';
import {WaitListMgmt} from './waitlist';
import {SEATCHANGE_PROGRSS} from './types';
import {GameRepository} from './game';
import {HostSeatChangeProcess} from '@src/entity/seatchange';
import * as Constants from '../const';
import {SeatMove, SeatUpdate} from '@src/types';
import { fixQuery } from '@src/utils';

const logger = getLogger('seatchange');

export class SeatChangeProcess {
  game: PokerGame;

  constructor(game: PokerGame) {
    this.game = game;
  }

  public async start() {
    const players = await this.getSeatChangeRequestedPlayers();
    if (players.length === 0) {
      return;
    }

    const playerIds = players.map(x => x.id);
    const playerSeatNos = await this.getSeatChangeRequestedPlayersSeatNo();

    // first set the game that we are in seat change process
    const gameUpdatesRepo = getRepository(PokerGameUpdates);
    await gameUpdatesRepo.update(
      {
        gameID: this.game.id,
      },
      {
        seatChangeInProgress: true,
      }
    );
    const expTime = new Date();
    const timeout = this.game.seatChangeTimeout;
    expTime.setSeconds(expTime.getSeconds() + timeout);
    logger.info(
      `[${
        this.game.gameCode
      }] Started Seat change timer. Expires at ${expTime.toISOString()}`
    );

    // notify game server, seat change process has begun
    await initiateSeatChangeProcess(
      this.game,
      0,
      timeout,
      playerIds,
      playerSeatNos
    );

    // start seat change process timer
    await startTimer(this.game.id, 0, SEATCHANGE_PROGRSS, expTime);
  }

  // called from the seat change timer callback to finish seat change processing
  public async finish() {
    logger.info('****** STARTING TRANSACTION TO FINISH seat change');
    logger.info(`[${this.game.gameCode}] Seat change timer expired`);
    const switchedSeats = await getManager().transaction(
      async transactionEntityManager => {
        // get all the switch seat requests
        const nextHandUpdatesRepository = transactionEntityManager.getRepository(
          NextHandUpdates
        );
        const requests = await nextHandUpdatesRepository.find({
          where: {
            game: {id: this.game.id},
            newUpdate: NextHandUpdate.SWITCH_SEAT,
          },
        });
        const switchedSeats: Array<any> = new Array<any>();

        if (requests.length !== 0) {
          // get list of players ids who have confirmed to change seat
          const playerIDs = requests.map(x => x.player.id);
          const seatChangePlayers = await this.getSeatChangeRequestedPlayers(
            transactionEntityManager
          );
          const seatsTaken = new Array<number>();
          for (const player of seatChangePlayers) {
            if (playerIDs.indexOf(player.id) !== -1) {
              // find the seat the user requested
              const playerRequests = _.filter(
                requests,
                x => x.player.id === player.id
              );
              // there should be only one
              if (playerRequests.length !== 1) {
                continue;
              }
              // if the requested seat is already taken, skip this player
              const requestedSeat = playerRequests[0].newSeat;
              if (seatsTaken.indexOf(requestedSeat) !== -1) {
                logger.info(
                  `Player: ${player.name} (${player.id}) is already taken by antoher player`
                );
                continue;
              }

              // this user will be granted to switch seat
              logger.info(
                `Player: ${player.name} (${player.id}) will switch to new seat: ${requestedSeat}`
              );
              const playerGameTrackerRepository = transactionEntityManager.getRepository(
                PlayerGameTracker
              );
              await playerGameTrackerRepository.update(
                {
                  game: {id: this.game.id},
                  player: {id: player.id},
                },
                {
                  seatNo: requestedSeat,
                  seatChangeRequestedAt: null,
                }
              );
              seatsTaken.push(requestedSeat);
              switchedSeats.push({
                player: player,
                seatNo: requestedSeat,
              });
            }
          }
        }

        // remove switch seat updates for the game
        await nextHandUpdatesRepository.delete({
          game: {id: this.game.id},
          newUpdate: NextHandUpdate.SWITCH_SEAT,
        });

        return switchedSeats;
      }
    );
    logger.info('****** ENDING TRANSACTION TO FINISH seat change');

    // send message to game server with new updates
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    for (const switchedSeat of switchedSeats) {
      const playerInGame = await playerGameTrackerRepository.findOne({
        relations: ['player', 'game'],
        where: {
          game: {id: this.game.id},
          player: {id: switchedSeat.player.id},
        },
      });
      if (!playerInGame) {
        continue;
      }

      await playerSwitchSeat(this.game, playerInGame.player, playerInGame);
    }

    // mark the seat change process is done
    const gameUpdatesRepo = getRepository(PokerGameUpdates);
    await gameUpdatesRepo.update(
      {
        gameID: this.game.id,
      },
      {
        seatChangeInProgress: false,
      }
    );

    // notify game server to resume the game
    await pendingProcessDone(this.game.id);

    // run wait list processing
    const waitlistProcess = new WaitListMgmt(this.game);
    waitlistProcess.runWaitList();
    return switchedSeats;
  }

  public async requestSeatChange(player: Player): Promise<Date | null> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'game'],
      where: {
        game: {id: this.game.id},
        player: {id: player.id},
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

    playerInGame.seatChangeRequestedAt = new Date();

    const resp = await playerGameTrackerRepository.save(playerInGame);
    return resp.seatChangeRequestedAt;
  }

  public async seatChangeRequests(
    player: Player
  ): Promise<PlayerGameTracker[]> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'game'],
      where: {
        game: {id: this.game.id},
        player: {id: player.id},
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
      relations: ['player', 'game'],
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

  public async confirmSeatChange(
    player: Player,
    seatNo: number
  ): Promise<boolean> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    let playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'game'],
      where: {
        game: {id: this.game.id},
        player: {id: player.id},
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
    if (!seatNo) {
      // get a first open seat
      seatNo = await this.getNextAvailableSeat();
      if (!seatNo) {
        throw new Error(`No seats avaialble in game ${this.game.gameCode}`);
      }
    }

    // make sure this seat is open
    playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'game'],
      where: {
        game: {id: this.game.id},
        seatNo: seatNo,
      },
    });
    if (playerInGame) {
      // there is a player in the seat
      throw new Error('A player already sits in the seat');
    }

    // if the user has an existing switch seat request, update to the new seat request
    const nextHandUpdatesRepository = getRepository(NextHandUpdates);
    const existingRequest = await nextHandUpdatesRepository.findOne({
      where: {
        game: {id: this.game.id},
        player: {id: player.id},
        newUpdate: NextHandUpdate.SWITCH_SEAT,
      },
    });
    if (!existingRequest) {
      const update = new NextHandUpdates();
      update.game = this.game;
      update.player = player;
      update.newUpdate = NextHandUpdate.SWITCH_SEAT;
      update.newSeat = seatNo;
      await nextHandUpdatesRepository.save(update);
    } else {
      existingRequest.newSeat = seatNo;
      await nextHandUpdatesRepository.save(existingRequest);
    }

    return true;
  }

  async getSeatChangeRequestedPlayers(transactionManager?: EntityManager) {
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;
    if (transactionManager) {
      playerGameTrackerRepository = transactionManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepository = getRepository(PlayerGameTracker);
    }
    const players = await playerGameTrackerRepository.find({
      relations: ['player'],
      order: {seatChangeRequestedAt: 'ASC'},
      where: {
        game: {id: this.game.id},
        seatChangeRequestedAt: Not(IsNull()),
        status: PlayerStatus.PLAYING,
      },
    });
    return players.map(x => x.player);
  }

  async getSeatChangeRequestedPlayersSeatNo(
    transactionManager?: EntityManager
  ) {
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;
    if (transactionManager) {
      playerGameTrackerRepository = transactionManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepository = getRepository(PlayerGameTracker);
    }
    const players = await playerGameTrackerRepository.find({
      relations: ['player'],
      order: {seatChangeRequestedAt: 'ASC'},
      where: {
        game: {id: this.game.id},
        seatChangeRequestedAt: Not(IsNull()),
        status: PlayerStatus.PLAYING,
      },
    });
    return players.map(x => x.seatNo);
  }

  async getNextAvailableSeat(): Promise<number> {
    const playersInSeats = await GameRepository.getPlayersInSeats(this.game.id);
    for (const player of playersInSeats) {
      player.status = PlayerStatus[player.status];
    }

    const takenSeats = playersInSeats.map(x => x.seatNo);
    const availableSeats: Array<number> = [];
    for (let seatNo = 1; seatNo <= this.game.maxPlayers; seatNo++) {
      if (takenSeats.indexOf(seatNo) === -1) {
        availableSeats.push(seatNo);
      }
    }

    if (availableSeats.length === 0) {
      return 0;
    }
    return availableSeats[0];
  }

  public async beginHostSeatChange(host: Player) {
    // first remove entries from the HostSeatChangeProcess table
    await getRepository(HostSeatChangeProcess).delete({
      gameCode: this.game.gameCode,
    });

    await getManager().transaction(async transactionEntityManager => {
      const playerGameTrackerRepo = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      const seatChangeProcessRepo = transactionEntityManager.getRepository(
        HostSeatChangeProcess
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
          seatChangePlayer.name = player.player.name;
          seatChangePlayer.playerId = player.player.id;
          seatChangePlayer.playerUuid = player.player.uuid;
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
      await hostSeatChangeProcessStarted(this.game, host.id);
    });
  }

  public async swapSeats(seatNo1: number, seatNo2: number): Promise<boolean> {
    await getManager().transaction(async transactionEntityManager => {
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
      await hostSeatChangeSeatMove(this.game, seatMoves);
    });

    return true;
  }

  public async hostSeatChangeComplete(host: Player) {
    await getManager().transaction(async transactionEntityManager => {
      const seatChangeProcessRepo = transactionEntityManager.getRepository(
        HostSeatChangeProcess
      );
      const playerGameTrackerRepo = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      const seatChangedPlayers = await seatChangeProcessRepo.find({
        gameCode: this.game.gameCode,
      });
      for (const player of seatChangedPlayers) {
        if (player.playerId != null) {
          await playerGameTrackerRepo.update(
            {
              game: {id: this.game.id},
              player: {id: player.playerId},
            },
            {
              seatNo: player.seatNo,
            }
          );
        }
      }

      // delete rows from host seat process table
      await seatChangeProcessRepo.delete({
        gameCode: this.game.gameCode,
      });
      const currentSeatStatus = await getCurrentSeats(
        this.game,
        transactionEntityManager
      );
      // notify the players seat change process has ended
      await hostSeatChangeProcessEnded(this.game, currentSeatStatus, host.id);
    });
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
    repository = getRepository(PlayerGameTracker);
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
        playerId: playerInSeat.player.id,
        playerUuid: playerInSeat.player.uuid,
        name: playerInSeat.player.name,
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
    resp = await getConnection().query(query, [gameCode]);
  }
  return resp;
}
