import {EntityManager, In, UpdateResult} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache';
import {Player} from '@src/entity/player/player';
import {gameLogPrefix, NextHandUpdates, PokerGame} from '@src/entity/game/game';
import {
  ApprovalStatus,
  ApprovalType,
  CreditUpdateType,
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
} from '@src/entity/types';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {GameRepository} from './game';
import {startTimer, cancelTimer} from '@src/timer';
import {
  BUYIN_APPROVAL_TIMEOUT,
  BUYIN_TIMEOUT,
  NewUpdate,
  RELOAD_APPROVAL_TIMEOUT,
} from './types';
import {Club, ClubMember} from '@src/entity/player/club';
import {buyInRequest, pendingApprovalsForClubData} from '@src/types';
import {fixQuery} from '@src/utils';
import {Firebase} from '@src/firebase';
import {PlayerRepository} from './player';
import {
  getGameConnection,
  getGameManager,
  getGameRepository,
  getUserConnection,
  getUserRepository,
} from '.';
import {Nats} from '@src/nats';
import {PlayersInGameRepository} from './playersingame';
import {ClubRepository} from './club';

const logger = getLogger('repositories::buyin');

// Stay below the db column precision.
const MAX_BUYIN = 1000000000;

export class BuyIn {
  private game: PokerGame;
  private player: Player;

  constructor(game: PokerGame, player: Player) {
    this.game = game;
    this.player = player;
  }

  protected async approveBuyInRequest(
    amount: number,
    playerInGame: PlayerGameTracker,
    transactionEntityManager: EntityManager
  ) {
    playerInGame.noOfBuyins++;
    playerInGame.stack += amount;
    playerInGame.buyIn += amount;
    // if the player is in the seat and waiting for buyin
    // then mark his status as playing
    if (
      (playerInGame.seatNo !== 0 &&
        playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN) ||
      playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN_APPROVAL
    ) {
      playerInGame.status = PlayerStatus.PLAYING;
    }
    //}
    const repo = transactionEntityManager.getRepository(PlayerGameTracker);
    await repo.update(
      {
        game: {id: this.game.id},
        playerId: this.player.id,
      },
      {
        status: playerInGame.status,
        stack: playerInGame.stack,
        buyIn: playerInGame.buyIn,
        noOfBuyins: playerInGame.noOfBuyins,
        buyInExpAt: undefined,
      }
    );

    return playerInGame;
  }

