import * as crypto from 'crypto';
import {getRepository, getManager, getConnection, Not, IsNull} from 'typeorm';
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
import {ClubGameRake, PlayerGameTracker} from '@src/entity/chipstrack';
import {getGameCodeForClub, getGameCodeForPlayer} from '@src/utils/uniqueid';
import {
  newPlayerSat,
  publishNewGame,
  playerBuyIn,
  changeGameStatus,
  playerKickedOut,
} from '@src/gameserver';
import {isPostgres} from '@src/utils';
import {getGame, getPlayer} from '@src/cache';
import {min} from 'lodash';

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
    const clubGameRakeRepository = getRepository(ClubGameRake);
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
      .from(ClubGameRake)
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
      await getManager().transaction(async () => {
        savedGame = await gameRespository.save(game);

        if (!game.isTemplate) {
          // create a entry in PokerGameUpdates
          const gameUpdatesRepo = getRepository(PokerGameUpdates);
          const gameUpdates = new PokerGameUpdates();
          gameUpdates.gameID = savedGame.id;
          gameUpdatesRepo.save(gameUpdates);
          let pick = 0;
          if (gameServers.length > 0) {
            pick = Number.parseInt(savedGame.id) % gameServers.length;
          }

          let scanServer = 0;
          let gameServer;
          let tableStatus;
          for (scanServer = 0; scanServer < gameServers.length; scanServer++) {
            // create a new game in game server within the transcation
            try {
              gameServer = gameServers[pick];
              tableStatus = await publishNewGame(game, gameServer);
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
          await gameRespository.update(
            {
              id: game.id,
            },
            {tableStatus: tableStatus}
          );
          const clubRake = new ClubGameRake();
          clubRake.club = club;
          clubRake.game = savedGame;
          clubRake.lastHandNum = 0;
          clubRake.promotion = 0;
          clubRake.rake = 0;
          await clubGameRakeRepository.save(clubRake);

          const trackgameServerRepository = getRepository(TrackGameServer);
          const trackServer = new TrackGameServer();
          trackServer.game = savedGame;
          trackServer.gameServer = gameServers[pick];
          await trackgameServerRepository.save(trackServer);
        }
      });
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
      await getManager().transaction(async transactionalEntityManager => {
        savedGame = await gameRespository.save(game);

        const pick = savedGame.id % gameServers.length;
        const trackgameServerRepository = getRepository(TrackGameServer);
        const trackServer = new TrackGameServer();
        trackServer.game = savedGame;
        trackServer.gameServer = gameServers[pick];
        await trackgameServerRepository.save(trackServer);

        const clubGameRakeRepository = getRepository(ClubGameRake);
        const clubRake = new ClubGameRake();
        clubRake.game = savedGame;
        clubRake.lastHandNum = 0;
        clubRake.promotion = 0;
        clubRake.rake = 0;
        await clubGameRakeRepository.save(clubRake);
      });
    } catch (err) {
      logger.error("Couldn't create game and retry again");
      throw new Error("Couldn't create the game, please retry again");
    }
    return savedGame;
  }

  public async getGameByCode(gameCode: string): Promise<PokerGame | undefined> {
    const repository = getRepository(PokerGame);
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
            g.players_in_waitlist as "playersInWaitList", 
            g.players_in_seats as "playersInSeats", 
            g.game_status as "gameStatus",
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
    const status = await getManager().transaction(async () => {
      // player is taking a seat in the game
      // ensure the seat is available
      // create a record in the player_game_tracker
      // set the player status to waiting_for_buyin
      // send a message to game server that a new player is in the seat
      const playerGameTrackerRepository = getRepository(PlayerGameTracker);
      const playerInSeat = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: game.id},
          seatNo: seatNo,
        },
      });

      if (playerInSeat && playerInSeat.player.id !== player.id) {
        // there is a player in the seat (unexpected)
        throw new Error(
          `A player ${playerInSeat.player.name}:${playerInSeat.player.uuid} is sitting in seat: ${seatNo}`
        );
      }
      // if this player has already played this game before, we should have his record
      let thisPlayerInSeat = await playerGameTrackerRepository.findOne({
        relations: ['player', 'club', 'game'],
        where: {
          game: {id: game.id},
          player: {id: player.id},
          // seatNo: seatNo,
        },
      });
      if (thisPlayerInSeat) {
        thisPlayerInSeat.seatNo = seatNo;
      } else {
        thisPlayerInSeat = new PlayerGameTracker();
        thisPlayerInSeat.player = player;
        thisPlayerInSeat.club = game.club;
        thisPlayerInSeat.game = game;
        thisPlayerInSeat.stack = 0;
        thisPlayerInSeat.buyIn = 0;
        thisPlayerInSeat.seatNo = seatNo;
        thisPlayerInSeat.noOfBuyins = 0;
        thisPlayerInSeat.buyinNotes = '';
        const randomBytes = Buffer.from(crypto.randomBytes(5));
        thisPlayerInSeat.gameToken = randomBytes.toString('hex');
      }

      // we need 5 bytes to scramble 5 cards
      if (thisPlayerInSeat.stack > 0) {
        thisPlayerInSeat.status = PlayerStatus.PLAYING;
      } else {
        thisPlayerInSeat.status = PlayerStatus.WAIT_FOR_BUYIN;
      }
      const resp = await playerGameTrackerRepository.save(thisPlayerInSeat);
      const count = await playerGameTrackerRepository.count({
        where: {
          game: {id: game.id},
          status: PlayerStatus.PLAYING,
        },
      });

      const gameUpdatesRepo = getRepository(PokerGameUpdates);
      await gameUpdatesRepo.update(
        {
          gameID: game.id,
        },
        {playersInSeats: count}
      );
      // send a message to gameserver
      newPlayerSat(game, player, seatNo, thisPlayerInSeat);
      return thisPlayerInSeat.status;
    });
    return status;
  }

  public async buyIn(
    player: Player,
    game: PokerGame,
    amount: number,
    reload: boolean
  ): Promise<BuyInApprovalStatus> {
    const status = await getManager().transaction(async () => {
      // player must be already in a seat or waiting list
      // if credit limit is set, make sure his buyin amount is within the credit limit
      // if auto approval is set, add the buyin
      // make sure buyin within min and maxBuyin
      // send a message to game server that buyer stack has been updated
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

      if (reload) {
        // if reload is set to true, if stack exceeds game.maxBuyIn
        if (playerInGame.stack + amount > game.buyInMax) {
          amount = game.buyInMax - playerInGame.stack;
        }
      }

      // NOTE TO SANJAY: Add other functionalities
      const clubMemberRepository = getRepository<ClubMember>(ClubMember);
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

      const gameUpdatesRepo = getRepository(PokerGameUpdates);
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
    });
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
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: game.id},
        player: {id: player.id},
      },
    });

    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
    }

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
      await playerGameTrackerRepository.save(playerInGame);
    }
    return true;
  }

  public async takeBreak(player: Player, game: PokerGame): Promise<boolean> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getRepository(NextHandUpdates);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: game.id},
        player: {id: player.id},
      },
    });

    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
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
      await playerGameTrackerRepository.save(playerInGame);
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
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: game.id},
        player: {id: player.id},
      },
    });

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
        await playerGameTrackerRepository.save(playerInGame);
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

  public async requestSeatChange(
    player: Player,
    game: PokerGame
  ): Promise<Date | null> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: game.id},
        player: {id: player.id},
      },
    });

    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
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
    player: Player,
    game: PokerGame
  ): Promise<PlayerGameTracker[]> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: game.id},
        player: {id: player.id},
      },
    });

    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
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
        game: {id: game.id},
        status: PlayerStatus.PLAYING,
        seatChangeRequestedAt: Not(IsNull()),
      },
    });

    return allPlayersInGame;
  }

  public async confirmSeatChange(
    player: Player,
    game: PokerGame
  ): Promise<boolean> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: game.id},
        player: {id: player.id},
      },
    });

    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
    }

    if (playerInGame.status !== PlayerStatus.PLAYING) {
      logger.error(`player status is ${PlayerStatus[playerInGame.status]}`);
      throw new Error(`player status is ${PlayerStatus[playerInGame.status]}`);
    }

    playerInGame.seatChangeConfirmed = true;
    const resp = await playerGameTrackerRepository.save(playerInGame);
    return resp.seatChangeConfirmed;
  }

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

  public async updateBreakTime(playerId: number, gameId: number) {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: gameId},
        player: {id: playerId},
      },
    });
    if (!playerInGame) {
      logger.error(`Game: ${gameId} not available`);
      throw new Error(`Game: ${gameId} not available`);
    }
    playerInGame.breakTimeAt = new Date();
    const resp = await playerGameTrackerRepository.save(playerInGame);
    return resp.status;
  }

  public async markPlayerGameState(
    playerId: number,
    gameId: number,
    status: PlayerStatus
  ) {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: gameId},
        player: {id: playerId},
      },
    });
    if (!playerInGame) {
      logger.error(`Game: ${gameId} not available`);
      throw new Error(`Game: ${gameId} not available`);
    }
    playerInGame.status = (PlayerStatus[status] as unknown) as PlayerStatus;
    const resp = await playerGameTrackerRepository.save(playerInGame);
    return resp.status;
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

    return status;
  }

  public async getPlayersInSeats(gameId: number): Promise<any> {
    let placeHolder1 = '$1';
    if (!isPostgres()) {
      placeHolder1 = '?';
    }
    const query = `SELECT name, uuid as "playerUuid", buy_in as "buyIn", stack, status, seat_no as "seatNo" FROM 
          player_game_tracker pgt JOIN player p ON pgt.pgt_player_id = p.id
          AND pgt.pgt_game_id = ${placeHolder1} AND seat_no IS NOT NULL`;
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
      seat_no as "seatNo",
      queue_no as "queueNo"
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
    await getManager().transaction(async () => {
      // find game
      const game = await this.getGameByCode(gameCode);
      if (!game) {
        throw new Error(`Game ${gameCode} is not found`);
      }
      const playerGameTrackerRepository = getRepository(PlayerGameTracker);
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
            status: PlayerStatus.KICKED_OUT,
          }
        );
        const count = await playerGameTrackerRepository.count({
          where: {
            game: {id: game.id},
            status: PlayerStatus.PLAYING,
          },
        });

        const gameUpdatesRepo = getRepository(PokerGameUpdates);
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
        const nextHandUpdatesRepository = getRepository(NextHandUpdates);
        const update = new NextHandUpdates();
        update.game = game;
        update.player = player;
        update.newUpdate = NextHandUpdate.KICKOUT;
        await nextHandUpdatesRepository.save(update);
      }
    });
  }

  public async addToWaitingList(playerUuid: string, game: PokerGame) {
    await getManager().transaction(async () => {
      // add this user to waiting list
      // if this user is already playing, then he cannot be in the waiting list
      const playerGameTrackerRepository = getRepository(PlayerGameTracker);

      const player = await getPlayer(playerUuid);
      let playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: game.id},
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
            game: {id: game.id},
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
        playerInGame.player = await getPlayer(playerUuid);
        playerInGame.club = game.club;
        playerInGame.game = game;
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
          game: {id: game.id},
          status: PlayerStatus.IN_QUEUE,
        },
      });

      const gameUpdatesRepo = getRepository(PokerGameUpdates);
      await gameUpdatesRepo.update(
        {
          gameID: game.id,
        },
        {playersInWaitList: count}
      );
    });
  }

  public async removeFromWaitingList(playerUuid: string, game: PokerGame) {
    await getManager().transaction(async () => {
      // remove this user from waiting list
      const playerGameTrackerRepository = getRepository(PlayerGameTracker);
      const player = await getPlayer(playerUuid);
      const playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: game.id},
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
          game: {id: game.id},
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
          game: {id: game.id},
          status: PlayerStatus.IN_QUEUE,
        },
      });

      const gameUpdatesRepo = getRepository(PokerGameUpdates);
      await gameUpdatesRepo.update(
        {
          gameID: game.id,
        },
        {playersInWaitList: count}
      );
    });
  }

  public async getWaitingListUsers(game: PokerGame) {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const waitListPlayers = await playerGameTrackerRepository.find({
      relations: ['player', 'club', 'game'],
      where: {
        game: {id: game.id},
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
      };
    });

    return ret;
  }
}

export const GameRepository = new GameRepositoryImpl();
