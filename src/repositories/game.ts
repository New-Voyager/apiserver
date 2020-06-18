import {getRepository} from 'typeorm';
import {PokerGame, GameType} from '@src/entity/game';
import {Club, ClubMember, ClubMemberStatus} from '@src/entity/club';
import {Player} from '@src/entity/player';

class GameRepositoryImpl {
  public async createPrivateGame(
    clubId: string,
    playerId: string,
    input: any,
    template = false
  ): Promise<PokerGame> {
    // first check whether this user can create a game in this club
    const clubMemberRepository = getRepository<ClubMember>(ClubMember);

    const clubRepository = getRepository(Club);
    const club = await clubRepository.findOne({displayId: clubId});
    if (!club) {
      throw new Error(`Club ${clubId} is not found`);
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

    if (
      clubMember.isManager &&
      clubMember.status == ClubMemberStatus.APPROVED
    ) {
      throw new Error(
        `The player ${playerId} is not an approved manager to create a game`
      );
    }

    // create the game
    const game: PokerGame = {...input} as PokerGame;
    const gameTypeStr: string = input['gameType'];
    const gameType: GameType = GameType[gameTypeStr];
    game.gameType = gameType;
    game.isTemplate = template;
    if (club) {
      game.club = club;
    }
    let attempt = 10;
    const gameRespository = getRepository(PokerGame);
    let savedGame;

    // use current time as the game id for now
    while (attempt != 0) {
      attempt--;
      const timeInMS = new Date().getTime();
      game.gameId = `${timeInMS}`;
      game.privateGame = true;
      try {
        savedGame = await gameRespository.save(game);
        break;
      } catch (err) {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("Couldn't create game");
      }
    }

    if (!savedGame) {
      throw new Error('Cannot create game');
    }
    return savedGame;
  }
}

export const GameRepository = new GameRepositoryImpl();
