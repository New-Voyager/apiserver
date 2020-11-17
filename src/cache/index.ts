import {Club, ClubMember} from '@src/entity/club';
import {PokerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {getRepository} from 'typeorm';

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

export async function getClub(clubCode: string): Promise<Club> {
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
  /*
  const clubMemberRepository = getRepository(ClubMember);
  // see whether the player is already a member
  const members = await clubMemberRepository.find({
    relations: ['player', 'club'],
    where: {
      club: {clubCode: clubCode},
      player: {uuid: playerUUid},
    },
  });

  if (members.length === 0) {
    return undefined;
  }

  // cache the result
  return members[0];
  */
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
