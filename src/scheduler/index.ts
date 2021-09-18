import {getLogger} from '@src/utils/log';
import axios from 'axios';
import {notifyGameServer} from '@src/gameserver';

const logger = getLogger('scheduler');

function getSchedulerUrl(): string {
  if (process.env.SCHEDULER_URL) {
    return process.env.SCHEDULER_URL;
  }
  return 'http://localhost:8083';
}

export async function schedulePostProcessing(gameId: number) {
  if (process.env.NOTIFY_GAME_SERVER !== '1') {
    return;
  }

  if (!notifyGameServer) {
    return;
  }

  const baseUrl = getSchedulerUrl();
  const url = `${baseUrl}/schedule-game-post-process?game-id=${gameId}`;
  const resp = await axios.post(url, {timeout: 3000});
  if (resp.status !== 200) {
    logger.error(`Received http status ${resp.status} from ${url}`);
    throw new Error(`Failed to schedule post processing for game ${gameId}`);
  }
}
