import {EntityManager, getConnection, getManager, getRepository} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache';
import {Player} from '@src/entity/player/player';
import {
  NextHandUpdates,
  PokerGame,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {
  ApprovalStatus,
  GameStatus,
  NextHandUpdate,
  TableStatus,
} from '@src/entity/types';
import {PlayerGameTracker} from '@src/entity/game/chipstrack';
import {GameRepository} from './game';
import {playerStatusChanged} from '@src/gameserver';
import {startTimer, cancelTimer} from '@src/timer';
import {NewUpdate, RELOAD_APPROVAL_TIMEOUT, RELOAD_TIMEOUT} from './types';
import {buyInRequest, pendingApprovalsForClubData} from '@src/types';
import {Firebase} from '@src/firebase';
import {Nats} from '@src/nats';
import {v4 as uuidv4} from 'uuid';

const logger = getLogger('reload');

/*
reload(gameCode, buyIn)
adjust amount
if auto approval
  update player_game_tracker
  notify
else
  add to next_hand_updates
  notify host/owner/manager
end if

if host approves the request,
  change the new_update: RELOAD_APPROVED
  it will be processed in the next hand
else if host denies the request
  remove the row from the next_hand_updates table
  send a notification to the player
else if times out
  remove the row from the next_hand_updates table
  send a notification to the player timed out

*/

/*
 how do we test with bot runner?

 Scenario 1
 1. Increase buyin wait timeout with auto approval
 2. Make a reload request
 3. Verify the stack is updated in the next hand

 Scenario 2
 1. Increase buyin wait timeout with no auto approval
 2. Make a reload request
 3. Ensure the host has a pending reload approval
 4. Approve reload request
 5. Make sure the stack is updated in the next hand

 Scenario 3
 1. Increase buyin wait timeout with no auto approval
 2. Make a reload request
 3. Ensure the host has a pending reload approval
 4. Deny reload request
 5. Make sure the stack is not updated in the next hand
*/

export class Reload {
  private game: PokerGame;
  private player: Player;

  constructor(game: PokerGame, player: Player) {
    this.game = game;
    this.player = player;
  }

  public async request(amount: number): Promise<buyInRequest> {
    const timeout = 60;

    const startTime = new Date().getTime();
    let databaseTime = 0;
    let buyInApprovedTime = 0;

    const approved = await getManager().transaction(
      async transactionEntityManager => {
        databaseTime = new Date().getTime();
        let approved: boolean;
        // player must be already in a seat or waiting list
        // if credit limit is set, make sure his buyin amount is within the credit limit
        // if auto approval is set, add the buyin
        // make sure buyin within min and maxBuyin
        // send a message to game server that buyer stack has been updated
        const playerGameTrackerRepository = transactionEntityManager.getRepository(
          PlayerGameTracker
        );
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

        // check amount should be between game.minBuyIn and game.maxBuyIn
        if (playerInGame.stack + amount < this.game.buyInMin) {
          throw new Error(
            `Buyin must be between ${this.game.buyInMin} and ${this.game.buyInMax}`
          );
        }

        if (playerInGame.stack + amount > this.game.buyInMax) {
          amount = this.game.buyInMax - playerInGame.stack;
        }

        if (this.game.clubCode) {
          const prevStatus = await playerGameTrackerRepository.findOne({
            game: {id: this.game.id},
            playerId: this.player.id,
          });

          if (!prevStatus) {
            throw new Error(`Player ${this.player.name} is not in the game`);
          }

          // club game
          approved = await this.clubMemberAutoApproval(
            amount,
            playerInGame,
            transactionEntityManager
          );

          databaseTime = new Date().getTime() - databaseTime;
          if (!approved) {
            const reloadTimeExp = new Date();
            const timeout = this.game.buyInTimeout;
            reloadTimeExp.setSeconds(reloadTimeExp.getSeconds() + timeout);

            // start reload expiry timeout
            startTimer(
              this.game.id,
              this.player.id,
              RELOAD_APPROVAL_TIMEOUT,
              reloadTimeExp
            );

            logger.info(
              `************ [${this.game.gameCode}]: Player ${this.player.name} is waiting for approval`
            );
            // notify game host that the player is waiting for buyin
            const host = await Cache.getPlayerById(this.game.hostId, true);
            const messageId = uuidv4();
            await Firebase.notifyReloadRequest(
              this.game,
              this.player,
              host,
              amount
            );

            // notify player to wait for approval
            Nats.sendReloadWaitTime(
              this.game,
              this.game.clubName,
              this.player,
              timeout,
              messageId
            );

            // NATS message, notify host for pending request
            Nats.sendReloadApprovalRequest(
              this.game,
              this.game.clubName,
              this.player,
              host,
              messageId
            );
          } else {
            logger.info(
              `************ [${this.game.gameCode}]: Player ${this.player.name} is approved`
            );
          }
        } else {
          // individual game
          throw new Error('Individual game is not implemented yet');
        }
        if (approved) {
          logger.info(
            `************ [${this.game.gameCode}]: Player ${this.player.name} bot: ${this.player.bot} buyin is approved`
          );
          buyInApprovedTime = new Date().getTime();
          await this.approve(amount, playerInGame, transactionEntityManager);
          buyInApprovedTime = new Date().getTime() - buyInApprovedTime;
        }

        return approved;
      }
    );
    const timeTaken = new Date().getTime() - startTime;
    logger.info(
      `Reload process total time: ${timeTaken} reload: ${buyInApprovedTime} databaseTime: ${databaseTime}`
    );

    return {
      expireSeconds: timeout,
      approved: approved,
    };
  }

  protected async approve(
    amount: number,
    playerInGame: PlayerGameTracker,
    transactionEntityManager: EntityManager
  ): Promise<PlayerGameTracker> {
    if (
      this.game.status === GameStatus.ACTIVE &&
      (this.game.tableStatus === null || // test mode
        this.game.tableStatus === TableStatus.GAME_RUNNING)
    ) {
      // game is running
      await this.addToNextHand(
        amount,
        NextHandUpdate.RELOAD_APPROVED,
        transactionEntityManager
      );
    } else {
      await this.approvedAndUpdateStack(amount, playerInGame);
    }
    return playerInGame;
  }

  public async approvedAndUpdateStack(
    amount: number,
    playerInGame?: PlayerGameTracker
  ) {
    let cancelTime = new Date().getTime();
    cancelTimer(this.game.id, this.player.id, RELOAD_APPROVAL_TIMEOUT);
    cancelTime = new Date().getTime() - cancelTime;

    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    if (!playerInGame) {
      playerInGame = await playerGameTrackerRepository.findOne({
        game: {id: this.game.id},
        playerId: this.player.id,
      });
      if (!playerInGame) {
        logger.error(
          `Player ${this.player.uuid} is not in the game: ${this.game.gameCode}`
        );
        throw new Error(`Player ${this.player.uuid} is not in the game`);
      }
    }

    if (playerInGame.stack + amount > this.game.buyInMax) {
      // reloading chips will be more than max buy in
      amount = 0;
    } else {
      // game is not running
      const oldStack = playerInGame.stack;
      playerInGame.stack += amount;
      playerInGame.buyIn += amount;
      if (playerInGame.seatNo !== 0) {
        await playerGameTrackerRepository.update(
          {
            game: {id: this.game.id},
            playerId: this.player.id,
          },
          {
            status: playerInGame.status,
            stack: playerInGame.stack,
            buyIn: playerInGame.buyIn,
            buyInExpAt: undefined,
          }
        );
      }
      // notify the player
      Nats.sendReloadApproved(
        this.game.gameCode,
        this.player.id,
        this.player.uuid,
        this.player.name,
        oldStack,
        playerInGame.stack,
        amount
      );
    }
  }

  protected async clubMemberAutoApproval(
    amount: number,
    playerInGame: PlayerGameTracker,
    transactionEntityManager: EntityManager
  ): Promise<boolean> {
    let approved = false;
    const clubMember = await Cache.getClubMember(
      this.player.uuid,
      this.game.clubCode
    );
    if (!clubMember) {
      throw new Error(`The player ${this.player.uuid} is not in the club`);
    }

    let isHost = false;
    if (this.game.hostUuid === this.player.uuid) {
      isHost = true;
    }
    if (
      clubMember.isOwner ||
      clubMember.isManager ||
      clubMember.autoBuyinApproval ||
      !this.game.buyInApproval ||
      isHost
    ) {
      approved = true;
    } else {
      const query =
        'SELECT SUM(buy_in) current_buyin FROM player_game_tracker pgt, poker_game pg WHERE pgt.pgt_player_id = ' +
        this.player.id +
        ' AND pgt.pgt_game_id = pg.id AND pg.game_status =' +
        GameStatus.ENDED;
      const resp = await getConnection().query(query);

      const currentBuyin = resp[0]['current_buyin'];

      let outstandingBalance = playerInGame.buyIn;
      if (currentBuyin) {
        outstandingBalance += currentBuyin;
      }
      logger.info(`[${this.game.gameCode}] Player: ${this.player.name} reload request. 
            clubMember: isOwner: ${clubMember.isOwner} isManager: ${clubMember.isManager} 
            Auto approval: ${clubMember.autoBuyinApproval} 
            isHost: {isHost}`);
      logger.info(
        `Game.buyInApproval: ${this.game.buyInApproval} creditLimit: ${clubMember.creditLimit} outstandingBalance: ${outstandingBalance}`
      );

      let availableCredit = 0.0;
      if (clubMember.creditLimit >= 0) {
        availableCredit = clubMember.creditLimit - outstandingBalance;
      }

      if (amount <= availableCredit) {
        approved = true;
        await this.approve(amount, playerInGame, transactionEntityManager);
      } else {
        await this.addToNextHand(
          amount,
          NextHandUpdate.WAIT_RELOAD_APPROVAL,
          transactionEntityManager
        );

        approved = false;
      }
    }
    return approved;
  }

  protected async denied(
    playerInGame: PlayerGameTracker,
    transactionEntityManager: EntityManager
  ) {
    // send a message to gameserver
    // get game server of this game
    const gameServer = await GameRepository.getGameServer(this.game.id);
    if (gameServer) {
      await playerStatusChanged(
        this.game,
        this.player,
        playerInGame.status,
        NewUpdate.BUYIN_DENIED,
        playerInGame.stack,
        playerInGame.seatNo
      );
    }
  }

  public async approveDeny(status: ApprovalStatus): Promise<boolean> {
    if (status === ApprovalStatus.APPROVED) {
      return await getManager().transaction(async transactionEntityManager => {
        // get amount from the next hand update table
        const pendingUpdatesRepo = transactionEntityManager.getRepository(
          NextHandUpdates
        );
        const reloadRequest = await pendingUpdatesRepo.findOne({
          game: {id: this.game.id},
          playerId: this.player.id,
          newUpdate: NextHandUpdate.WAIT_RELOAD_APPROVAL,
        });
        if (!reloadRequest) {
          return false;
        }

        // update player game tracker
        const playerInGameRepo = transactionEntityManager.getRepository(
          PlayerGameTracker
        );
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
          newUpdate: NextHandUpdate.WAIT_RELOAD_APPROVAL,
        });

        if (
          this.game.status == GameStatus.CONFIGURED ||
          this.game.status == GameStatus.PAUSED ||
          this.game.tableStatus !== TableStatus.GAME_RUNNING
        ) {
          // game is just configured or table is paused
          this.approvedAndUpdateStack(reloadRequest.buyinAmount, playerInGame);
        } else {
          logger.info('Game is running. Update stack in the next hand');
          await this.addToNextHand(
            reloadRequest.buyinAmount,
            NextHandUpdate.RELOAD_APPROVED,
            transactionEntityManager
          );
        }
        return true;
      });
    } else {
      // denied

      return await getManager().transaction(async transactionEntityManager => {
        // get amount from the next hand update table
        const pendingUpdatesRepo = transactionEntityManager.getRepository(
          NextHandUpdates
        );
        const request = await pendingUpdatesRepo.findOne({
          game: {id: this.game.id},
          playerId: this.player.id,
          newUpdate: NextHandUpdate.WAIT_RELOAD_APPROVAL,
        });
        if (!request) {
          return false;
        }

        // update player game tracker
        const playerInGameRepo = transactionEntityManager.getRepository(
          PlayerGameTracker
        );
        const playerInGame = await playerInGameRepo.findOne({
          game: {id: this.game.id},
          playerId: this.player.id,
        });
        if (!playerInGame) {
          return false;
        }
        cancelTimer(this.game.id, this.player.id, RELOAD_TIMEOUT);
        await this.denied(playerInGame, transactionEntityManager);
        return true;
      });
    }
  }

  private async addToNextHand(
    amount: number,
    status: NextHandUpdate,
    transactionEntityManager?: EntityManager
  ) {
    let nextHandUpdatesRepository;
    if (transactionEntityManager) {
      nextHandUpdatesRepository = transactionEntityManager.getRepository(
        NextHandUpdates
      );
    } else {
      nextHandUpdatesRepository = getRepository(NextHandUpdates);
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
    // indicate the user timeout expired

    // remove row from NextHandUpdates table
    const pendingUpdatesRepo = getRepository(NextHandUpdates);
    await pendingUpdatesRepo.delete({
      game: {id: this.game.id},
      playerId: this.player.id,
      newUpdate: NextHandUpdate.WAIT_RELOAD_APPROVAL,
    });
    const messageId = uuidv4();

    // notify the player
    Nats.sendReloadTimeout(this.game, this.player, messageId);
  }
}