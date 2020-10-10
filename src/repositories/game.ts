import {getRepository, getManager, getConnection, createQueryBuilder} from 'typeorm';
import {PokerGame, GameType, GameStatus} from '@src/entity/game';
import {Club, ClubMember, ClubMemberStatus, ClubStatus} from '@src/entity/club';
import {Player} from '@src/entity/player';
import {GameServer, TrackGameServer} from '@src/entity/gameserver';
import {getLogger} from '@src/utils/log';
import {ClubGameRake} from '@src/entity/chipstrack';
import {getGameCodeForClub, getGameCodeForPlayer} from '@src/utils/uniqueid';

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
    game.status = GameStatus.WAITING;
    if (club) {
      game.club = club;
    }
    let savedGame;
    // use current time as the game id for now
    game.gameCode = await getGameCodeForClub(clubCode, club.id);
    game.privateGame = true;

    game.startedAt = new Date();
    game.startedBy = player;
    try {
      const gameRespository = getRepository(PokerGame);
      await getManager().transaction(async transactionalEntityManager => {
        savedGame = await gameRespository.save(game);

        const pick = Number.parseInt(savedGame.id) % gameServers.length;
        const trackgameServerRepository = getRepository(TrackGameServer);
        const trackServer = new TrackGameServer();
        trackServer.clubCode = clubCode;
        trackServer.gameCode = savedGame.gameCode;
        trackServer.gameServerId = gameServers[pick];
        await trackgameServerRepository.save(trackServer);

        const clubRake = new ClubGameRake();
        clubRake.club = club;
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
    game.status = GameStatus.WAITING;
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
        trackServer.clubCode = '000000';
        trackServer.gameCode = savedGame.gameCode;
        trackServer.gameServerId = gameServers[pick];
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

  public async getGameById(gameCode: string): Promise<PokerGame | undefined> {
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

  public async markGameStarted(clubId: number, gameId: number) {
    this.markGameStatus(clubId, gameId, GameStatus.RUNNING);
  }

  public async markGameEnded(clubId: number, gameId: number) {
    this.markGameStatus(clubId, gameId, GameStatus.ENDED);
  }

  public async markGameStatus(clubId: number, gameId: number, status: GameStatus) {
    const repository = getRepository(PokerGame);
    const game = await repository.findOne({where: {id: gameId}});
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }

    await getConnection()
      .createQueryBuilder()
      .update(PokerGame)
      .set({status: status, endedAt: new Date()})
      .where('id = :id', {id: gameId})
      .execute();
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
            AND g.game_status = ${GameStatus.RUNNING}
          LEFT OUTER JOIN 
            player_game_tracker pgt ON
            pgt.player_id = c.player_id AND
            pgt.game_id  = g.id;
        `;
    const resp = await getConnection().query(query);
    console.log(JSON.stringify(resp));
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
            pgt.player_id = c.player_id AND
            pgt.game_id  = g.id;
        `;
    const resp = await getConnection().query(query);
    console.log(JSON.stringify(resp));
    return resp;
  }
}

export const GameRepository = new GameRepositoryImpl();
