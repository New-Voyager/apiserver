import {Cache} from '@src/cache';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {PokerGame, PokerGameSeatInfo} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {GameType, PlayerStatus} from '@src/entity/types';
// import {waitlistSeating} from '@src/gameserver';
import {startTimer, cancelTimer} from '@src/timer';
import {fixQuery} from '@src/utils';
import {getLogger} from '@src/utils/log';
import {EntityManager, Equal, IsNull, Not, Repository} from 'typeorm';
import {WAITLIST_SEATING} from './types';
import * as crypto from 'crypto';
import {v4 as uuidv4} from 'uuid';
import {Nats} from '@src/nats';
import {WaitlistSeatError} from '@src/errors';
import {getGameConnection, getGameManager, getGameRepository} from '.';

const logger = getLogger('repositories::waitlist');

export async function occupiedSeats(gameId: number): Promise<number> {
  const query = fixQuery(
    'SELECT COUNT(*) as occupied FROM player_game_tracker WHERE pgt_game_id = ? AND (seat_no <> 0)'
  );
  const resp = await getGameConnection().query(query, [gameId]);
  return resp[0]['occupied'];
}

// Handles all the functionalities related to waitlist management
export class WaitListMgmt {
  private game: PokerGame;

  constructor(game: PokerGame) {
    this.game = game;
  }

  public async seatPlayer(
    player: Player,
    seatNo: number,
    transactionManager?: EntityManager
  ) {
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;
    let gameSeatInfoRepo: Repository<PokerGameSeatInfo>;
    if (transactionManager) {
      playerGameTrackerRepository = transactionManager.getRepository(
        PlayerGameTracker
      );
      gameSeatInfoRepo = transactionManager.getRepository(PokerGameSeatInfo);
    } else {
      playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
      gameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);
    }

