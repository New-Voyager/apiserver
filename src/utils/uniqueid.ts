export async function getClubCode(name: string): Promise<string> {
  const clubCode = getCode(5, {includeAlpha: true, includeNumbers: false});
  return 'c' + clubCode.toLowerCase();
}

export async function getInviteCode(): Promise<string> {
  const code = getCode(5, {includeAlpha: true, includeNumbers: false});
  return code.toLowerCase();
}

export async function getGameCodeForClub(): Promise<string> {
  const gameCode = getCode(6, {includeAlpha: true, includeNumbers: false});
  return 'cg' + gameCode.toLowerCase();
}

// This method is used for players hosting games (not club games)
export async function getGameCodeForPlayer(): Promise<string> {
  const gameCode = getCode(6, {includeAlpha: true, includeNumbers: false});
  return 'pg' + gameCode.toLowerCase();
}

export async function getGameCodeForLobby(): Promise<string> {
  const gameCode = getCode(6, {includeAlpha: true, includeNumbers: false});
  return 'lg' + gameCode.toLowerCase();
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

export function getCode(
  length: number,
  {includeAlpha = true, includeNumbers = true}
): string {
  let codeCharsInput = '';
  if (includeAlpha) {
    codeCharsInput = codeCharsInput + 'ABCDEFGHIJKLMNOPQRSTWXYZ';
  }
  if (includeNumbers) {
    codeCharsInput = codeCharsInput + '0123456789';
  }

  const codeChars = codeCharsInput.split('');
  const generatedCode = new Array<string>();
  for (let i = 0; i < length; i++) {
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
