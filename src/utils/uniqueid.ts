import Hashids from 'hashids/cjs';
import {ClubRepository} from '@src/repositories/club';
import {GameRepository} from '@src/repositories/game';

export async function getClubCode(name: string): Promise<string> {
  const hashIds = new Hashids(name, 6, '0123456789ABCDEFGHIJKLMNOPQRSTWXYZ');
  // let us get the count of total clubs
  const clubCount = await ClubRepository.getClubCount();
  const clubCode = hashIds.encode(clubCount);
  return 'C-' + clubCode;
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
  const gameCode = hashIds.encode(clubId, gameCount);
  //const gameCode = 'NRPZSR';
  return 'CG-' + gameCode;
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
  return 'PG-' + gameCode;
}