  protected async clubMemberBuyInApproval(
    amount: number,
    playerInGame: PlayerGameTracker,
    transactionEntityManager: EntityManager
  ): Promise<[PlayerStatus, boolean]> {
    let approved = false;
    const clubMember = await Cache.getClubMember(
      this.player.uuid,
      this.game.clubCode
    );
    if (!clubMember) {
      throw new Error(`The player ${this.player.uuid} is not in the club`);
    }

    if (amount > MAX_BUYIN || playerInGame.buyIn + amount > MAX_BUYIN) {
      throw new Error('Invalid amount');
    }

    const gameSettings = await Cache.getGameSettings(
      this.game.gameCode,
      false,
      transactionEntityManager
    );

    let playerStatus: PlayerStatus = PlayerStatus.WAIT_FOR_BUYIN;
    let updatedPlayerInGame: PlayerGameTracker;
    let isHost = false;
    if (this.game.hostUuid === this.player.uuid) {
      isHost = true;
    }

    const isMemberCreditTrackingEnabled = false;
    if (
      clubMember.isOwner ||
      clubMember.isManager ||
      clubMember.autoBuyinApproval ||
      !gameSettings.buyInApproval ||
      this.player.bot ||
      isHost
    ) {
      logger.debug(`***** [${this.game.gameCode}] Player: ${this.player.name} buyin approved.
            clubMember: isOwner: ${clubMember.isOwner} isManager: ${clubMember.isManager}
            Auto approval: ${clubMember.autoBuyinApproval}
            isHost: ${isHost} Game.buyInApproval: ${gameSettings.buyInApproval} *****`);
      approved = true;
      updatedPlayerInGame = await this.approveBuyInRequest(
        amount,
        playerInGame,
        transactionEntityManager
      );
      playerStatus = updatedPlayerInGame.status;
    } else {
      let isWithinAutoApprovalLimit = false;
      if (isMemberCreditTrackingEnabled) {
        // Club member auto approval credit.
        const profit = playerInGame.stack - playerInGame.buyIn;
        const credit = clubMember.availableCredit + profit;
        if (amount <= credit) {
          isWithinAutoApprovalLimit = true;
        }
      } else {
        // Per-game auto approval limit.
        if (
          playerInGame.buyIn + amount <=
          playerInGame.buyInAutoApprovalLimit
        ) {
          isWithinAutoApprovalLimit = true;
        }
      }
      if (isWithinAutoApprovalLimit) {
        approved = true;
        await this.approveBuyInRequest(
          amount,
          playerInGame,
          transactionEntityManager
        );
      } else {
        await this.addBuyInToNextHand(
          amount,
          NextHandUpdate.WAIT_BUYIN_APPROVAL,
          transactionEntityManager
        );

        playerInGame.status = PlayerStatus.PENDING_UPDATES;
        playerStatus = PlayerStatus.WAIT_FOR_BUYIN_APPROVAL;
        approved = false;
      }
    }
    if (approved) {
      await ClubRepository.updateCreditAndTracker(
        this.player.uuid,
        this.game.clubCode,
        -amount,
        CreditUpdateType.BUYIN,
        this.game.gameCode
      );
    }
    return [playerStatus, approved];
  }

  public async buyInApproved(
    playerInGame: PlayerGameTracker,
    transactionEntityManager: EntityManager
  ) {
    let databaseTime = new Date().getTime();
    let cancelTime;

    await GameRepository.seatOccupied(
      this.game,
      playerInGame.seatNo,
      transactionEntityManager
    );

    databaseTime = new Date().getTime() - databaseTime;

    cancelTime = new Date().getTime();
    cancelTimer(this.game.id, this.player.id, BUYIN_TIMEOUT).catch(e => {
      logger.error(`Cancelling BUYIN_TIME failed. Error: ${e.message}`);
    });
    cancelTime = new Date().getTime() - cancelTime;

    await Nats.playerStatusChanged(
      this.game,
      this.player,
      PlayerStatus.PLAYING,
      NewUpdate.NEW_BUYIN,
      playerInGame.stack,
      playerInGame.seatNo
    );

    let gameServerTime = new Date().getTime();
    // send a message to gameserver
    // get game server of this game
    const gameServer = await GameRepository.getGameServer(
      this.game.id,
      transactionEntityManager
    );
    Nats.playerBuyIn(this.game, this.player, playerInGame);
    gameServerTime = new Date().getTime() - gameServerTime;

    await GameRepository.restartGameIfNeeded(
      this.game,
      true,
      false /* resumed due to new player */,
      transactionEntityManager
    );
  }

  public async buyInDenied(
    playerInGame: PlayerGameTracker,
    transactionEntityManager: EntityManager
  ) {
    // send a message to gameserver
    // get game server of this game
    const gameServer = await GameRepository.getGameServer(
      this.game.id,
      transactionEntityManager
    );
    await Nats.playerStatusChanged(
      this.game,
      this.player,
      playerInGame.status,
      NewUpdate.BUYIN_DENIED,
      playerInGame.stack,
      playerInGame.seatNo
    );
  }

