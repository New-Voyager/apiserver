import {Club, ClubMember} from '@src/entity/club';
import {PokerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {EntityManager, getRepository, Repository} from 'typeorm';

class GameCache {
  private gameCache = new Map<string, PokerGame>();
  private clubCache = new Map<string, Club>();
  private playerCache = new Map<string, Player>();
  private clubMemberCache = new Map<string, ClubMember>();
  private gameIdGameCodeCache = new Map<number, string>();

  public async getGame(
    gameCode: string,
    update = false,
    transactionManager?: EntityManager
  ): Promise<PokerGame> {
    let game = this.gameCache.get(gameCode);
    if (update) {
      game = undefined;
    }
    if (!game) {
      let repo: Repository<PokerGame>;
      if (transactionManager) {
        repo = transactionManager.getRepository(PokerGame);
      } else {
        repo = getRepository(PokerGame);
      }
      game = await repo.findOne({
        where: {gameCode: gameCode},
      });
      if (!game) {
        throw new Error(`Cannot find with game code: ${gameCode}`);
      }
      this.gameCache.set(gameCode, game);
      this.gameIdGameCodeCache.set(game.id, game.gameCode);
    }
    return game;
  }

  public async getClub(clubCode: string, update = false): Promise<Club> {
    let club = this.clubCache.get(clubCode);
    if (update) {
      club = undefined;
    }

    if (!club) {
      club = await getRepository(Club).findOne({
        where: {clubCode: clubCode},
      });
      if (!club) {
        throw new Error(`Cannot find with game code: ${clubCode}`);
      }
      this.clubCache.set(clubCode, club);
    }
    return club;
  }

  public async getPlayer(playerUuid: string, update = false): Promise<Player> {
    let player = this.playerCache.get(playerUuid);
    if (update) {
      player = undefined;
    }

    if (!player) {
      player = await getRepository(Player).findOne({
        where: {uuid: playerUuid},
      });
      if (!player) {
        throw new Error(`Cannot find player: ${playerUuid}`);
      }
      this.playerCache.set(playerUuid, player);
    }
    return player;
  }

  public async getClubMember(
    playerUuid: string,
    clubCode: string,
    update = false
  ): Promise<ClubMember | null> {
    const key = `${clubCode}:${playerUuid}`;
    let clubMember = this.clubMemberCache.get(key);
    if (!clubMember || update) {
      const club = await this.getClub(clubCode);
      const player = await this.getPlayer(playerUuid);
      const clubMembers = await getRepository(ClubMember).find({
        relations: ['player', 'club'],
        where: {
          club: {id: club.id},
          player: {id: player.id},
        },
      });
      if (!clubMembers || clubMembers.length === 0) {
        return null;
      }
      clubMember = clubMembers[0];
      this.clubMemberCache.set(key, clubMember);
    }
    return clubMember;
  }

  public async isClubMember(
    playerUUid: string,
    clubCode: string
  ): Promise<boolean> {
    const clubMember = await this.getClubMember(playerUUid, clubCode);
    if (!clubMember) {
      return false;
    }
    return true;
  }

  public async getGameById(gameID: number): Promise<PokerGame | undefined> {
    const gameCode = this.gameIdGameCodeCache.get(gameID);
    if (!gameCode) {
      const game = await getRepository(PokerGame).findOne({
        where: {id: gameID},
        cache: true,
      });
      if (!game) {
        return game;
      }

      this.gameIdGameCodeCache.set(gameID, game.gameCode);
      this.gameCache.set(game.gameCode, game);
      return game;
    } else {
      return this.gameCache.get(gameCode);
    }
  }

  public removeGame(gameCode: string) {
    const game = this.gameCache.get(gameCode);
    if (game) {
      this.gameCache.delete(gameCode);
      this.gameIdGameCodeCache.delete(game.id);
    }
  }

  public removeClub(clubCode: string) {
    this.clubCache.delete(clubCode);
  }

  public removeClubMember(playerUuid: string, clubCode: string) {
    const key = `${clubCode}:${playerUuid}`;
    this.clubMemberCache.delete(key);
  }

  public reset() {
    this.gameCache = new Map<string, PokerGame>();
    this.clubCache = new Map<string, Club>();
    this.playerCache = new Map<string, Player>();
    this.clubMemberCache = new Map<string, ClubMember>();
    this.gameIdGameCodeCache = new Map<number, string>();
  }
}

export async function getGame(gameCode: string): Promise<PokerGame> {
  const games = await getRepository(PokerGame).find({
    where: {gameCode: gameCode},
    cache: true,
  });
  if (games.length > 1) {
    throw new Error(`More than one game found for code: ${gameCode}`);
  }
  if (games.length === 0) {
    throw new Error(`Cannot find with game code: ${gameCode}`);
  }

  return games[0];
}

/*


export async function getClub(clubCode: string, update = false): Promise<Club> {
  const clubs = await getRepository(Club).find({
    where: {clubCode: clubCode},
    cache: true,
  });
  if (clubs.length > 1) {
    throw new Error(`More than one club found for code: ${clubCode}`);
  }
  return clubs[0];
}

export async function getPlayer(playerUuid: string): Promise<Player> {
  const players = await getRepository(Player).find({
    where: {uuid: playerUuid},
    cache: true,
  });
  if (players.length > 1) {
    throw new Error(`More than one player found for uuid: ${playerUuid}`);
  }
  return players[0];
}

export async function getClubMember(
  playerUUid: string,
  clubCode: string
): Promise<ClubMember | undefined> {
  // get from cache

  const playerRepository = getRepository<Player>(Player);
  const clubRepository = getRepository<Club>(Club);
  const club = await clubRepository.findOne({where: {clubCode: clubCode}});
  const player = await playerRepository.findOne({where: {uuid: playerUUid}});
  if (!club || !player) {
    return undefined;
  }

  const clubMemberRepository = getRepository<ClubMember>(ClubMember);
  const clubMember = await clubMemberRepository.findOne({
    where: {
      club: {id: club.id},
      player: {id: player.id},
    },
  });
  return clubMember;
}

export async function isClubMember(
  playerUUid: string,
  clubCode: string
): Promise<boolean> {
  const clubMember = getClubMember(playerUUid, clubCode);
  if (!clubMember) {
    return false;
  }
  return true;
}

export async function getGameById(
  gameID: number
): Promise<PokerGame | undefined> {
  const game = await getRepository(PokerGame).findOne({
    where: {id: gameID},
    cache: true,
  });
  return game;
}
*/

export const Cache = new GameCache();
