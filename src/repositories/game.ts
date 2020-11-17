import {getRepository, getManager, getConnection} from 'typeorm';
import {PokerGame} from '@src/entity/game';
import {
  GameType,
  GameStatus,
  ClubMemberStatus,
  ClubStatus,
  PlayerStatus,
  TableStatus,
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
} from '@src/nats/index';
import {isPostgres} from '@src/utils';

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
    game.privateGame = true;

    game.startedAt = new Date();
    game.startedBy = player;

    let gameServerId = 0;
    try {
      const gameRespository = getRepository(PokerGame);
      await getManager().transaction(async () => {
        savedGame = await gameRespository.save(game);

        let pick = 0;
        if (gameServers.length > 0) {
          pick = Number.parseInt(savedGame.id) % gameServers.length;
        }
        const trackgameServerRepository = getRepository(TrackGameServer);
        const trackServer = new TrackGameServer();
        trackServer.game = savedGame;
        trackServer.gameServer = gameServers[pick];
        const gameServer = gameServers[pick];
        gameServerId = gameServer.serverNumber;
        await trackgameServerRepository.save(trackServer);

        const clubRake = new ClubGameRake();
        clubRake.club = club;
        clubRake.game = savedGame;
        clubRake.lastHandNum = 0;
        clubRake.promotion = 0;
        clubRake.rake = 0;
        await clubGameRakeRepository.save(clubRake);
      });

      if (!game.isTemplate) {
        // publish a message to NATS topic
        publishNewGame(game);
      }
    } catch (err) {
      logger.error("Couldn't create game and retry again");
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
            g.players_in_waitlist as "playersInWaitList", 
            g.players_in_seats as "playersInSeats", 
            g.game_status as "gameStatus",
            pgt.status as "playerStatus"
          FROM poker_game g JOIN my_clubs c 
          ON 
            g.club_id = c.id 
            AND g.game_status NOT IN (${GameStatus.ENDED})
          LEFT OUTER JOIN 
            player_game_tracker pgt ON
            pgt.pgt_player_id = c.player_id AND
            pgt.pgt_game_id  = g.id;
        `;
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
    if (playerInSeat) {
      // there is a player in the seat (unexpected)
      throw new Error(
        `A player ${playerInSeat.player.name}:${playerInSeat.player.uuid} is sitting in seat: ${seatNo}`
      );
    }
    // if this player has already played this game before, we should have his record
    let thisPlayerInSeat = await playerGameTrackerRepository.findOne({
      where: {
        game: {id: game.id},
        player: {id: player.id},
        seatNo: seatNo,
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
    }
    if (thisPlayerInSeat.stack > 0) {
      thisPlayerInSeat.status = PlayerStatus.PLAYING;
    } else {
      thisPlayerInSeat.status = PlayerStatus.WAIT_FOR_BUYIN;
    }
    const resp = await playerGameTrackerRepository.save(thisPlayerInSeat);

    // send a message to gameserver
    newPlayerSat(game, player, seatNo, thisPlayerInSeat);

    return thisPlayerInSeat.status;
  }

  public async buyIn(
    player: Player,
    game: PokerGame,
    amount: number,
    reload: boolean
  ): Promise<PlayerStatus> {
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

    // NOTE TO SANJAY: Add other functionalities

    if (reload) {
      // if reload is set to true, if stack exceeds game.maxBuyIn
      if (playerInGame.stack + amount > game.buyInMax) {
        amount = game.buyInMax - playerInGame.stack;
      }
    } else {
      playerInGame.noOfBuyins++;
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

    playerInGame.stack = playerInGame.stack + amount;
    playerInGame.buyIn = playerInGame.buyIn + amount;

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
        status: playerInGame.status,
        stack: playerInGame.stack,
        buyIn: playerInGame.buyIn,
        noOfBuyins: playerInGame.noOfBuyins,
      }
    );

    // send a message to gameserver
    // get game server of this game
    playerBuyIn(game, player, playerInGame);

    return playerInGame.status;
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
}

export const GameRepository = new GameRepositoryImpl();