  public async request(amount: number): Promise<buyInRequest> {
    const timeout = 60;

    const startTime = new Date().getTime();
    let databaseTime = 0;
    let buyInApprovedTime = 0;
    const firebaseTime = 0;

    const [status, approved] = await getGameManager().transaction(
      async transactionEntityManager => {
        databaseTime = new Date().getTime();
        let playerStatus: PlayerStatus;
        let approved: boolean;
        // player must be already in a seat or waiting list
        // if credit limit is set, make sure his buyin amount is within the credit limit
        // if auto approval is set, add the buyin
        // make sure buyin within min and maxBuyin
        // send a message to game server that buyer stack has been updated
        const playerGameTrackerRepository =
          transactionEntityManager.getRepository(PlayerGameTracker);
        logger.info('buyin request');
        const playerInGame = await playerGameTrackerRepository.findOne({
          game: {id: this.game.id},
          playerId: this.player.id,
        });
        if (!playerInGame) {
          logger.error(
            `Player ${this.player.uuid} is not in the game: ${this.game.gameCode}`
          );
          throw new Error(`Player ${this.player.uuid} is not in the game`);
        }
        const prevStatus = playerInGame;

        // check amount should be between game.minBuyIn and game.maxBuyIn
        if (
          playerInGame.stack + amount < this.game.buyInMin ||
          playerInGame.stack + amount > this.game.buyInMax
        ) {
          throw new Error(
            `Buyin must be between ${this.game.buyInMin} and ${this.game.buyInMax}`
          );
        }
        if (this.game.clubCode) {
          // club game
          [playerStatus, approved] = await this.clubMemberBuyInApproval(
            amount,
            playerInGame,
            transactionEntityManager
          );
          await playerGameTrackerRepository.update(
            {
              game: {id: this.game.id},
              playerId: this.player.id,
            },
            {
              status: playerStatus,
            }
          );

          let seatNo = 0;
          if (playerInGame.seatNo) {
            seatNo = playerInGame.seatNo;
          }
          let stack = playerInGame.stack;
          let newUpdate: NewUpdate = NewUpdate.UNKNOWN_PLAYER_UPDATE;
          if (playerStatus === PlayerStatus.WAIT_FOR_BUYIN_APPROVAL) {
            newUpdate = NewUpdate.WAIT_FOR_BUYIN_APPROVAL;
          } else if (approved) {
            newUpdate = NewUpdate.NEW_BUYIN;

            // get current stack
            const updated = await playerGameTrackerRepository.findOne({
              game: {id: this.game.id},
              playerId: this.player.id,
            });
            if (!updated) {
              throw new Error('Unable to get the updated row');
            }
            stack = updated?.stack;
          }
          databaseTime = new Date().getTime() - databaseTime;
          if (!approved) {
            logger.debug(
              `************ [${this.game.gameCode}]: Player ${this.player.name} is waiting for approval`
            );
            // notify game host that the player is waiting for buyin
            const host = await Cache.getPlayerById(this.game.hostId, true);
            await Firebase.notifyBuyInRequest(
              this.game,
              this.player,
              host,
              amount
            );

            // refresh the screen
            Nats.playerStatusChanged(
              this.game,
              this.player,
              prevStatus.status,
              newUpdate,
              stack,
              seatNo
            );
          }
        } else {
          // individual game
          if (this.player.id === this.game.hostId || this.player.bot) {
            // approved
            approved = true;
          } else if (
            playerInGame.buyIn + amount <=
            playerInGame.buyInAutoApprovalLimit
          ) {
            approved = true;
          } else {
            approved = false;
          }

          playerStatus = PlayerStatus.WAIT_FOR_BUYIN_APPROVAL;
          if (approved) {
            const updatedPlayerInGame = await this.approveBuyInRequest(
              amount,
              playerInGame,
              transactionEntityManager
            );
            let stack = updatedPlayerInGame.stack;
            let newUpdate: NewUpdate = NewUpdate.UNKNOWN_PLAYER_UPDATE;
            newUpdate = NewUpdate.NEW_BUYIN;
            // get current stack
            const updated = await playerGameTrackerRepository.findOne({
              game: {id: this.game.id},
              playerId: this.player.id,
            });
            if (!updated) {
              throw new Error('Unable to get the updated row');
            }
            stack = updated?.stack;
          }
        }

        if (approved) {
          logger.debug(
            `************ [${this.game.gameCode}]: Player ${this.player.name} bot: ${this.player.bot} buyin is approved`
          );
          buyInApprovedTime = new Date().getTime();
          await this.buyInApproved(playerInGame, transactionEntityManager);
          buyInApprovedTime = new Date().getTime() - buyInApprovedTime;
        }

        return [playerStatus, approved];
      }
    );
    const timeTaken = new Date().getTime() - startTime;
    logger.debug(
      `Buyin process total time: ${timeTaken} buyInApprovedTime: ${buyInApprovedTime} databaseTime: ${databaseTime}`
    );

    return {
      expireSeconds: timeout,
      approved: approved,
    };
  }

