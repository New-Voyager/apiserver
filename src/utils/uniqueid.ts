import Hashids from 'hashids/cjs';
import {ClubRepository} from '@src/repositories/club';
import {GameRepository} from '@src/repositories/game';

export async function getClubCode(name: string): Promise<string> {
  const hashIds = new Hashids(name, 6, 'ABCDEFGHIJKLMNOPQRSTWXYZ');
  // let us get the count of total clubs
  const clubCount = await ClubRepository.getClubCount();
  const currentSeconds = new Date().getSeconds();
  const clubCode = hashIds.encode(clubCount, currentSeconds);
  return 'c' + clubCode.toLowerCase();
}

export async function getGameCodeForClub(
  clubCode: string,
  clubId: number
): Promise<string> {
  const hashIds = new Hashids(clubCode, 6, 'ABCDEFGHIJKLMNOPQRSTWXYZ');
  // let us get the count of total clubs
  const gameCount = await GameRepository.getGameCountByClubId(clubId);
  const currentSec = new Date().getSeconds();
  const gameCode = hashIds.encode(clubId, gameCount, currentSec);
//  return 'test';
  return 'cg' + gameCode.toLowerCase();
}

// This method is used for players hosting games (not club games)
export async function getGameCodeForPlayer(playerId: number): Promise<string> {
  const currentSec = new Date().getSeconds();
  const hashIds = new Hashids(
    currentSec.toString(),
    6,
    'ABCDEFGHIJKLMNOPQRSTWXYZ'
  );
  // let us get the count of total clubs
  const gameCount = await GameRepository.getGameCountByPlayerId(playerId);
  const now = new Date().getTime();
  const gameCode = hashIds.encode(playerId, gameCount, now);
  return 'pg' + gameCode;
}
