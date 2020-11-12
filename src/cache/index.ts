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

export async function isClubMember(
  playerUUid: string,
  clubCode: string
): Promise<boolean> {
  // get from cache

  const clubMemberRepository = getRepository<ClubMember>(ClubMember);
  // see whehter the player is already a member
  const clubMember = await clubMemberRepository.findOne({
    where: {
      club: {clubCode: clubCode},
      player: {uuid: playerUUid},
    },
  });

  // cache the result

  if (!clubMember) {
    return true;
  }
  return false;
}