  public async pendingApprovalsForPlayer(): Promise<
    Array<pendingApprovalsForClubData>
  > {
    let query = `
    SELECT
      nhu.id as "requestId",
      pg.game_code as "gameCode", 
      pg.club_id as "clubId",
      pg.club_code as "clubCode",
      pg.id as "gameId",
      pg.game_type  as "gameType",
      pg.small_blind as "smallBlind",
      pg.big_blind  as "bigBlind",
      nhu.player_id as "playerId",
      nhu.player_uuid as "playerUuid",
      nhu.player_name as "name",
      nhu.player_uuid as "playerUuid",
      nhu.buyin_amount as "amount", 
      nhu.new_update as "update" 
    FROM next_hand_updates nhu
    JOIN poker_game pg 
      ON pg.id = nhu.game_id AND pg.ended_at is null
    WHERE pg.host_id = ? AND nhu.new_update in (?, ?)`;
    query = fixQuery(query);

    const resp1 = await getGameConnection().query(query, [
      this.player.id,
      NextHandUpdate.WAIT_BUYIN_APPROVAL,
      NextHandUpdate.WAIT_RELOAD_APPROVAL,
    ]);

    const result = new Array<pendingApprovalsForClubData>();
    for await (const data of resp1) {
      const clubCode = data.clubCode;
      const playerUuid = data.playerUuid;
      let availableCredit = 0;
      if (clubCode) {
        availableCredit = await this.calcAvailableCredit(clubCode, playerUuid);
      }

      const player = await Cache.getPlayerById(data.playerId);

      result.push({
        requestId: data.requestId,
        gameCode: data.gameCode,
        clubCode: data.clubCode,
        gameType: data.gameType,
        smallBlind: data.smallBlind,
        bigBlind: data.bigBlind,
        playerUuid: player.uuid,
        name: player.name,
        amount: data.amount,
        approvalType:
          data.update === NextHandUpdate.WAIT_BUYIN_APPROVAL
            ? ApprovalType[ApprovalType.BUYIN_REQUEST]
            : ApprovalType[ApprovalType.RELOAD_REQUEST],
        availableCredit: availableCredit,
      });
    }

    return result;
  }

