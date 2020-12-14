import {Cache} from '@src/cache';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {PokerGame, PokerGameUpdates} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {PlayerStatus} from '@src/entity/types';
import {cancelTimer, gameUpdate, startTimer} from '@src/gameserver';
import {isPostgres} from '@src/utils';
import {getLogger} from '@src/utils/log';
import {getConnection, getManager, getRepository, IsNull, Not} from 'typeorm';
import {WAITLIST_SEATING} from './types';
import * as crypto from 'crypto';

const logger = getLogger('waitlist');

export async function occupiedSeats(gameId: number): Promise<number> {
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

// Handles all the functionalities related to waitlist management
export class WaitListMgmt {
  private game: PokerGame;

  constructor(game: PokerGame) {
    this.game = game;
  }

  public async seatPlayer(player: Player) {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const gameUpdateRepo = getRepository(PokerGameUpdates);

    // join game waitlist seating in progress flag
    // if set to true, only the player with WAITLIST_SEATING is allowed to sit
    // if WAITLIST_SEATING player is sitting, change status to PLAYING, update waitingFrom, waitlist_sitting_exp
    // cancel timer
    const playerAskedToSit = await playerGameTrackerRepository.findOne({
      relations: ['player'],
      where: {
        game: {id: this.game.id},
        status: PlayerStatus.WAITLIST_SEATING,
      },
    });
    if (!playerAskedToSit) {
      // no-one from the waiting list asked to be sit, something happened
      gameUpdateRepo.update(
        {
          gameID: this.game.id,
        },
        {
          waitlistSeatingInprogress: false,
        }
      );
      // continue to sit this player in the seat
    } else {
      if (playerAskedToSit.player.id !== player.id) {
        throw new Error(
          `Waitlist seating inprogress. Player ${player.name} cannot sit in the table`
        );
      }

      cancelTimer(this.game.id, player.id, WAITLIST_SEATING);
      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: this.game.id},
          status: PlayerStatus.IN_QUEUE,
        },
      });
      await gameUpdateRepo.update(
        {
          gameID: this.game.id,
        },
        {
          playersInWaitList: count,
          waitlistSeatingInprogress: false,
        }
      );
    }
  }

  // get the first guy from the wait list
  // if the timer expired, cancel the timer and change the user to status, NOT_PLAYING, waitingFrom: null, waitlist_sitting_exp: null
  // if no-one is in the wait list, set waitlist seating in progress to false
  // mark waitlist seating in progress to true
  // update status: WAITLIST_SEATING waitlist_sitting_exp timeout
  // start the timer
  // notify game server to send message to players
  public async runWaitList() {
    const gameId = this.game.id;
    const seatsTaken = await occupiedSeats(gameId);
    if (seatsTaken === this.game.maxPlayers) {
      logger.info(`No open seats in game: ${this.game.gameCode}`);
      return;
    }

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
      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: this.game.id},
          status: PlayerStatus.IN_QUEUE,
        },
      });
      await gameUpdatesRepo.update(
        {
          gameID: this.game.id,
        },
        {
          playersInWaitList: count,
          waitlistSeatingInprogress: false,
        }
      );

      logger.info(`Game: ${gameId} No players in the waiting list`);
      // notify all the users waiting list process is complete
      return;
    }

    const waitingListTimeExp = new Date();
    const timeout = this.game.waitlistSittingTimeout;
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
    const count = await playerGameTrackerRepository.count({
      where: {
        game: {id: this.game.id},
        status: PlayerStatus.IN_QUEUE,
      },
    });

    await gameUpdatesRepo.update(
      {gameID: nextPlayer.game.id},
      {
        waitlistSeatingInprogress: true,
        playersInWaitList: count,
      }
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

  public async addToWaitingList(playerUuid: string) {
    await getManager().transaction(async () => {
      // add this user to waiting list
      // if this user is already playing, then he cannot be in the waiting list
      const playerGameTrackerRepository = getRepository(PlayerGameTracker);

      const player = await Cache.getPlayer(playerUuid);
      let playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: this.game.id},
          player: {id: player.id},
        },
      });

      if (playerInGame) {
        // if the player is already playing, the user cannot add himself to the waiting list
        if (playerInGame.status === PlayerStatus.PLAYING) {
          throw new Error(
            'Playing in the seat cannot be added to waiting list'
          );
        }

        await playerGameTrackerRepository.update(
          {
            game: {id: this.game.id},
            player: {id: player.id},
          },
          {
            status: PlayerStatus.IN_QUEUE,
            waitingFrom: new Date(),
          }
        );
      } else {
        // player is not in the game
        playerInGame = new PlayerGameTracker();
        playerInGame.player = await Cache.getPlayer(playerUuid);
        playerInGame.club = this.game.club;
        playerInGame.game = this.game;
        playerInGame.buyIn = 0;
        playerInGame.stack = 0;
        playerInGame.seatNo = 0;
        const randomBytes = Buffer.from(crypto.randomBytes(5));
        playerInGame.gameToken = randomBytes.toString('hex');
        playerInGame.status = PlayerStatus.IN_QUEUE;
        playerInGame.waitingFrom = new Date();
        await playerGameTrackerRepository.save(playerInGame);
      }

      // update players in waiting list column
      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: this.game.id},
          status: PlayerStatus.IN_QUEUE,
        },
      });

      const gameUpdatesRepo = getRepository(PokerGameUpdates);
      await gameUpdatesRepo.update(
        {
          gameID: this.game.id,
        },
        {playersInWaitList: count}
      );
    });
  }

  public async removeFromWaitingList(playerUuid: string) {
    await getManager().transaction(async () => {
      // remove this user from waiting list
      const playerGameTrackerRepository = getRepository(PlayerGameTracker);
      const player = await Cache.getPlayer(playerUuid);
      const playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: this.game.id},
          player: {id: player.id},
        },
      });

      if (!playerInGame) {
        // this user is not in the game, nothing to do
        throw new Error('Player is not in the waiting list');
      }
      if (playerInGame.status !== PlayerStatus.IN_QUEUE) {
        throw new Error(`Player: ${player.name} is not in the waiting list`);
      }
      // only waiting list users should be here
      await playerGameTrackerRepository.update(
        {
          game: {id: this.game.id},
          player: {id: player.id},
        },
        {
          status: PlayerStatus.NOT_PLAYING,
          waitingFrom: null,
        }
      );

      // update players in waiting list column
      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: this.game.id},
          status: PlayerStatus.IN_QUEUE,
        },
      });

      const gameUpdatesRepo = getRepository(PokerGameUpdates);
      await gameUpdatesRepo.update(
        {
          gameID: this.game.id,
        },
        {playersInWaitList: count}
      );
    });
  }

  public async getWaitingListUsers() {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const waitListPlayers = await playerGameTrackerRepository.find({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: this.game.id},
        waitingFrom: Not(IsNull()),
      },
      order: {
        waitingFrom: 'ASC',
      },
    });

    const ret = waitListPlayers.map(x => {
      return {
        playerUuid: x.player.uuid,
        name: x.player.name,
        waitingFrom: x.waitingFrom,
        status: PlayerStatus[x.status],
      };
    });

    return ret;
  }
}
