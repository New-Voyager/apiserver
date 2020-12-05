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

export async function getGameCodeForClub(
  clubCode: string,
  clubId: number
): Promise<string> {
  const hashIds = new Hashids(
    clubCode,
    6,
    '0123456789ABCDEFGHIJKLMNOPQRSTWXYZ'
  );
  // let us get the count of total clubs
  const gameCount = await GameRepository.getGameCountByClubId(clubId);
  let gameCode = hashIds.encode(clubId, gameCount);
  gameCode = 'O4GYF9';
  return gameCode;
}

// This method is used for players hosting games (not club games)
export async function getGameCodeForPlayer(playerId: number): Promise<string> {
  const hashIds = new Hashids(
    '000000',
    6,
    '0123456789ABCDEFGHIJKLMNOPQRSTWXYZ'
  );
  // let us get the count of total clubs
  const gameCount = await GameRepository.getGameCountByPlayerId(playerId);
  const gameCode = hashIds.encode(playerId, gameCount);
  return gameCode;
}
