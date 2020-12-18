import * as crypto from 'crypto';
import {
  getRepository,
  getManager,
  getConnection,
  In,
  Repository,
  EntityManager,
} from 'typeorm';
import {NextHandUpdates, PokerGame, PokerGameUpdates} from '@src/entity/game';
import {
  GameType,
  GameStatus,
  ClubMemberStatus,
  ClubStatus,
  PlayerStatus,
  BuyInApprovalStatus,
  TableStatus,
  NextHandUpdate,
} from '@src/entity/types';
import {Club, ClubMember} from '@src/entity/club';
import {Player} from '@src/entity/player';
import {GameServer, TrackGameServer} from '@src/entity/gameserver';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {getGameCodeForClub, getGameCodeForPlayer} from '@src/utils/uniqueid';
import {
  newPlayerSat,
  publishNewGame,
  playerBuyIn,
  changeGameStatus,
  playerKickedOut,
  startTimer,
} from '@src/gameserver';
import {isPostgres} from '@src/utils';
import {WaitListMgmt} from './waitlist';
import {Reward, GameRewardTracking, GameReward} from '@src/entity/reward';
import {ChipsTrackRepository} from './chipstrack';
import {BUYIN_TIMEOUT} from './types';
import {Cache} from '@src/cache/index';

const logger = getLogger('game');

class GameRepositoryImpl {
  public async createPrivateGame(
    clubCode: string,
    playerId: string,
    input: any,
    template = false
  ): Promise<PokerGame> {
    // first check whether this user can create a game in this club
    const clubMemberRepository = getRepository<ClubMember>(ClubMember);

    const clubRepository = getRepository(Club);
    const club = await clubRepository.findOne({clubCode: clubCode});
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }

