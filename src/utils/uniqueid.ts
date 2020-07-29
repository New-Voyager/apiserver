import Hashids from 'hashids/cjs';
import {ClubRepository} from '@src/repositories/club';
import {GameRepository} from '@src/repositories/game';

export async function getClubCode(name: string): Promise<string> {
  const hashIds = new Hashids(name, 6, '0123456789ABCDEFGHIJKLMNOPQRSTWXYZ');
  // let us get the count of total clubs
  const clubCount = await ClubRepository.getClubCount();
  const clubId = hashIds.encode(clubCount);
  return clubId;
}

export async function getGameCodeForClub(clubId: number): Promise<string> {
  const hashIds = new Hashids(name, 6, '0123456789ABCDEFGHIJKLMNOPQRSTWXYZ');
  // let us get the count of total clubs
  const gameCount = await GameRepository.getGameCount(clubId);
  const gameCode = hashIds.encode(clubId, gameCount);
  return gameCode;
}

// This method is used for players hosting games (not club games)
export async function getGameCodeForPlayer(playerId: number): Promise<string> {
  const hashIds = new Hashids(name, 6, '0123456789ABCDEFGHIJKLMNOPQRSTWXYZ');
  // let us get the count of total clubs
  const gameCount = await GameRepository.getGameCount(playerId);
  const gameCode = hashIds.encode(playerId, gameCount);
  return gameCode;
}
