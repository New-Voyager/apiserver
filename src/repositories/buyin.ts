import {EntityManager, getConnection, getManager, getRepository} from 'typeorm';
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
import {playerBuyIn, startTimer} from '@src/gameserver';
import {BUYIN_APPROVAL_TIMEOUT, RELOAD_APPROVAL_TIMEOUT} from './types';
import {Club, ClubMember} from '@src/entity/club';

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
    playerInGame: any,
    transactionEntityManager: EntityManager
  ) {
    if (
      this.game.status === GameStatus.ACTIVE &&
      this.game.tableStatus === TableStatus.GAME_RUNNING
    ) {
      // add buyin to next hand update
      await this.addBuyInToNextHand(
        amount,
        NextHandUpdate.BUYIN_APPROVED,
        transactionEntityManager
      );
      playerInGame.status = PlayerStatus.PENDING_UPDATES;
    } else {
      playerInGame.noOfBuyins++;
      playerInGame.stack += amount;
      playerInGame.buyIn += amount;
      // if the player is in the seat and waiting for buyin
      // then mark his status as playing
      if (
        playerInGame.seatNo !== 0 &&
        playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN
      ) {
        playerInGame.status = PlayerStatus.PLAYING;
      }
    }

    return playerInGame.status;
  }

  protected async clubMemberBuyInApproval(
    amount: number,
    playerInGame: any,
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
    let playerStatus: PlayerStatus = PlayerStatus.WAIT_FOR_BUYIN;
    if (clubMember.autoBuyinApproval || this.game.buyInApproval) {
      approved = true;
      playerStatus = await this.approveBuyInRequest(
        amount,
        playerInGame,
        transactionEntityManager
      );
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

        const buyinApprovalTimeExp = new Date();
        //const buyinTimeout = this.game.buyInTimeout;
        const timeout = 60;
        buyinApprovalTimeExp.setSeconds(
          buyinApprovalTimeExp.getSeconds() + timeout
        );
        startTimer(
          this.game.id,
          this.player.id,
          BUYIN_APPROVAL_TIMEOUT,
          buyinApprovalTimeExp
        );
        playerInGame.status = PlayerStatus.PENDING_UPDATES;
        playerStatus = PlayerStatus.WAIT_FOR_BUYIN;
        approved = false;
      }
    }
    return [playerStatus, approved];
  }

  public async request(amount: number): Promise<any> {
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
          throw new Error(
            `Buyin must be between ${this.game.buyInMin} and ${this.game.buyInMax}`
          );
        }

        if (this.game.club) {
          // club game
          [playerStatus, approved] = await this.clubMemberBuyInApproval(
            amount,
            playerInGame,
            transactionEntityManager
          );
        } else {
          // individual game
          throw new Error('Individual game is not implemented yet');
        }
        if (approved) {
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

  public async reloadRequest(amount: number): Promise<any> {
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

  public async pendingApprovalsForClub(club: Club): Promise<any> {
    const query1 = `select 
      g.game_code as "gameCode", 
      g.id as "gameId", 
      p.uuid as "playerUuid", 
      p.name as "name", 
      p.id as "playerId", 
      nhu.buyin_amount as "amount", 
      nhu.new_update as "update" 
      from next_hand_updates nhu 
      join poker_game g on g.club_id = ${
        club.id
      } and g.ended_at is NULL and g.game_status = ${GameStatus.ACTIVE} 
      join player p on p.id = nhu.player_id 
      where nhu.new_update in (
        ${[
          NextHandUpdate.WAIT_BUYIN_APPROVAL,
          NextHandUpdate.WAIT_RELOAD_APPROVAL,
        ]}
      );`;

    const resp1 = await getConnection().query(query1);

    const result = new Array<any>();
    for await (const data of resp1) {
      const outstandingBalance = await this.calcOutstandingBalance(
        club.id,
        data.playerId
      );
      result.push({
        gameCode: data.gameCode,
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

  public async pendingApprovalsForGame(): Promise<any> {
    const query1 = `select 
      g.game_code as "gameCode", 
      g.id as "gameId", 
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

    const result = new Array<any>();
    for await (const data of resp1) {
      const outstandingBalance = await this.calcOutstandingBalance(
        data.clubId,
        data.playerId
      );
      result.push({
        gameCode: data.gameCode,
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
        await this.updateNextHandrecord(
          NextHandUpdate.WAIT_BUYIN_APPROVAL,
          NextHandUpdate.BUYIN_APPROVED
        );
      } else {
        await this.updateNextHandrecord(
          NextHandUpdate.WAIT_BUYIN_APPROVAL,
          NextHandUpdate.BUYIN_DENIED
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
}