    const playerRepository = getRepository(Player);
    const player = await playerRepository.findOne({uuid: playerId});
    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }

    const clubMember = await clubMemberRepository.findOne({
      where: {
        club: {id: club.id},
        player: {id: player.id},
      },
    });
    if (!clubMember) {
      throw new Error(`The player ${playerId} is not in the club`);
    }
    if (!(clubMember.isOwner || clubMember.isManager)) {
      throw new Error(
        `The player ${playerId} is not a owner or a manager of the club`
      );
    }

    if (clubMember.isManager && clubMember.status === ClubMemberStatus.ACTIVE) {
      throw new Error(
        `The player ${playerId} is not an approved manager to create a game`
      );
    }
    const gameServerRepository = getRepository(GameServer);
    const gameServers = await gameServerRepository.find();
    if (gameServers.length === 0) {
      throw new Error('No game server is availabe');
    }

    // create the game
    const game: PokerGame = {...input} as PokerGame;
    const gameTypeStr: string = input['gameType'];
    const gameType: GameType = GameType[gameTypeStr];
    game.gameType = gameType;
    game.isTemplate = template;
    game.status = GameStatus.CONFIGURED;
    if (club) {
      game.club = club;
    }
    let savedGame;
    // use current time as the game id for now
    game.gameCode = await getGameCodeForClub(clubCode, club.id);
    // game.gameCode = Date.now().toString();
    const gameRespository = getRepository(PokerGame);

    /*
    ///NOTE: TEST CODE
    game.gameCode = 'LEJRYK';
    await getConnection()
      .createQueryBuilder()
      .delete()
      .from(TrackGameServer)
      .execute();

    await getConnection()
      .createQueryBuilder()
      .delete()
      .from(PlayerGameTracker)
      .execute();

    await getConnection()
      .createQueryBuilder()
      .delete()
      .from(PokerGame)
      .where('gameCode = :gameCode', {gameCode: game.gameCode})
      .execute();
    ///NOTE: TEST CODE
    */

    game.privateGame = true;

    game.startedAt = new Date();
    game.startedBy = player;

    try {
      logger.info('****** STARTING TRANSACTION TO CREATE a private game');

      await getManager().transaction(async transactionEntityManager => {
        savedGame = await transactionEntityManager
          .getRepository(PokerGame)
          .save(game);

        if (!game.isTemplate) {
          // create a entry in PokerGameUpdates
          const gameUpdatesRepo = transactionEntityManager.getRepository(
            PokerGameUpdates
          );
          const gameUpdates = new PokerGameUpdates();
          gameUpdates.gameID = savedGame.id;
          await gameUpdatesRepo.save(gameUpdates);
          let pick = 0;
          if (gameServers.length > 0) {
            pick = Number.parseInt(savedGame.id) % gameServers.length;
          }

          const rewardTrackingIds = new Array<number>();
          if (input.rewardIds) {
            for await (const rewardId of input.rewardIds) {
              const rewardRepository = transactionEntityManager.getRepository(
                Reward
              );
              await rewardRepository.findOne({id: rewardId});

              const rewardTrackRepo = transactionEntityManager.getRepository(
                GameRewardTracking
              );
              const rewardTrack = await rewardTrackRepo.findOne({
                rewardId: rewardId,
                active: true,
              });
              if (!rewardTrack) {
                const createRewardTrack = new GameRewardTracking();
                createRewardTrack.rewardId = rewardId;
                createRewardTrack.day = new Date();

                const rewardTrackRepository = transactionEntityManager.getRepository(
                  GameRewardTracking
                );
                const rewardTrackResponse = await rewardTrackRepository.save(
                  createRewardTrack
                );
                const createGameReward = new GameReward();
                createGameReward.gameId = game;
                createGameReward.rewardId = rewardId;
                createGameReward.rewardTrackingId = rewardTrackResponse;
                rewardTrackingIds.push(rewardTrackResponse.id);

                const gameRewardRepository = transactionEntityManager.getRepository(
                  GameReward
                );
                const a = await gameRewardRepository.save(createGameReward);
              } else {
                const createGameReward = new GameReward();
                createGameReward.gameId = game;
                createGameReward.rewardId = rewardId;
                createGameReward.rewardTrackingId = rewardTrack;

                const gameRewardRepository = transactionEntityManager.getRepository(
                  GameReward
                );
                await gameRewardRepository.save(createGameReward);
              }
            }
          }

          let scanServer = 0;
          let gameServer;
          let tableStatus;
          for (scanServer = 0; scanServer < gameServers.length; scanServer++) {
            // create a new game in game server within the transcation
            try {
              gameServer = gameServers[pick];
              const gameInput = game as any;
              gameInput.rewardTrackingIds = rewardTrackingIds;
              tableStatus = await publishNewGame(gameInput, gameServer);
              break;
            } catch (err) {
              logger.warn(
                `Game Id: ${savedGame.id} cannot be hosted by game server: ${gameServer.url}`
              );
            }
            gameServer = null;
            pick++;
            if (pick === gameServers.length) {
              pick = 0;
            }
          }

          if (!gameServer) {
            // could not assign game server for the game
            throw new Error('No game server is accepting this game');
          }

          game.tableStatus = tableStatus;
          await transactionEntityManager.getRepository(PokerGame).update(
            {
              id: game.id,
            },
            {tableStatus: tableStatus}
          );

          const trackgameServerRepository = transactionEntityManager.getRepository(
            TrackGameServer
          );
          const trackServer = new TrackGameServer();
          trackServer.game = savedGame;
          trackServer.gameServer = gameServers[pick];
          await trackgameServerRepository.save(trackServer);
        }
      });
      logger.info('****** ENDING TRANSACTION TO CREATE a private game');
    } catch (err) {
      logger.error(
        `Couldn't create game and retry again. Error: ${err.toString()}`
      );
      throw new Error("Couldn't create the game, please retry again");
    }
    return savedGame;
  }

  public async createPrivateGameForPlayer(
    playerId: string,
    input: any,
    template = false
  ): Promise<PokerGame> {
    const playerRepository = getRepository(Player);
    const player = await playerRepository.findOne({uuid: playerId});
    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }

    const gameServerRepository = getRepository(GameServer);
    const gameServers = await gameServerRepository.find();
    if (gameServers.length === 0) {
      throw new Error('No game server is availabe');
    }

    // create the game
    const game: PokerGame = {...input} as PokerGame;
    const gameTypeStr: string = input['gameType'];
    const gameType: GameType = GameType[gameTypeStr];
    game.gameType = gameType;
    game.isTemplate = template;
    game.status = GameStatus.CONFIGURED;
    game.host = player;
    game.gameCode = await getGameCodeForPlayer(player.id);
    game.privateGame = true;
    game.startedAt = new Date();
    game.startedBy = player;

    let savedGame;
    try {
      const gameRespository = getRepository(PokerGame);
      await getManager().transaction(async transactionEntityManager => {
        savedGame = await transactionEntityManager
          .getRepository(PokerGame)
          .save(game);

        const pick = savedGame.id % gameServers.length;
        const trackServer = new TrackGameServer();
        trackServer.game = savedGame;
        trackServer.gameServer = gameServers[pick];
        await transactionEntityManager
          .getRepository(TrackGameServer)
          .save(trackServer);
      });
    } catch (err) {
      logger.error("Couldn't create game and retry again");
      throw new Error("Couldn't create the game, please retry again");
    }
    return savedGame;
  }

  public async getGameByCode(
    gameCode: string,
    transactionManager?: EntityManager
  ): Promise<PokerGame | undefined> {
    let repository: Repository<PokerGame>;
    if (transactionManager) {
      repository = transactionManager.getRepository(PokerGame);
    } else {
      repository = getRepository(PokerGame);
    }

    // get game by id (testing only)
    const game = await repository.findOne({where: {gameCode: gameCode}});
    return game;
  }

  public async getGameCountByClubId(clubId: number): Promise<number> {
    const repository = getRepository(PokerGame);
    const count = await repository.count({where: {club: {id: clubId}}});
    return count;
  }

  public async getGameCountByPlayerId(playerId: number): Promise<number> {
    const repository = getRepository(PokerGame);
    const count = await repository.count({where: {host: {id: playerId}}});
    return count;
  }

  public async getLiveGames(playerId: string) {
    // get the list of live games associated with player clubs
    const query = `
          WITH my_clubs AS (SELECT DISTINCT c.*, p.id player_id FROM club c JOIN club_member cm ON
            c.id  = cm.club_id JOIN player p ON 
            cm.player_id = p.id AND 
            p.uuid = '${playerId}' AND
            c.status = ${ClubStatus.ACTIVE} AND cm.status = ${ClubMemberStatus.ACTIVE})
          SELECT 
            c.club_code as "clubCode", 
            c.name as "clubName", 
            g.game_code as "gameCode", 
            g.id as gameId, 
            g.title as title, 
            g.game_type as "gameType", 
            g.buy_in_min as "buyInMin", 
            g.buy_in_max as "buyInMax", 
            EXTRACT(EPOCH FROM(now()-g.started_at)) as "elapsedTime", 
            g.started_at as "startedAt", 
            g.max_players as "maxPlayers", 
            g.max_waitlist as "maxWaitList", 
            pgu.players_in_waitlist as "waitlistCount", 
            pgu.players_in_seats as "tableCount", 
            g.game_status as "gameStatus",
            pgt.status as "playerStatus"
          FROM poker_game g JOIN poker_game_updates pgu ON 
          g.id = pgu.game_id JOIN my_clubs c ON 
            g.club_id = c.id 
            AND g.game_status NOT IN (${GameStatus.ENDED})
          LEFT OUTER JOIN 
            player_game_tracker pgt ON
            pgt.pgt_player_id = c.player_id AND
            pgt.pgt_game_id  = g.id`;
    const resp = await getConnection().query(query);
    return resp;
  }

  public async getPastGames(playerId: string) {
    // get the list of past games associated with player clubs
    const query = `
          WITH my_clubs AS (SELECT DISTINCT c.*, p.id player_id FROM club c JOIN club_member cm ON
            c.id  = cm.club_id JOIN player p ON 
            cm.player_id = p.id AND 
            p.uuid = '${playerId}' AND
            c.status = ${ClubStatus.ACTIVE} AND cm.status = ${ClubMemberStatus.ACTIVE})
          SELECT 
            c.club_code as "clubCode", 
            c.name as "clubName", 
            g.game_code as "gameCode", 
            g.id as gameId, 
            g.title as title, 
            g.game_type as "gameType", 
            g.buy_in_min as "buyInMin", 
            g.buy_in_max as "buyInMax", 
            EXTRACT(EPOCH FROM(g.ended_at-g.started_at)) as "gameTime", 
            g.started_at as "startedAt", 
            g.ended_at as "endedAt",
            g.max_players as "maxPlayers", 
            g.max_waitlist as "maxWaitList", 
            pgt.status as "playerStatus",
            pgt.session_time as "sessionTime",
            pgt.buy_in as "buyIn",
            pgt.stack as "stack"            
          FROM poker_game g JOIN my_clubs c 
          ON 
            g.club_id = c.id 
            AND g.game_status = ${GameStatus.ENDED}
          LEFT OUTER JOIN 
            player_game_tracker pgt ON
            pgt.pgt_player_id = c.player_id AND
            pgt.pgt_game_id  = g.id;
        `;
    const resp = await getConnection().query(query);
    return resp;
  }

  public async getNextGameServer(): Promise<number> {
    const query = 'SELECT max(server_num)+1 next_number FROM game_server';
    const resp = await getConnection().query(query);
    let nextNumber = 1;
    if (resp[0]['next_number']) {
      nextNumber = resp[0]['next_number'];
    }
    return nextNumber;
  }

  public async joinGame(
    player: Player,
    game: PokerGame,
    seatNo: number
  ): Promise<PlayerStatus> {
    if (seatNo > game.maxPlayers) {
      throw new Error('Invalid seat number');
    }

    const status = await getManager().transaction(
      async transactionEntityManager => {
        // get game updates
        const gameUpdateRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        const gameUpdate = await gameUpdateRepo.findOne({
          where: {
            gameID: game.id,
          },
        });
        if (!gameUpdate) {
          console.log(`Game status is not found for game: ${game.gameCode}`);
          throw new Error(
            `Game status is not found for game: ${game.gameCode}`
          );
        }

        if (gameUpdate.seatChangeInProgress) {
          throw new Error(
            `Seat change is in progress for game: ${game.gameCode}`
          );
        }

        const waitlistMgmt = new WaitListMgmt(game);

        const playerGameTrackerRepository = transactionEntityManager.getRepository(
          PlayerGameTracker
        );
        if (gameUpdate.waitlistSeatingInprogress) {
          // wait list seating in progress
          // only the player who is asked from the waiting list can sit here
          await waitlistMgmt.seatPlayer(player);
        }

        // player is taking a seat in the game
        // ensure the seat is available
        // create a record in the player_game_tracker
        // set the player status to waiting_for_buyin
        // send a message to game server that a new player is in the seat
        const playerInSeat = await playerGameTrackerRepository.findOne({
          relations: ['player'],
          where: {
            game: {id: game.id},
            seatNo: seatNo,
          },
        });

        // if the current player in seat tried to sit in the same seat, do nothing
        if (playerInSeat && playerInSeat.player.id === player.id) {
          return playerInSeat.status;
        }

        if (playerInSeat && playerInSeat.player.id !== player.id) {
          // there is a player in the seat (unexpected)
          throw new Error(
            `A player ${playerInSeat.player.name}:${playerInSeat.player.uuid} is sitting in seat: ${seatNo}`
          );
        }
        // if this player has already played this game before, we should have his record
        const playerInGames = await playerGameTrackerRepository
          .createQueryBuilder()
          .where({
            game: {id: game.id},
            player: {id: player.id},
          })
          .select('stack')
          .addSelect('status')
          .addSelect('buy_in', 'buyIn')
          .addSelect('game_token', 'gameToken')
          .execute();

        let playerInGame: any = null;
        if (playerInGames.length > 0) {
          playerInGame = playerInGames[0];
        }

        if (playerInGame) {
          playerInGame.seatNo = seatNo;
        } else {
          playerInGame = new PlayerGameTracker();
          playerInGame.player = player;
          playerInGame.game = game;
          playerInGame.stack = 0;
          playerInGame.buyIn = 0;
          playerInGame.seatNo = seatNo;
          playerInGame.noOfBuyins = 0;
          playerInGame.buyinNotes = '';
          const randomBytes = Buffer.from(crypto.randomBytes(5));
          playerInGame.gameToken = randomBytes.toString('hex');
          playerInGame.status = PlayerStatus.NOT_PLAYING;
          try {
            await playerGameTrackerRepository.save(playerInGame);
          } catch (err) {
            const doesGameExist = await this.getGameByCode(
              game.gameCode,
              transactionEntityManager
            );
            if (doesGameExist) {
              logger.error(
                `Failed to update player_game_tracker table ${err.toString()} Game: ${
                  doesGameExist.id
                }`
              );
            }
            throw err;
          }
        }

        // we need 5 bytes to scramble 5 cards
        if (playerInGame.stack > 0) {
          playerInGame.status = PlayerStatus.PLAYING;
        } else {
          playerInGame.status = PlayerStatus.WAIT_FOR_BUYIN;
        }

        await playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            player: {id: player.id},
          },
          {
            seatNo: seatNo,
            status: playerInGame.status,
          }
        );

        // get number of players in the seats
        const count = await playerGameTrackerRepository.count({
          where: {
            game: {id: game.id},
            status: In([
              PlayerStatus.PLAYING,
              PlayerStatus.IN_BREAK,
              PlayerStatus.WAIT_FOR_BUYIN,
            ]),
          },
        });

        const gameUpdatesRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        await gameUpdatesRepo.update(
          {
            gameID: game.id,
          },
          {playersInSeats: count}
        );

        if (playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN) {
          // TODO: start a buy-in timer
          const buyinTimeExp = new Date();
          const timeout = 60;
          buyinTimeExp.setSeconds(buyinTimeExp.getSeconds() + timeout);
          startTimer(game.id, player.id, BUYIN_TIMEOUT, buyinTimeExp);
        }

        // send a message to gameserver
        newPlayerSat(game, player, seatNo, playerInGame);

        // continue to run wait list seating
        waitlistMgmt.runWaitList();
        return playerInGame.status;
      }
    );
    return status;
  }

  public async buyIn(
    player: Player,
    game: PokerGame,
    amount: number,
    reload: boolean
  ): Promise<BuyInApprovalStatus> {
    const status = await getManager().transaction(
      async transactionEntityManager => {
        // player must be already in a seat or waiting list
        // if credit limit is set, make sure his buyin amount is within the credit limit
        // if auto approval is set, add the buyin
        // make sure buyin within min and maxBuyin
        // send a message to game server that buyer stack has been updated
        const playerGameTrackerRepository = transactionEntityManager.getRepository(
          PlayerGameTracker
        );
        const playerInGame = await playerGameTrackerRepository.findOne({
          where: {
            game: {id: game.id},
            player: {id: player.id},
          },
        });

        if (!playerInGame) {
          logger.error(
            `Player ${player.name} is not in the game: ${game.gameCode}`
          );
          throw new Error(`Player ${player.name} is not in the game`);
        }

        // check amount should be between game.minBuyIn and game.maxBuyIn
        if (
          playerInGame.stack + amount < game.buyInMin ||
          playerInGame.stack + amount > game.buyInMax
        ) {
          throw new Error(
            `Buyin must be between ${game.buyInMin} and ${game.buyInMax}`
          );
        }

        if (reload) {
          // if reload is set to true, if stack exceeds game.maxBuyIn
          if (playerInGame.stack + amount > game.buyInMax) {
            amount = game.buyInMax - playerInGame.stack;
          }
        }

        // NOTE TO SANJAY: Add other functionalities
        const clubMemberRepository = transactionEntityManager.getRepository<
          ClubMember
        >(ClubMember);
        const clubMember = await clubMemberRepository.findOne({
          where: {
            club: {id: game.club.id},
            player: {id: player.id},
          },
        });
        if (!clubMember) {
          throw new Error(`The player ${player.name} is not in the club`);
        }

        if (clubMember.autoBuyinApproval) {
          playerInGame.buyInStatus = BuyInApprovalStatus.APPROVED;
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
        } else {
          const query =
            'SELECT SUM(buy_in) current_buyin FROM player_game_tracker pgt, poker_game pg WHERE pgt.pgt_player_id = ' +
            player.id +
            ' AND pgt.pgt_game_id = pg.id AND pg.game_status =' +
            GameStatus.ENDED;
          const resp = await transactionEntityManager.query(query);

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
            // player is within the credit limit
            playerInGame.buyInStatus = BuyInApprovalStatus.APPROVED;
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
          } else {
            playerInGame.buyinNotes = `Player ${player.name} has ${outstandingBalance} outstanding balance and Requested: ${amount}`;
            playerInGame.buyInStatus = BuyInApprovalStatus.WAITING_FOR_APPROVAL;
          }
        }

        await playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            player: {id: player.id},
          },
          {
            buyInStatus: playerInGame.buyInStatus,
            stack: playerInGame.stack,
            buyIn: playerInGame.buyIn,
            noOfBuyins: playerInGame.noOfBuyins,
            buyinNotes: playerInGame.buyinNotes,
            status: playerInGame.status,
          }
        );

        const count = await playerGameTrackerRepository.count({
          where: {
            game: {id: game.id},
            status: PlayerStatus.PLAYING,
          },
        });

        const gameUpdatesRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        await gameUpdatesRepo.update(
          {
            gameID: game.id,
          },
          {playersInSeats: count}
        );

        // send a message to gameserver
        // get game server of this game
        const gameServer = await this.getGameServer(game.id);
        if (gameServer) {
          playerBuyIn(game, player, playerInGame);
        }

        return playerInGame.buyInStatus;
      }
    );
    return status;
  }

  public async approveBuyIn(
    player: Player,
    game: PokerGame,
    amount: number
  ): Promise<BuyInApprovalStatus> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      where: {
        game: {id: game.id},
        player: {id: player.id},
      },
    });

    if (!playerInGame) {
      logger.error(
        `Player ${player.name} is not in the game: ${game.gameCode}`
      );
      throw new Error(`Player ${player.name} is not in the game`);
    }

    // check amount should be between game.minBuyIn and game.maxBuyIn
    if (
      playerInGame.stack + amount < game.buyInMin ||
      playerInGame.stack + amount > game.buyInMax
    ) {
      throw new Error(
        `Buyin must be between ${game.buyInMin} and ${game.buyInMax}`
      );
    }

    playerInGame.buyInStatus = BuyInApprovalStatus.APPROVED;
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

    await playerGameTrackerRepository.update(
      {
        game: {id: game.id},
        player: {id: player.id},
      },
      {
        buyInStatus: playerInGame.buyInStatus,
        stack: playerInGame.stack,
        buyIn: playerInGame.buyIn,
        noOfBuyins: playerInGame.noOfBuyins,
        // buyinNotes: playerInGame.buyinNotes,
        status: playerInGame.status,
      }
    );

    // send a message to gameserver
    // get game server of this game
    playerBuyIn(game, player, playerInGame);

    return playerInGame.buyInStatus;
  }

  public async myGameState(
    player: Player,
    game: PokerGame
  ): Promise<PlayerGameTracker> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      where: {
        game: {id: game.id},
        player: {id: player.id},
      },
    });
    const allPlayers = await playerGameTrackerRepository.find({
      relations: ['player'],
      where: {
        game: {id: game.id},
      },
    });

    if (!playerInGame) {
      logger.error(
        `Player ${player.name} is not in the game: ${game.gameCode}`
      );
      throw new Error(`Player ${player.name} is not in the game`);
    }
    return playerInGame;
  }

  public async tableGameState(game: PokerGame): Promise<PlayerGameTracker[]> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.find({
      where: {
        game: {id: game.id},
      },
    });

    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
    }

    return playerInGame;
  }

  public async leaveGame(player: Player, game: PokerGame): Promise<boolean> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getRepository(NextHandUpdates);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        player: {id: player.id},
      })
      .select('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];

    if (
      game.status === GameStatus.ACTIVE &&
      playerInGame.status === PlayerStatus.PLAYING
    ) {
      const update = new NextHandUpdates();
      update.game = game;
      update.player = player;
      update.newUpdate = NextHandUpdate.LEAVE;
      await nextHandUpdatesRepository.save(update);
    } else {
      playerInGame.status = PlayerStatus.NOT_PLAYING;
      playerInGame.seatNo = 0;
      playerGameTrackerRepository.update(
        {
          game: {id: game.id},
          player: {id: player.id},
        },
        {
          status: PlayerStatus.NOT_PLAYING,
          seatNo: 0,
        }
      );
    }
    return true;
  }

  public async takeBreak(player: Player, game: PokerGame): Promise<boolean> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getRepository(NextHandUpdates);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        player: {id: player.id},
      })
      .select('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];
    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
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

    if (game.status !== GameStatus.ACTIVE) {
      playerInGame.status = PlayerStatus.IN_BREAK;
      playerGameTrackerRepository.update(
        {
          game: {id: game.id},
          player: {id: player.id},
        },
        {
          status: playerInGame.status,
        }
      );
    } else {
      const update = new NextHandUpdates();
      update.game = game;
      update.player = player;
      update.newUpdate = NextHandUpdate.TAKE_BREAK;
      await nextHandUpdatesRepository.save(update);
    }
    return true;
  }

  public async sitBack(player: Player, game: PokerGame): Promise<boolean> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getRepository(NextHandUpdates);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        player: {id: player.id},
      })
      .select('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];
    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
    }

    if (playerInGame.status === PlayerStatus.IN_BREAK) {
      if (game.status === GameStatus.ACTIVE) {
        const update = new NextHandUpdates();
        update.game = game;
        update.player = player;
        update.newUpdate = NextHandUpdate.BACK_FROM_BREAK;
        await nextHandUpdatesRepository.save(update);
      } else {
        playerInGame.status = PlayerStatus.PLAYING;
        playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            player: {id: player.id},
          },
          {
            status: playerInGame.status,
          }
        );
      }
    } else {
      const nextHandUpdate = await nextHandUpdatesRepository.findOne({
        where: {
          game: {id: game.id},
          player: {id: player.id},
          newUpdate: NextHandUpdate.TAKE_BREAK,
        },
      });

      if (!nextHandUpdate) {
        logger.error('The player has not taken a break');
        throw new Error('The player has not taken a break');
      }

      await nextHandUpdatesRepository.delete({id: nextHandUpdate.id});
    }

    return true;
  }

  public async updateBreakTime(playerId: number, gameId: number) {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: gameId},
        player: {id: playerId},
      })
      .select('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];
    if (!playerInGame) {
      logger.error(`Game: ${gameId} not available`);
      throw new Error(`Game: ${gameId} not available`);
    }
    await playerGameTrackerRepository
      .createQueryBuilder()
      .update()
      .set({
        breakTimeAt: new Date(),
      })
      .execute();

    return playerInGame.status;
  }

  public async markPlayerGameState(
    playerId: number,
    gameId: number,
    status: PlayerStatus
  ) {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);

    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: gameId},
        player: {id: playerId},
      })
      .select('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];
    if (!playerInGame) {
      logger.error(`Game: ${gameId} not available`);
      throw new Error(`Game: ${gameId} not available`);
    }
    const playerStatus = (PlayerStatus[status] as unknown) as PlayerStatus;
    await playerGameTrackerRepository
      .createQueryBuilder()
      .update()
      .set({
        status: playerStatus,
      })
      .execute();
    return playerStatus;
  }

  public async getGameServer(gameId: number): Promise<GameServer | null> {
    const trackgameServerRepository = getRepository(TrackGameServer);
    const gameServer = await trackgameServerRepository.findOne({
      where: {game: {id: gameId}},
    });
    if (!gameServer) {
      return null;
    }
    return gameServer.gameServer;
  }

  public async startGame(player: Player, game: PokerGame): Promise<GameStatus> {
    if (game.status === GameStatus.ENDED) {
      // game that ended cannot be restarted
      logger.error(`Game: ${game.gameCode} is ended. Cannot be restarted`);
    }
    await this.markGameStatus(game.id, GameStatus.ACTIVE);
    return GameStatus.ACTIVE;
  }

  public async markGameActive(gameId: number): Promise<GameStatus> {
    return this.markGameStatus(gameId, GameStatus.ACTIVE);
  }

  public async markGameEnded(gameId: number): Promise<GameStatus> {
    return this.markGameStatus(gameId, GameStatus.ENDED);
  }

  public async anyPendingUpdates(gameId: number): Promise<boolean> {
    let placeHolder1 = '$1';
    if (!isPostgres()) {
      placeHolder1 = '?';
    }
    const query = `SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ${placeHolder1}`;
    const resp = await getConnection().query(query, [gameId]);
    if (resp[0]['updates'] > 0) {
      return true;
    }
    return false;
  }

  public async endGameNextHand(gameId: number) {
    // check to see if the game is already marked to be ended
    const repository = getRepository(NextHandUpdates);

    let placeHolder1 = '$1';
    let placeHolder2 = '$2';
    if (!isPostgres()) {
      placeHolder1 = '?';
      placeHolder2 = '?';
    }
    const query = `SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ${placeHolder1} AND new_update = ${placeHolder2}`;
    const resp = await getConnection().query(query, [
      gameId,
      NextHandUpdate.END_GAME,
    ]);
    if (resp[0]['updates'] === 0) {
      const nextHandUpdate = new NextHandUpdates();
      const game = new PokerGame();
      game.id = gameId;
      nextHandUpdate.game = game;
      nextHandUpdate.newUpdate = NextHandUpdate.END_GAME;
      repository.save(nextHandUpdate);

      // notify users that the game will end in the next hand
    }
  }

  public async markGameStatus(gameId: number, status: GameStatus) {
    const repository = getRepository(PokerGame);
    const game = await repository.findOne({where: {id: gameId}});
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }

    const values: any = {
      status: status,
    };
    if (status === GameStatus.ENDED) {
      values.endedAt = new Date();
    }

    await getConnection()
      .createQueryBuilder()
      .update(PokerGame)
      .set(values)
      .where('id = :id', {id: gameId})
      .execute();

    // update the game server with new status
    changeGameStatus(game, status);

    // if game ended
    if (status === GameStatus.ENDED) {
      // complete books
      ChipsTrackRepository.settleClubBalances(game);
    }

    // update cached game
    Cache.getGame(game.gameCode, true /** update */);
    return status;
  }

  public async markTableStatus(gameId: number, status: TableStatus) {
    const repository = getRepository(PokerGame);
    const game = await repository.findOne({where: {id: gameId}});
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }

    await getConnection()
      .createQueryBuilder()
      .update(PokerGame)
      .set({tableStatus: status})
      .where('id = :id', {id: gameId})
      .execute();
    // update cached game
    Cache.getGame(game.gameCode, true /** update */);
    return status;
  }

  public async getPlayersInSeats(gameId: number): Promise<any> {
    let placeHolder1 = '$1';
    if (!isPostgres()) {
      placeHolder1 = '?';
    }

    const query = `SELECT name, uuid as "playerUuid", buy_in as "buyIn", stack, status, seat_no as "seatNo", status FROM 
          player_game_tracker pgt JOIN player p ON pgt.pgt_player_id = p.id
          AND pgt.pgt_game_id = ${placeHolder1} AND pgt.seat_no <> 0`;
    const resp = await getConnection().query(query, [gameId]);
    return resp;
  }

  public async getGamePlayerState(
    gameId: number,
    playerUuid: string
  ): Promise<any | null> {
    let placeHolder1 = '$1';
    let placeHolder2 = '$2';
    if (!isPostgres()) {
      placeHolder1 = '?';
      placeHolder2 = '?';
    }
    const query = `SELECT game_token AS "gameToken", 
      status AS "playerStatus",
      stack AS stack,
      "buyIn_status" as "buyInStatus",
      seat_no as "seatNo"
    FROM  player_game_tracker pgt 
    JOIN player p ON pgt.pgt_player_id = p.id 
    AND p.uuid = ${placeHolder1} 
    AND pgt.pgt_game_id = ${placeHolder2}`;
    const resp = await getConnection().query(query, [playerUuid, gameId]);
    if (resp.length === 0) {
      return null;
    }
    return resp[0];
  }

  public async kickOutPlayer(gameCode: string, player: Player) {
    await getManager().transaction(async transactionEntityManager => {
      // find game
      const game = await this.getGameByCode(gameCode, transactionEntityManager);
      if (!game) {
        throw new Error(`Game ${gameCode} is not found`);
      }
      const playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      const playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: game.id},
          player: {id: player.id},
        },
      });

      if (!playerInGame) {
        // player is not in game
        throw new Error(`Player ${player.name} is not in the game`);
      }

      if (game.tableStatus !== TableStatus.GAME_RUNNING) {
        // we can mark the user as KICKED_OUT from the player game tracker
        await playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            player: {id: player.id},
          },
          {
            seatNo: 0,
            status: PlayerStatus.KICKED_OUT,
          }
        );
        const count = await playerGameTrackerRepository.count({
          where: {
            game: {id: game.id},
            status: PlayerStatus.PLAYING,
          },
        });

        const gameUpdatesRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        await gameUpdatesRepo.update(
          {
            gameID: game.id,
          },
          {playersInSeats: count}
        );
        // notify game server, player is kicked out
        playerKickedOut(game, player, playerInGame.seatNo);
      } else {
        // game is running, so kickout the user in next hand
        // deal with this in the next hand update
        const nextHandUpdatesRepository = transactionEntityManager.getRepository(
          NextHandUpdates
        );
        const update = new NextHandUpdates();
        update.game = game;
        update.player = player;
        update.newUpdate = NextHandUpdate.KICKOUT;
        await nextHandUpdatesRepository.save(update);
      }
    });
  }
}

export const GameRepository = new GameRepositoryImpl();
