import {PlayerGameTracker} from '@src/entity/chipstrack';
import {NextHandUpdates, PokerGame, PokerGameUpdates} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {NextHandUpdate, PlayerStatus} from '@src/entity/types';
import {getLogger} from '@src/utils/log';
import {getManager, getRepository, IsNull, Not} from 'typeorm';
import * as _ from 'lodash';
import {
  pendingProcessDone,
  playerSwitchSeat,
  startTimer,
} from '@src/gameserver';
import {WaitListMgmt} from './waitlist';
import {SEATCHANGE_PROGRSS} from './types';
const logger = getLogger('seatchange');

export class SeatChangeProcess {
  game: PokerGame;

  constructor(game: PokerGame) {
    this.game = game;
  }

  public async start() {
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
    const timeout = 30; // nextPlayer.game.waitListSittingTimeout
    expTime.setSeconds(expTime.getSeconds() + timeout);

    // notify game server, seat change process has begun
    await startTimer(this.game.id, 0, SEATCHANGE_PROGRSS, expTime);

    // start seat change process timer
  }

  // called from the seat change timer callback to finish seat change processing
  public async finish() {
    const switchedSeats = await getManager().transaction(async () => {
      // get all the switch seat requests
      const nextHandUpdatesRepository = getRepository(NextHandUpdates);
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
        const seatChangePlayers = await this.getSeatChangeRequestedPlayers();
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
            const playerGameTrackerRepository = getRepository(
              PlayerGameTracker
            );
            playerGameTrackerRepository.update(
              {
                game: {id: this.game.id},
                player: {id: player.id},
              },
              {
                seatNo: requestedSeat,
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
    });

    // send message to game server with new updates
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    for (const switchedSeat of switchedSeats) {
      const playerInGame = await playerGameTrackerRepository.findOne({
        relations: ['player', 'club', 'game'],
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
        seatChangeInProgress: true,
      }
    );

    // notify game server to resume the game
    await pendingProcessDone(this.game.id);

    // run wait list processing
    const waitlistProcess = new WaitListMgmt(this.game);
    waitlistProcess.runWaitList();
  }

  public async requestSeatChange(player: Player): Promise<Date | null> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
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
    playerInGame.seatChangeConfirmed = false;

    const resp = await playerGameTrackerRepository.save(playerInGame);
    return resp.seatChangeRequestedAt;
  }

  public async seatChangeRequests(
    player: Player
  ): Promise<PlayerGameTracker[]> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
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

    const allPlayersInGame = await playerGameTrackerRepository.find({
      relations: ['player', 'club', 'game'],
      order: {
        seatChangeRequestedAt: 'ASC',
      },
      where: {
        game: {id: this.game.id},
        status: PlayerStatus.PLAYING,
        seatChangeRequestedAt: Not(IsNull()),
      },
    });

    return allPlayersInGame;
  }

  public async confirmSeatChange(
    player: Player,
    seatNo: number
  ): Promise<boolean> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    let playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
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

    // make sure this seat is open
    playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
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

  async getSeatChangeRequestedPlayers() {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
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

  /*
  public async handleSeatChange(gameCode: string) {
    const game = await getGame(gameCode);
    if (!game) {
      logger.error(`Game ${gameCode} is not found`);
      // throw new Error(`Game ${gameCode} is not found`);
      return true;
    }

    const playersInSeats = await this.getPlayersInSeats(game.id);
    const takenSeats = playersInSeats.map(x => x.seatNo);
    const availableSeats: Array<number> = [];
    for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
      if (takenSeats.indexOf(seatNo) === -1) {
        availableSeats.push(seatNo);
      }
    }

    const pickedSeat = min(availableSeats);
    if (!pickedSeat) {
      logger.error('No seats available');
      // throw new Error('No seats available');
      return true;
    }

    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.find({
      relations: ['player', 'club', 'game'],
      order: {seatChangeRequestedAt: 'ASC'},
      where: {
        game: {id: game.id},
        seatChangeConfirmed: true,
        seatChangeRequestedAt: Not(IsNull()),
        status: PlayerStatus.PLAYING,
      },
    });

    if (!playerInGame.length || !playerInGame[0]) {
      logger.error('No player found');
      // throw new Error('No player found');
      return true;
    }
    const selectedPlayer = playerInGame[0];

    await playerGameTrackerRepository.update(
      {
        game: {id: game.id},
      },
      {
        seatChangeConfirmed: false,
      }
    );

    await playerGameTrackerRepository.update(
      {
        game: {id: game.id},
        player: {id: selectedPlayer.player.id},
      },
      {
        seatChangeRequestedAt: null,
        seatNo: pickedSeat,
      }
    );

    return true;
  }
  */
}