  public async pendingApprovalsForClub(): Promise<
    Array<pendingApprovalsForClubData>
  > {
    // get club code for the player
    let clubQuery = `
      select c.club_code as "clubCode" FROM 
        club_member cm JOIN club c ON cm.club_id = c.id
        JOIN player p ON cm.player_id = p.id
        WHERE 
        (cm.is_owner = true or cm.is_manager = true)
        AND p.id = ?
    `;
    clubQuery = fixQuery(clubQuery);

    const clubResp = await getUserConnection().query(clubQuery, [
      this.player.id,
    ]);
    if (clubResp.length === 0) {
      return [];
    }
    const clubCodes = clubResp.map(row => `'${row.clubCode}'`).join(',');

    let query = `
    SELECT
      nhu.id as "requestId",
      pg.club_name as "clubName",
      pg.club_id as "clubId",
      pg.club_code as "clubCode",
      pg.game_code as "gameCode", 
      pg.id as "gameId",
      pg.game_type  as "gameType",
      pg.small_blind as "smallBlind",
      pg.big_blind  as "bigBlind",
      nhu.player_uuid as "playerUuid", 
      nhu.player_name as "name", 
      nhu.player_id as "playerId", 
      nhu.buyin_amount as "amount", 
      nhu.new_update as "update" 
    FROM next_hand_updates nhu
    JOIN poker_game pg 
    ON pg.id = nhu.game_id AND pg.ended_at is null
    WHERE nhu.new_update in (?, ?) AND pg.club_code in (${clubCodes})`;
    query = fixQuery(query);

    const resp1 = await getGameConnection().query(query, [
      NextHandUpdate.WAIT_BUYIN_APPROVAL,
      NextHandUpdate.WAIT_RELOAD_APPROVAL,
    ]);

    const result = new Array<pendingApprovalsForClubData>();
    for await (const data of resp1) {
      const clubCode = data.clubCode;
      const playerUuid = data.playerUuid;
      const availableCredit = await this.calcAvailableCredit(
        clubCode,
        playerUuid
      );

      result.push({
        requestId: data.requestId,
        gameCode: data.gameCode,
        clubCode: data.clubCode,
        gameType: data.gameType,
        smallBlind: data.smallBlind,
        bigBlind: data.bigBlind,
        playerUuid: data.playerUuid,
        name: data.name,
        amount: data.amount,
        approvalType:
          data.update === NextHandUpdate.WAIT_BUYIN_APPROVAL
            ? ApprovalType[ApprovalType.BUYIN_REQUEST]
            : ApprovalType[ApprovalType.RELOAD_REQUEST],
        availableCredit: availableCredit,
      });
    }

    return result;
  }

  public async pendingApprovalsForGame(): Promise<
    Array<pendingApprovalsForClubData>
  > {
    const query1 = `select 
      nhu.id as "requestId",
      g.game_code as "gameCode", 
      g.id as "gameId", 
      g.game_type as "gameType",
      g.small_blind as "smallBlind",
      g.big_blind as "bigBlind",
      nhu.player_uuid as "playerUuid", 
      nhu.player_name as "name", 
      nhu.player_id as "playerId", 
      g.club_id as "clubId", 
      nhu.buyin_amount as "amount", 
      nhu.new_update as "update" 
      from poker_game g  
      join next_hand_updates nhu on nhu.game_id = g.id and nhu.new_update in (
        ${[
          NextHandUpdate.WAIT_BUYIN_APPROVAL,
          NextHandUpdate.WAIT_RELOAD_APPROVAL,
        ]}
      )
      where g.id = ${this.game.id}`;

    const resp1 = await getGameConnection().query(query1);

    const result = new Array<pendingApprovalsForClubData>();
    for await (const data of resp1) {
      const clubId = data.clubId;
      // const availableCredit = await this.calcOutstandingBalance(
      //   clubId,
      //   data.playerId
      // );
      const availableCredit = 0;

      result.push({
        requestId: data.requestId,
        gameCode: data.gameCode,
        clubCode: data.clubCode,
        gameType: data.gameType,
        smallBlind: data.smallBlind,
        bigBlind: data.bigBlind,
        playerUuid: data.playerUuid,
        name: data.name,
        amount: data.amount,
        approvalType:
          data.update === NextHandUpdate.WAIT_BUYIN_APPROVAL
            ? ApprovalType[ApprovalType.BUYIN_REQUEST]
            : ApprovalType[ApprovalType.RELOAD_REQUEST],
        availableCredit: availableCredit,
      });
    }
    return result;
  }

