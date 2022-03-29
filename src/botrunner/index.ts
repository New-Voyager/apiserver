import {getLogger} from '@src/utils/log';
import axios from 'axios';
const logger = getLogger('botrunner');

export function getBotRunnerUrl(): string {
  if (process.env.DEBUG_WITH_STACK && process.env.DEBUG_WITH_STACK === '1') {
    return 'http://localhost:8081';
  }

  if (process.env.BOTRUNNER_URL) {
    return process.env.BOTRUNNER_URL;
  } else {
    return 'http://localhost:8081';
  }
}

export async function fillSeats(
  clubCode: string,
  gameId: number,
  gameCode: string,
  demoGame = false
) {
  const url = `${getBotRunnerUrl()}/join-human-game?club-code=${clubCode}&game-id=${gameId}&game-code=${gameCode}&demo-game=${demoGame}`;
  const resp = await axios.post(url);
  if (resp.status !== 200) {
    logger.error(
      `Failed to load bot players. clubCode: ${clubCode}, gameCode: ${gameCode}`
    );
    throw new Error(
      `Failed to load bot players. clubCode: ${clubCode}, gameCode: ${gameCode}`
    );
  }
}
