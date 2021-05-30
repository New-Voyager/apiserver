import {getLogger} from '@src/utils/log';
import {getConnection} from 'typeorm';
import axios from 'axios';
import {GameStatus} from '@src/entity/types';
import {fixQuery} from '@src/utils';
import {BUYIN_TIMEOUT, BREAK_TIMEOUT} from '@src/repositories/types';
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
  const resp = await axios.post(startTimerUrl, {timeout: 3000});
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
  const resp = await axios.post(cancelTimerUrl, {timeout: 3000});
  if (resp.status !== 200) {
    logger.error(`Failed to cancel a timer: ${cancelTimerUrl}`);
    throw new Error(`Failed to cancel a timer: ${cancelTimerUrl}`);
  }
}

export async function restartTimers(req: any, resp: any) {
  // Look into the db and find out what are the active games. PokerGame game_status = 2.
  // Among the active games which players have the buyInExpAt or breakExpAt that is NOT null.
  const query = fixQuery(`
    SELECT pg.id AS game_id,
      pgt.pgt_player_id AS player_id,
      pgt.buyin_exp_at,
      pgt.break_time_exp_at
    FROM player_game_tracker pgt 
    INNER JOIN poker_game pg ON pgt.pgt_game_id = pg.id
    WHERE pg.game_status = ?
    AND (pgt.buyin_exp_at IS NOT NULL OR pgt.break_time_exp_at IS NOT NULL)`);

  const res = await getConnection().query(query, [GameStatus.ACTIVE]);
  for (const data of res) {
    let purpose: string;
    let expireAt: Date;
    if (data['buyin_exp_at']) {
      purpose = BUYIN_TIMEOUT;
      expireAt = data['buyin_exp_at'];
    } else {
      purpose = BREAK_TIMEOUT;
      expireAt = data['break_time_exp_at'];
    }

    let remaining = 5;
    while (remaining > 0) {
      try {
        console.log(
          `Restarting timer (game id: ${data['game_id']}, player id: ${data['player_id']}, purpose: ${purpose}, expire at: ${expireAt})`
        );
        await startTimer(data['game_id'], data['player_id'], purpose, expireAt);
        break;
      } catch (err) {
        remaining--;
        if (remaining === 0) {
          console.log(
            `Failed to restart timer (game id: ${data['game_id']}, player id: ${data['player_id']}, purpose: ${purpose}, expire at: ${expireAt})`
          );
          resp
            .status(500)
            .send(JSON.stringify({status: 'ERROR', error: err.toString()}));
          return;
        }
        await sleep(1000);
      }
    }
  }

  resp.status(200).send(JSON.stringify({status: 'OK'}));
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