  public async approve(
    type: ApprovalType,
    status: ApprovalStatus
  ): Promise<boolean> {
    if (type === ApprovalType.BUYIN_REQUEST) {
      if (status === ApprovalStatus.APPROVED) {
        return await getGameManager().transaction(
          async transactionEntityManager => {
            // get amount from the next hand update table
            const pendingUpdatesRepo =
              transactionEntityManager.getRepository(NextHandUpdates);
            const buyInRequest = await pendingUpdatesRepo.findOne({
              game: {id: this.game.id},
              playerId: this.player.id,
              newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
            });
            if (!buyInRequest) {
              return false;
            }

            // update player game tracker
            const playerInGameRepo =
              transactionEntityManager.getRepository(PlayerGameTracker);
            const playerInGame = await playerInGameRepo.findOne({
              game: {id: this.game.id},
              playerId: this.player.id,
            });
            if (!playerInGame) {
              return false;
            }
            const updatedPlayerInGame = await this.approveBuyInRequest(
              buyInRequest.buyinAmount,
              playerInGame,
              transactionEntityManager
            );

            // remove row from NextHandUpdates table
            await pendingUpdatesRepo.delete({
              game: {id: this.game.id},
              playerId: this.player.id,
              newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
            });

            await this.buyInApproved(
              updatedPlayerInGame,
              transactionEntityManager
            );
            return true;
          }
        );
      } else {
        // denied
        return await getGameManager().transaction(
          async transactionEntityManager => {
            // get amount from the next hand update table
            const pendingUpdatesRepo =
              transactionEntityManager.getRepository(NextHandUpdates);
            const buyInRequest = await pendingUpdatesRepo.findOne({
              game: {id: this.game.id},
              playerId: this.player.id,
              newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
            });
            if (!buyInRequest) {
              return false;
            }

            // update player game tracker
            const playerInGameRepo =
              transactionEntityManager.getRepository(PlayerGameTracker);
            const playerInGame = await playerInGameRepo.findOne({
              game: {id: this.game.id},
              playerId: this.player.id,
            });
            if (!playerInGame) {
              return false;
            }

            // remove row from NextHandUpdates table
            await pendingUpdatesRepo.delete({
              game: {id: this.game.id},
              playerId: this.player.id,
              newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
            });

            await this.buyInDenied(playerInGame, transactionEntityManager);
            return true;
          }
        );
      }
    } else if (type === ApprovalType.RELOAD_REQUEST) {
      if (status === ApprovalStatus.APPROVED) {
        await this.updateNextHandrecord(
          NextHandUpdate.WAIT_RELOAD_APPROVAL,
          NextHandUpdate.RELOAD_APPROVED
        );
      } else {
        await this.updateNextHandrecord(
          NextHandUpdate.WAIT_RELOAD_APPROVAL,
          NextHandUpdate.RELOAD_DENIED
        );
      }
    }
    return true;
  }

  private async calcAvailableCredit(clubCode: string, playerUuid: string) {
    const player: Player = await Cache.getPlayer(playerUuid);
    const club: Club = await Cache.getClub(clubCode);

    const clubMember = await Cache.getClubMember(player.uuid, clubCode, true);
    if (!clubMember) {
      logger.error(`Player ${playerUuid} is not in the club: ${clubCode}`);
      throw new Error(`Player ${playerUuid} is not in the club`);
    }

    const preGameCredit = clubMember.availableCredit;
    const profit = 0; // TODO
    let availableCredit = preGameCredit + profit;

    return availableCredit;
  }

  private async updateNextHandrecord(
    oldStatus: NextHandUpdate,
    newStatus: NextHandUpdate
  ) {
    const nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
    await nextHandUpdatesRepository
      .createQueryBuilder()
      .update()
      .set({
        newUpdate: newStatus,
      })
      .where({
        game: {id: this.game.id},
        playerId: this.player.id,
        newUpdate: oldStatus,
      })
      .execute();
  }

  private async addBuyInToNextHand(
    amount: number,
    status: NextHandUpdate,
    transactionEntityManager?: EntityManager
  ) {
    let nextHandUpdatesRepository;
    if (transactionEntityManager) {
      nextHandUpdatesRepository =
        transactionEntityManager.getRepository(NextHandUpdates);
    } else {
      nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
    }
    const update = new NextHandUpdates();
    update.game = this.game;
    update.playerId = this.player.id;
    update.playerUuid = this.player.uuid;
    update.playerName = this.player.name;
    update.newUpdate = status;
    update.buyinAmount = amount;
    await nextHandUpdatesRepository.save(update);
  }