    // join game waitlist seating in progress flag
    // if set to true, only the player with WAITLIST_SEATING is allowed to sit
    // if WAITLIST_SEATING player is sitting, change status to PLAYING, update waitingFrom, waitlist_sitting_exp
    // cancel timer
    const playerAskedToSit = await playerGameTrackerRepository.findOne({
      where: {
        game: {id: this.game.id},
        status: PlayerStatus.WAITLIST_SEATING,
      },
    });
    if (!playerAskedToSit) {
      // no-one from the waiting list asked to be sit, something happened
      gameSeatInfoRepo.update(
        {
          gameID: this.game.id,
        },
        {
          waitlistSeatingInprogress: false,
        }
      );
      // continue to sit this player in the seat
    } else {
      if (playerAskedToSit.playerId !== player.id) {
        throw new WaitlistSeatError(playerAskedToSit.playerName);
      }

      cancelTimer(this.game.id, player.id, WAITLIST_SEATING);

      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: this.game.id},
          status: PlayerStatus.IN_QUEUE,
        },
      });
      await gameSeatInfoRepo.update(
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

  public async declineWaitlistSeat(player: Player) {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const gameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);
    logger.debug(
      `Player [${player.name}: ${player.id}] declined to join the game. ${this.game.gameCode}`
    );

    // join game waitlist seating in progress flag
    // if set to true, only the player with WAITLIST_SEATING is allowed to sit
    // if WAITLIST_SEATING player is sitting, change status to PLAYING, update waitingFrom, waitlist_sitting_exp
    // cancel timer
    const playerAskedToSit = await playerGameTrackerRepository.findOne({
      where: {
        game: {id: this.game.id},
        status: PlayerStatus.WAITLIST_SEATING,
      },
    });

    if (playerAskedToSit && playerAskedToSit.playerId === player.id) {
      cancelTimer(this.game.id, player.id, WAITLIST_SEATING);

      // remove this player from waiting list
      await playerGameTrackerRepository.update(
        {
          game: {id: this.game.id},
          playerId: player.id,
        },
        {
          status: PlayerStatus.NOT_PLAYING,
        }
      );
    }

    const count = await playerGameTrackerRepository.count({
      where: {
        game: {id: this.game.id},
        status: PlayerStatus.IN_QUEUE,
      },
    });
    await gameSeatInfoRepo.update(
      {
        gameID: this.game.id,
      },
      {
        playersInWaitList: count,
        waitlistSeatingInprogress: false,
      }
    );
    if (count > 0) {
      // continue to run the waitlist seating
      this.runWaitList();
    }
    return true;
  }

  protected async resetExistingWaitingList() {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    // eslint-disable-next-line no-constant-condition
    const waitingPlayers = await playerGameTrackerRepository.update(
      {
        game: {id: this.game.id},
        status: PlayerStatus.WAITLIST_SEATING,
      },
      {
        waitingFrom: null,
        waitlistNum: 0,
        waitingListTimeExp: null,
        status: PlayerStatus.NOT_PLAYING,
      }
    );
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
      logger.debug(`No open seats in game: ${this.game.gameCode}`);
      return;
    }
    await this.resetExistingWaitingList();

    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);

    // eslint-disable-next-line no-constant-condition
    // get the first guy from the wait list
    const waitingPlayers = await playerGameTrackerRepository.find({
      relations: ['game'],
      where: {
        game: {id: gameId},
        waitingFrom: Not(IsNull()),
        waitlistNum: Not(Equal(0)),
        status: PlayerStatus.IN_QUEUE,
      },
      order: {
        waitlistNum: 'ASC',
      },
    });
    if (waitingPlayers.length === 0) {
      // logger.info(`Game: ${this.game.gameCode} No players in the waiting list`);
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
              playerId: player.playerId,
            },
            {
              status: PlayerStatus.NOT_PLAYING,
              waitingFrom: null,
              waitingListTimeExp: null,
              waitlistNum: 0,
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

    const gameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);

    if (!nextPlayer) {
      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: gameId},
          status: PlayerStatus.IN_QUEUE,
        },
      });
      await gameSeatInfoRepo.update(
        {
          gameID: gameId,
        },
        {
          playersInWaitList: count,
          waitlistSeatingInprogress: false,
        }
      );

      //logger.info(`Game: ${gameId} No players in the waiting list`);
      // notify all the users waiting list process is complete
      return;
    }
    const gameSettings = await Cache.getGameSettings(this.game.gameCode);
    if (!gameSettings) {
      throw new Error(
        `Game code: ${this.game.gameCode} is not found in PokerGameSettings`
      );
    }

    const waitingListTimeExp = new Date();
    const timeout = gameSettings.waitlistSittingTimeout;
    waitingListTimeExp.setSeconds(waitingListTimeExp.getSeconds() + timeout);
    await playerGameTrackerRepository.update(
      {
        game: {id: gameId},
        playerId: nextPlayer.playerId,
      },
      {
        status: PlayerStatus.WAITLIST_SEATING,
        waitingListTimeExp: waitingListTimeExp,
      }
    );
    const count = await playerGameTrackerRepository.count({
      where: {
        game: {id: gameId},
        status: PlayerStatus.IN_QUEUE,
      },
    });

    await gameSeatInfoRepo.update(
      {gameID: gameId},
      {
        waitlistSeatingInprogress: true,
        playersInWaitList: count,
      }
    );

    startTimer(
      gameId,
      nextPlayer.playerId,
      WAITLIST_SEATING,
      waitingListTimeExp
    );
    const game = await Cache.getGameById(gameId);
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }
    logger.debug(
      `Game: [${game.gameCode}], Player: ${nextPlayer.playerName}:${nextPlayer.playerUuid} is requested to take open seat`
    );
    // we will send a notification which player is coming to the table
    const player = await Cache.getPlayer(nextPlayer.playerUuid);
    // await waitlistSeating(nextPlayer.game, player, timeout);
    let clubName = '';
    if (game.clubName !== null) {
      clubName = game.clubName;
    }
    const messageId = uuidv4();
    const title = `${GameType[game.gameType]} ${game.smallBlind}/${
      game.bigBlind
    }`;
    Nats.sendWaitlistMessage(
      game.gameCode,
      game.gameType,
      game,
      title,
      clubName,
      player,
      waitingListTimeExp,
      messageId
    );
  }

  public async addToWaitingList(playerUuid: string) {
    logger.debug('****** STARTING TRANSACTION TO ADD a player to waitlist');
    const player = await Cache.getPlayer(playerUuid);
    let playerInGame = await getGameRepository(PlayerGameTracker).findOne({
      where: {
        game: {id: this.game.id},
        playerId: player.id,
      },
    });
    await getGameManager().transaction(async transactionEntityManager => {
      // add this user to waiting list
      // if this user is already playing, then he cannot be in the waiting list
      const playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );

      if (playerInGame) {
        // if the player is already playing, the user cannot add himself to the waiting list
        if (playerInGame.status === PlayerStatus.PLAYING) {
          throw new Error(
            'Playing in the seat cannot be added to waiting list'
          );
        }
      } else {
        // player is not in the game
        playerInGame = new PlayerGameTracker();
        //playerInGame.player = await Cache.getPlayer(playerUuid);
        playerInGame.playerId = player.id;
        playerInGame.playerName = player.name;
        playerInGame.playerUuid = player.uuid;
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

      await playerGameTrackerRepository
        .createQueryBuilder()
        .update()
        .set({
          status: PlayerStatus.IN_QUEUE,
          waitingFrom: new Date(),
        })
        .where({
          game: {id: this.game.id},
          playerId: player.id,
        })
        .execute();
      // update players in waiting list column
      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: this.game.id},
          status: PlayerStatus.IN_QUEUE,
        },
      });

      const gameSeatInfoRepo = transactionEntityManager.getRepository(
        PokerGameSeatInfo
      );
      await gameSeatInfoRepo.update(
        {
          gameID: this.game.id,
        },
        {playersInWaitList: count}
      );
    });
    getGameRepository(PlayerGameTracker)
      .createQueryBuilder()
      .update()
      .set({
        waitlistNum: () =>
          `(select MAX(waitlist_num)+1 from player_game_tracker where pgt_game_id=${this.game.id})`,
      })
      .where({
        game: {id: this.game.id},
        playerId: player.id,
      })
      .execute();
    logger.debug('****** ENDING TRANSACTION TO ADD a player to waitlist');
  }

  public async removeFromWaitingList(playerUuid: string) {
    await getGameManager().transaction(async transactionEntityManager => {
      // remove this user from waiting list
      const playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      const player = await Cache.getPlayer(playerUuid);
      const playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: this.game.id},
          playerId: player.id,
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
          playerId: player.id,
        },
        {
          status: PlayerStatus.NOT_PLAYING,
          waitingFrom: null,
          waitlistNum: 0,
        }
      );

      // update players in waiting list column
      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: this.game.id},
          status: PlayerStatus.IN_QUEUE,
        },
      });

      const gameSeatInfoRepo = transactionEntityManager.getRepository(
        PokerGameSeatInfo
      );
      await gameSeatInfoRepo.update(
        {
          gameID: this.game.id,
        },
        {playersInWaitList: count}
      );
    });
  }

  public async getWaitingListUsers() {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const waitListPlayers = await playerGameTrackerRepository.find({
      where: {
        game: {id: this.game.id},
        waitingFrom: Not(IsNull()),
        waitlistNum: Not(Equal(0)),
      },
      order: {
        waitlistNum: 'ASC',
      },
    });

    const ret = waitListPlayers.map(x => {
      return {
        playerUuid: x.playerUuid,
        name: x.playerName,
        waitingFrom: x.waitingFrom,
        status: PlayerStatus[x.status],
        waitlistNum: x.waitlistNum,
      };
    });

    return ret;
  }

  public async applyWaitlistOrder(players: Array<string>) {
    await getGameManager().transaction(async transactionEntityManager => {
      const playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: this.game.id},
          waitingFrom: Not(IsNull()),
          waitlistNum: Not(Equal(0)),
        },
      });
      if (count !== players.length) {
        logger.debug(
          `Waiting list count: Expected - ${count} but received - ${players.length}`
        );
        throw new Error(
          `Waiting list count: Expected - ${count} but received - ${players.length}`
        );
      }
      await playerGameTrackerRepository.update(
        {
          game: {id: this.game.id},
          waitingFrom: Not(IsNull()),
          waitlistNum: Not(Equal(0)),
        },
        {
          waitlistNum: 0,
        }
      );

      let i = 1;
      for await (const playerUuid of players) {
        const player = await Cache.getPlayer(playerUuid);
        await playerGameTrackerRepository.update(
          {
            game: {id: this.game.id},
            playerId: player.id,
          },
          {
            waitlistNum: i,
          }
        );
        i += 1;
      }
    });
  }
}
