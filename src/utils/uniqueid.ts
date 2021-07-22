import Hashids from 'hashids/cjs';
import {ClubRepository} from '@src/repositories/club';
import {GameRepository} from '@src/repositories/game';
import {shuffle} from 'lodash';

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

export function getRecoveryCode(email: string): string {
  const codeChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const generatedCode = new Array<string>();
  for (let i = 0; i < 6; i++) {
    const charidx = Math.floor(Math.random() * codeChars.length);
    generatedCode.push(codeChars[charidx]);
  }
  const code = generatedCode.join('');
  return code;
}

/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}