  public async timerExpired() {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);

    // find the player
    const playerInSeat = await playerGameTrackerRepository.findOne({
      where: {
        game: {id: this.game.id},
        playerId: this.player.id,
      },
    });

    if (!playerInSeat) {
      // We shouldn't be here
      return;
    }

    if (
      playerInSeat.status === PlayerStatus.WAIT_FOR_BUYIN ||
      playerInSeat.status === PlayerStatus.WAIT_FOR_BUYIN_APPROVAL
    ) {
      // buyin timeout expired

      // mark the player as not playing
      const result: UpdateResult = await playerGameTrackerRepository.update(
        {
          game: {id: this.game.id},
          playerId: this.player.id,
          status: In([
            PlayerStatus.WAIT_FOR_BUYIN,
            PlayerStatus.WAIT_FOR_BUYIN_APPROVAL,
          ]),
        },
        {
          status: PlayerStatus.NOT_PLAYING,
          seatNo: 0,
          buyInExpAt: undefined,
        }
      );

      if (result.affected === 0) {
        // This can happen when the buy-in request was approved and timed out at the same time.
        // The approval won here. No-op for the timeout.
        logger.warn(
          `Buy-in timeout handler returning since no db record was updated`
        );
        return;
      }

      if (result.affected && result.affected > 1) {
        // Shouldn't get here.
        logger.error(
          `Multiple rows (${result.affected}) were updated when processing buy-in timeout`
        );
      }

      if (playerInSeat.seatNo !== 0) {
        await GameRepository.seatOpened(this.game, playerInSeat.seatNo);
      }

      // delete the row in pending updates table
      const pendingUpdatesRepo = getGameRepository(NextHandUpdates);
      await pendingUpdatesRepo.delete({
        game: {id: this.game.id},
        playerId: this.player.id,
        newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
      });
      // update the clients with new status
      await Nats.playerStatusChanged(
        this.game,
        this.player,
        playerInSeat.status,
        NewUpdate.BUYIN_TIMEDOUT,
        playerInSeat.stack,
        playerInSeat.seatNo
      );
    } else if (playerInSeat.status === PlayerStatus.PLAYING) {
      // cancel timer wasn't called (ignore the timeout callback)
      logger.warn(
        `Ignoring buy-in timeout callback since player is in ${playerInSeat.status} status`
      );
    }
  }

  /**
   * Walks through all active players in the game. If a player has 0 stack, then start
   * a buyin timer.
   * @param game
   */
  public static async startBuyInTimers(game: PokerGame) {
    logger.debug(`[${gameLogPrefix(game)} Starting buyin timers`);
    await getGameManager().transaction(async transactionEntityManager => {
      const playerGameTrackerRepo =
        transactionEntityManager.getRepository(PlayerGameTracker);
      const emptyStackPlayers = await playerGameTrackerRepo.find({
        game: {id: game.id},
        status: PlayerStatus.PLAYING,
        stack: 0,
      });
      for (const player of emptyStackPlayers) {
        logger.info(
          `Player: ${player.playerName} stack is empty. Starting a buyin timer`
        );
        // if player balance is 0, we need to mark this player to add buyin
        await PlayersInGameRepository.startBuyinTimer(
          game,
          player.playerId,
          player.playerName,
          {
            status: PlayerStatus.WAIT_FOR_BUYIN,
          },
          transactionEntityManager
        );

        // notify clients to update the new status
        await Nats.playerStatusChanged(
          game,
          {
            id: player.playerId,
            uuid: player.playerUuid,
            name: player.playerName,
          },
          player.status,
          NewUpdate.WAIT_FOR_BUYIN,
          player.stack,
          player.seatNo
        );
      }
    });
  }
}
