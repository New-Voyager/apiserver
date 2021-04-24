import {
  EntityManager,
  getConnection,
  getManager,
  getRepository,
  In,
  Repository,
} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache';
import {Player} from '@src/entity/player';
import {NextHandUpdates, PokerGame, PokerGameUpdates} from '@src/entity/game';
import {
  ApprovalStatus,
  ApprovalType,
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {GameRepository} from './game';
import {
  cancelTimer,
  playerBuyIn,
  playerStatusChanged,
  startTimer,
} from '@src/gameserver';
import {
  BUYIN_APPROVAL_TIMEOUT,
  BUYIN_TIMEOUT,
  NewUpdate,
  RELOAD_APPROVAL_TIMEOUT,
} from './types';
import {Club, ClubMember} from '@src/entity/club';
import {buyInRequest, pendingApprovalsForClubData} from '@src/types';
import {fixQuery} from '@src/utils';
import {Firebase} from '@src/firebase';
import {PlayerRepository} from './player';

const logger = getLogger('buyin');

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
        player: {id: this.player.id},
      },
      {
        status: playerInGame.status,
        stack: playerInGame.stack,
        buyIn: playerInGame.buyIn,
        noOfBuyins: playerInGame.noOfBuyins,
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
      this.game.club.clubCode
    );
    if (!clubMember) {
      throw new Error(`The player ${this.player.uuid} is not in the club`);
    }

    // clubMember.autoBuyinApproval = false;

    let playerStatus: PlayerStatus = PlayerStatus.WAIT_FOR_BUYIN;
    let updatedPlayerInGame: PlayerGameTracker;
    let isHost = false;
    if (this.game.startedBy.uuid === this.player.uuid) {
      isHost = true;
    }

    if (
      clubMember.isOwner ||
      clubMember.isManager ||
      clubMember.autoBuyinApproval ||
      !this.game.buyInApproval ||
      isHost
    ) {
      logger.info(`[${this.game.gameCode}] Player: ${this.player.name} buyin approved. 
            clubMember: isOwner: ${clubMember.isOwner} isManager: ${clubMember.isManager} 
            Auto approval: ${clubMember.autoBuyinApproval} 
            isHost: {isHost} Game.buyInApproval: ${this.game.buyInApproval}`);
      approved = true;
      updatedPlayerInGame = await this.approveBuyInRequest(
        amount,
        playerInGame,
        transactionEntityManager
      );
      playerStatus = updatedPlayerInGame.status;
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

      let availableCredit = 0.0;
      if (clubMember.creditLimit >= 0) {
        availableCredit = clubMember.creditLimit - outstandingBalance;
      }

      if (amount <= availableCredit) {
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
    return [playerStatus, approved];
  }

  public async buyInApproved(
    playerInGame: PlayerGameTracker,
    transactionEntityManager: EntityManager
  ) {
    let playerGameTrackerRepository = transactionEntityManager.getRepository(
      PlayerGameTracker
    );
    const count = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: this.game.id},
        status: In([
          PlayerStatus.PLAYING,
          PlayerStatus.IN_BREAK,
          PlayerStatus.WAIT_FOR_BUYIN,
          PlayerStatus.WAIT_FOR_BUYIN_APPROVAL,
        ]),
      })
      .getCount();

    const gameUpdatesRepo = transactionEntityManager.getRepository(
      PokerGameUpdates
    );
    await gameUpdatesRepo
      .createQueryBuilder()
      .update()
      .set({
        playersInSeats: count,
      })
      .where({
        gameID: this.game.id,
      })
      .execute();

    cancelTimer(this.game.id, this.player.id, BUYIN_TIMEOUT);

    // send a message to gameserver
    // get game server of this game
    const gameServer = await GameRepository.getGameServer(this.game.id);
    if (gameServer) {
      playerBuyIn(this.game, this.player, playerInGame);
    }
  }

  public async buyInDenied(
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

  public async request(amount: number): Promise<buyInRequest> {
    const timeout = 60;
    const [status, approved] = await getManager().transaction(
      async transactionEntityManager => {
        let playerStatus: PlayerStatus;
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
          player: {id: this.player.id},
        });
        if (!playerInGame) {
          logger.error(
            `Player ${this.player.uuid} is not in the game: ${this.game.gameCode}`
          );
          throw new Error(`Player ${this.player.uuid} is not in the game`);
        }

        // check amount should be between game.minBuyIn and game.maxBuyIn
        if (
          playerInGame.stack + amount < this.game.buyInMin ||
          playerInGame.stack + amount > this.game.buyInMax
        ) {
          throw new Error(
            `Buyin must be between ${this.game.buyInMin} and ${this.game.buyInMax}`
          );
        }

        if (this.game.club) {
          const prevStatus = await playerGameTrackerRepository.findOne({
            game: {id: this.game.id},
            player: {id: this.player.id},
          });

          if (!prevStatus) {
            throw new Error(`Player ${this.player.name} is not in the game`);
          }

          // club game
          [playerStatus, approved] = await this.clubMemberBuyInApproval(
            amount,
            playerInGame,
            transactionEntityManager
          );
          await playerGameTrackerRepository.update(
            {
              game: {id: this.game.id},
              player: {id: this.player.id},
            },
            {
              status: playerStatus,
            }
          );

          let seatNo = 0;
          if (prevStatus.seatNo) {
            seatNo = prevStatus.seatNo;
          }
          let stack = prevStatus.stack;
          let newUpdate: NewUpdate = NewUpdate.UNKNOWN_PLAYER_UPDATE;
          if (playerStatus == PlayerStatus.WAIT_FOR_BUYIN_APPROVAL) {
            newUpdate = NewUpdate.WAIT_FOR_BUYIN_APPROVAL;
          } else if (approved) {
            newUpdate = NewUpdate.NEW_BUYIN;

            // get current stack
            const updated = await playerGameTrackerRepository.findOne({
              game: {id: this.game.id},
              player: {id: this.player.id},
            });
            if (!updated) {
              throw new Error('Unable to get the updated row');
            }
            stack = updated?.stack;
          }
          logger.info(
            `************ [${this.game.gameCode}]: Player ${this.player.name} is waiting for approval`
          );

          // notify game host that the player is waiting for buyin
          const host = await Cache.getPlayerById(this.game.host.id, true);
          await Firebase.notifyBuyInRequest(
            this.game,
            this.player,
            host,
            amount
          );

          // refresh the screen
          playerStatusChanged(
            this.game,
            this.player,
            prevStatus.status,
            newUpdate,
            stack,
            seatNo
          );
        } else {
          // individual game
          throw new Error('Individual game is not implemented yet');
        }
        if (approved) {
          await this.buyInApproved(playerInGame, transactionEntityManager);
        }

        return [playerStatus, approved];
      }
    );

    logger.info(`Status: ${status}`);
    return {
      expireSeconds: timeout,
      approved: approved,
    };
  }

  public async reloadRequest(amount: number): Promise<buyInRequest> {
    let timeout = 0,
      approved = false;
    const status = await getManager().transaction(
      async transactionEntityManager => {
        const playerGameTrackerRepository = transactionEntityManager.getRepository(
          PlayerGameTracker
        );
        const playerInGames = await playerGameTrackerRepository
          .createQueryBuilder()
          .where({
            game: {id: this.game.id},
            player: {id: this.player.id},
          })
          .select('stack')
          .addSelect('status')
          .addSelect('no_of_buyins', 'noOfBuyins')
          .addSelect('seat_no', 'seatNo')
          .addSelect('buy_in', 'buyIn')
          .execute();

        const playerInGame = playerInGames[0];
        if (!playerInGame) {
          logger.error(
            `Player ${this.player.uuid} is not in the game: ${this.game.gameCode}`
          );
          throw new Error(`Player ${this.player.uuid} is not in the game`);
        }

        // check amount should be between game.minBuyIn and game.maxBuyIn
        if (
          playerInGame.stack + amount < this.game.buyInMin ||
          playerInGame.stack + amount > this.game.buyInMax
        ) {
          logger.error(
            `Buyin must be between ${this.game.buyInMin} and ${this.game.buyInMax}`
          );
          throw new Error(
            `Buyin must be between ${this.game.buyInMin} and ${this.game.buyInMax}`
          );
        }

        // NOTE TO SANJAY: Add other functionalities
        const clubMember = await Cache.getClubMember(
          this.player.uuid,
          this.game.club.clubCode
        );
        if (!clubMember) {
          logger.error(`The player ${this.player.uuid} is not in the club`);
          throw new Error(`The player ${this.player.uuid} is not in the club`);
        }
        // Why are we doing this?
        // clubMember.autoBuyinApproval = true;

        if (clubMember.autoBuyinApproval) {
          approved = true;
          if (
            this.game.status === GameStatus.ACTIVE &&
            this.game.tableStatus === TableStatus.GAME_RUNNING
          ) {
            // add buyin to next hand update
            await this.addBuyInToNextHand(
              amount,
              NextHandUpdate.RELOAD_APPROVED,
              transactionEntityManager
            );
            if (playerInGame.stack <= 0) {
              playerInGame.status = PlayerStatus.PENDING_UPDATES;
            }
          } else {
            playerInGame.noOfBuyins++;
            playerInGame.stack += amount;
            playerInGame.buyIn += amount;
          }
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

          let availableCredit = 0.0;
          if (clubMember.creditLimit >= 0) {
            availableCredit = clubMember.creditLimit - outstandingBalance;
          }

          if (amount <= availableCredit) {
            approved = true;
            if (
              this.game.status === GameStatus.ACTIVE &&
              this.game.tableStatus === TableStatus.GAME_RUNNING
            ) {
              // add buyin to next hand update
              await this.addBuyInToNextHand(
                amount,
                NextHandUpdate.RELOAD_APPROVED,
                transactionEntityManager
              );
              if (playerInGame.stack <= 0) {
                playerInGame.status = PlayerStatus.PENDING_UPDATES;
              }
            } else {
              // player is within the credit limit
              playerInGame.noOfBuyins++;
              playerInGame.stack += amount;
              playerInGame.buyIn += amount;
            }
          } else {
            await this.addBuyInToNextHand(
              amount,
              NextHandUpdate.WAIT_RELOAD_APPROVAL,
              transactionEntityManager
            );
            const buyinApprovalTimeExp = new Date();
            timeout = 60;
            buyinApprovalTimeExp.setSeconds(
              buyinApprovalTimeExp.getSeconds() + timeout
            );
            startTimer(
              this.game.id,
              this.player.id,
              RELOAD_APPROVAL_TIMEOUT,
              buyinApprovalTimeExp
            );
            if (playerInGame.stack <= 0) {
              playerInGame.status = PlayerStatus.PENDING_UPDATES;
            }
            approved = false;
          }
        }

        await playerGameTrackerRepository
          .createQueryBuilder()
          .update()
          .set({
            noOfBuyins: playerInGame.noOfBuyins,
            stack: playerInGame.stack,
            buyIn: playerInGame.buyIn,
            status: playerInGame.status,
          })
          .where({
            game: {id: this.game.id},
            player: {id: this.player.id},
          })
          .execute();

        const count = await playerGameTrackerRepository
          .createQueryBuilder()
          .where({
            game: {id: this.game.id},
            status: PlayerStatus.PLAYING,
          })
          .getCount();

        const gameUpdatesRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        await gameUpdatesRepo
          .createQueryBuilder()
          .update()
          .set({
            playersInSeats: count,
          })
          .where({
            gameID: this.game.id,
          })
          .execute();

        // send a message to gameserver
        // get game server of this game
        const gameServer = await GameRepository.getGameServer(this.game.id);
        if (gameServer) {
          playerBuyIn(this.game, this.player, playerInGame);
        }

        return playerInGame.status;
      }
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
    select
	  c.name as "clubName",
    c.id as "clubId",
	  c.club_code as "clubCode",
      pg.game_code as "gameCode", 
      pg.id as "gameId",
      pg.game_type  as "gameType",
      pg.small_blind as "smallBlind",
      pg.big_blind  as "bigBlind",
      p.uuid as "playerUuid", 
      p.name as "name", 
      p.id as "playerId", 
      nhu.buyin_amount as "amount", 
      nhu.new_update as "update" 
      from next_hand_updates nhu
	 join     
	 player p on p.id = nhu.player_id
	 join
	 poker_game pg on pg.id = nhu.game_id 
	 join club_member cm
     on pg.club_id  = cm.club_id 
        and cm.player_id = ?
        and (cm.is_owner = true or cm.is_manager = true) 
       and pg.ended_at  is null
     join club c on cm.club_id = c.id
      where nhu.new_update in (?, ?)`;
    query = fixQuery(query);

    const resp1 = await getConnection().query(query, [
      this.player.id,
      NextHandUpdate.WAIT_BUYIN_APPROVAL,
      NextHandUpdate.WAIT_RELOAD_APPROVAL,
    ]);

    const result = new Array<pendingApprovalsForClubData>();
    for await (const data of resp1) {
      const clubId = data.clubId;
      const outstandingBalance = await this.calcOutstandingBalance(
        clubId,
        data.playerId
      );

      result.push({
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
        outstandingBalance: outstandingBalance,
      });
    }

    return result;
  }

  public async pendingApprovalsForClub(
    club: Club
  ): Promise<Array<pendingApprovalsForClubData>> {
    let query = `
    select
	  c.name as "clubName",
    c.id as "clubId",
	  c.club_code as "clubCode",
      pg.game_code as "gameCode", 
      pg.id as "gameId",
      pg.game_type  as "gameType",
      pg.small_blind as "smallBlind",
      pg.big_blind  as "bigBlind",
      p.uuid as "playerUuid", 
      p.name as "name", 
      p.id as "playerId", 
      nhu.buyin_amount as "amount", 
      nhu.new_update as "update" 
      from next_hand_updates nhu
	 join     
	 player p on p.id = nhu.player_id
	 join
	 poker_game pg on pg.id = nhu.game_id 
	 join club_member cm
     on pg.club_id  = cm.club_id 
        and cm.player_id = ?
        and (cm.is_owner = true or cm.is_manager = true) 
       and pg.ended_at  is null
     join club c on cm.club_id = c.id
      where nhu.new_update in (?, ?) and c.id = (?)`;
    query = fixQuery(query);

    const resp1 = await getConnection().query(query, [
      this.player.id,
      NextHandUpdate.WAIT_BUYIN_APPROVAL,
      NextHandUpdate.WAIT_RELOAD_APPROVAL,
      club.id,
    ]);

    const result = new Array<pendingApprovalsForClubData>();
    for await (const data of resp1) {
      const clubId = data.clubId;
      const outstandingBalance = await this.calcOutstandingBalance(
        clubId,
        data.playerId
      );

      result.push({
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
        outstandingBalance: outstandingBalance,
      });
    }

    return result;
  }

  public async pendingApprovalsForGame(): Promise<
    Array<pendingApprovalsForClubData>
  > {
    const query1 = `select 
      g.game_code as "gameCode", 
      g.id as "gameId", 
      g.game_type as "gameType",
      g.small_blind as "smallBlind",
      g.bigBlind as "bigBlind",
      p.uuid as "playerUuid", 
      p.name as "name", 
      p.id as "playerId", 
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
      join player p on p.id = nhu.player_id 
      where g.id = ${this.game.id};`;

    const resp1 = await getConnection().query(query1);

    const result = new Array<pendingApprovalsForClubData>();
    for await (const data of resp1) {
      const clubId = data.clubId;
      const outstandingBalance = await this.calcOutstandingBalance(
        clubId,
        data.playerId
      );

      result.push({
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
        outstandingBalance: outstandingBalance,
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
        return await getManager().transaction(
          async transactionEntityManager => {
            // get amount from the next hand update table
            const pendingUpdatesRepo = transactionEntityManager.getRepository(
              NextHandUpdates
            );
            const buyInRequest = await pendingUpdatesRepo.findOne({
              game: {id: this.game.id},
              player: {id: this.player.id},
              newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
            });
            if (!buyInRequest) {
              return false;
            }

            // update player game tracker
            const playerInGameRepo = transactionEntityManager.getRepository(
              PlayerGameTracker
            );
            const playerInGame = await playerInGameRepo.findOne({
              game: {id: this.game.id},
              player: {id: this.player.id},
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
              player: {id: this.player.id},
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
        return await getManager().transaction(
          async transactionEntityManager => {
            // get amount from the next hand update table
            const pendingUpdatesRepo = transactionEntityManager.getRepository(
              NextHandUpdates
            );
            const buyInRequest = await pendingUpdatesRepo.findOne({
              game: {id: this.game.id},
              player: {id: this.player.id},
              newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
            });
            if (!buyInRequest) {
              return false;
            }

            // update player game tracker
            const playerInGameRepo = transactionEntityManager.getRepository(
              PlayerGameTracker
            );
            const playerInGame = await playerInGameRepo.findOne({
              game: {id: this.game.id},
              player: {id: this.player.id},
            });
            if (!playerInGame) {
              return false;
            }

            // remove row from NextHandUpdates table
            await pendingUpdatesRepo.delete({
              game: {id: this.game.id},
              player: {id: this.player.id},
              newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
            });

            // mark the player not playing
            playerInGameRepo.update(
              {
                game: {id: this.game.id},
                player: {id: this.player.id},
              },
              {
                seatNo: 0,
                status: PlayerStatus.NOT_PLAYING,
                buyInExpAt: undefined,
              }
            );

            cancelTimer(this.game.id, this.player.id, BUYIN_TIMEOUT);
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

  private async calcOutstandingBalance(clubId: number, playerId: number) {
    const clubMemberRepository = getRepository(ClubMember);
    const clubMembers = await clubMemberRepository
      .createQueryBuilder()
      .where({
        club: {id: clubId},
        player: {id: playerId},
      })
      .addSelect('balance', 'balance')
      .execute();

    const clubMember = clubMembers[0];
    if (!clubMember) {
      logger.error(`Player ${playerId} is not in the club: ${clubId}`);
      throw new Error(`Player ${playerId} is not in the club`);
    }

    const query =
      'SELECT SUM(buy_in) current_buyin FROM player_game_tracker pgt, poker_game pg WHERE pgt.pgt_player_id = ' +
      playerId +
      ' AND pgt.pgt_game_id = pg.id AND pg.game_status <>' +
      GameStatus.ENDED;
    const resp = await getConnection().query(query);

    const currentBuyin = resp[0]['current_buyin'];

    let outstandingBalance = clubMember.balance;
    if (currentBuyin) {
      outstandingBalance += currentBuyin;
    }
    return outstandingBalance;
  }

  private async updateNextHandrecord(
    oldStatus: NextHandUpdate,
    newStatus: NextHandUpdate
  ) {
    const nextHandUpdatesRepository = getRepository(NextHandUpdates);
    await nextHandUpdatesRepository
      .createQueryBuilder()
      .update()
      .set({
        newUpdate: newStatus,
      })
      .where({
        game: {id: this.game.id},
        player: {id: this.player.id},
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
      nextHandUpdatesRepository = transactionEntityManager.getRepository(
        NextHandUpdates
      );
    } else {
      nextHandUpdatesRepository = getRepository(NextHandUpdates);
    }
    const update = new NextHandUpdates();
    update.game = this.game;
    update.player = this.player;
    update.newUpdate = status;
    update.buyinAmount = amount;
    await nextHandUpdatesRepository.save(update);
  }

  public async timerExpired() {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);

    // find the player
    const playerInSeat = await playerGameTrackerRepository.findOne({
      relations: ['player'],
      where: {
        game: {id: this.game.id},
        player: {id: this.player.id},
      },
    });

    if (!playerInSeat) {
      // We shouldn't be here
      return;
    }

    if (
      playerInSeat.status == PlayerStatus.WAIT_FOR_BUYIN ||
      playerInSeat.status == PlayerStatus.WAIT_FOR_BUYIN_APPROVAL
    ) {
      // buyin timeout expired

      // mark the player as not playing
      await playerGameTrackerRepository.update(
        {
          game: {id: this.game.id},
          player: {id: this.player.id},
        },
        {
          status: PlayerStatus.NOT_PLAYING,
          seatNo: 0,
        }
      );

      // delete the row in pending updates table
      const pendingUpdatesRepo = getRepository(NextHandUpdates);
      await pendingUpdatesRepo.delete({
        game: {id: this.game.id},
        player: {id: this.player.id},
        newUpdate: NextHandUpdate.WAIT_BUYIN_APPROVAL,
      });
      // update the clients with new status
      await playerStatusChanged(
        this.game,
        this.player,
        playerInSeat.status,
        NewUpdate.BUYIN_TIMEDOUT,
        playerInSeat.stack,
        playerInSeat.seatNo
      );
    } else if (playerInSeat.status == PlayerStatus.PLAYING) {
      // cancel timer wasn't called (ignore the timeout callback)
    }
  }
}
