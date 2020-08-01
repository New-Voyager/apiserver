import {getRepository, getManager} from 'typeorm';
import {PokerGame, GameType, PlayerGame, GameStatus} from '@src/entity/game';
import {Club, ClubMember, ClubMemberStatus} from '@src/entity/club';
import {Player} from '@src/entity/player';
import {GameServer, TrackGameServer} from '@src/entity/gameserver';
import {getLogger} from '@src/utils/log';
import {ClubGameRake} from '@src/entity/chipstrack';
import {getGameCodeForClub} from '@src/utils/uniqueid';

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

    if (clubMember.isManager && clubMember.status == ClubMemberStatus.ACTIVE) {
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
      const playerGameRespository = getRepository(PlayerGame);
      await getManager().transaction(async transactionalEntityManager => {
        savedGame = await gameRespository.save(game);

        const pick = Number.parseInt(savedGame.id) % gameServers.length;
        const trackgameServerRepository = getRepository(TrackGameServer);
        const trackServer = new TrackGameServer();
        trackServer.clubCode = clubCode;
        trackServer.gameCode = savedGame.gameCode;
        trackServer.gameServerId = gameServers[pick];
        await trackgameServerRepository.save(trackServer);

        const playerGame = new PlayerGame();
        playerGame.club = club;
        playerGame.game = savedGame;
        playerGame.player = player;
        await playerGameRespository.save(playerGame);

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
}

export const GameRepository = new GameRepositoryImpl();
