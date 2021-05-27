import {getLogger} from '@src/utils/log';
import axios from 'axios';
const logger = getLogger('timer');

function getTimerUrl(): string {
  if (process.env.TIMER_URL) {
    return process.env.TIMER_URL;
  }
  return 'http://localhost:8082';
}

export async function startTimer(
  gameId: number,
  playerId: number,
  purpose: string,
  expAt: Date
) {
  if (process.env.NOTIFY_GAME_SERVER !== '1') {
    return;
  }

  // time in seconds
  const expSeconds = Math.round(expAt.getTime() / 1000);
  const timerUrl = getTimerUrl();
  const startTimerUrl = `${timerUrl}/start-timer?game-id=${gameId}&player-id=${playerId}&purpose=${purpose}&timeout-at=${expSeconds}`;
  const resp = await axios.post(startTimerUrl);
  if (resp.status !== 200) {
    logger.error(`Failed to start a timer: ${startTimerUrl}`);
    throw new Error(`Failed to start a timer: ${startTimerUrl}`);
  }
}

export async function cancelTimer(
  gameId: number,
  playerId: number,
  purpose: string
) {
  if (process.env.NOTIFY_GAME_SERVER !== '1') {
    return;
  }

  // time in seconds
  const timerUrl = getTimerUrl();
  const cancelTimerUrl = `${timerUrl}/cancel-timer?game-id=${gameId}&player-id=${playerId}&purpose=${purpose}`;
  const resp = await axios.post(cancelTimerUrl);
  if (resp.status !== 200) {
    logger.error(`Failed to cancel a timer: ${cancelTimerUrl}`);
    throw new Error(`Failed to cancel a timer: ${cancelTimerUrl}`);
  }
}
