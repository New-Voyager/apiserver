import {errToStr, getLogger} from '@src/utils/log';
import axios from 'axios';
import {GameStatus} from '@src/entity/types';
import {fixQuery} from '@src/utils';
import {
  BUYIN_TIMEOUT,
  BREAK_TIMEOUT,
  GAME_COIN_CONSUME_TIME,
} from '@src/repositories/types';
import {notifyGameServer} from '@src/gameserver';
import {getGameConnection} from '@src/repositories';
import {GameRepository} from '@src/repositories/game';
import {GameUpdatesRepository} from '@src/repositories/gameupdates';

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

  if (!notifyGameServer) {
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
  if (!notifyGameServer) {
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

export async function startTimerWithPayload(payload: any, expAt: Date) {
  if (process.env.NOTIFY_GAME_SERVER !== '1') {
    return;
  }

  if (!notifyGameServer) {
    return;
  }

  // time in seconds
  const expSeconds = Math.round(expAt.getTime() / 1000);
  const timerUrl = getTimerUrl();
  const payloadData = {
    payload: JSON.stringify(payload),
  };
  const startTimerUrl = `${timerUrl}/start-timer?timeout-at=${expSeconds}`;
  const resp = await axios.post(startTimerUrl, payloadData, {timeout: 3000});
  if (resp.status !== 200) {
    logger.error(`Failed to start a timer: ${startTimerUrl}`);
    throw new Error(`Failed to start a timer: ${startTimerUrl}`);
  }
}

export async function cancelTimerWithPayload(payload: any) {
  if (process.env.NOTIFY_GAME_SERVER !== '1') {
    return;
  }
  if (!notifyGameServer) {
    return;
  }
  const payloadData = {
    payload: JSON.stringify(payload),
  };
  // time in seconds
  const timerUrl = getTimerUrl();
  const cancelTimerUrl = `${timerUrl}/cancel-timer`;
  const resp = await axios.post(cancelTimerUrl, payloadData, {timeout: 3000});
  if (resp.status !== 200) {
    logger.error(`Failed to cancel a timer: ${cancelTimerUrl}`);
    throw new Error(`Failed to cancel a timer: ${cancelTimerUrl}`);
  }
}

async function restartBuyinTimers() {
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

  const res = await getGameConnection().query(query, [GameStatus.ACTIVE]);
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
        logger.info(
          `Restarting timer (game id: ${data['game_id']}, player id: ${data['player_id']}, purpose: ${purpose}, expire at: ${expireAt})`
        );
        await startTimer(data['game_id'], data['player_id'], purpose, expireAt);
        break;
      } catch (err) {
        remaining--;
        if (remaining === 0) {
          logger.error(
            `Failed to restart timer (game id: ${data['game_id']}, player id: ${
              data['player_id']
            }, purpose: ${purpose}, expire at: ${expireAt}): ${errToStr(err)}`
          );
        } else {
          await sleep(1000);
        }
      }
    }
  }
}

async function restartGameConsumeCoinTimers() {
  const games = await GameRepository.getActiveGames();
  for (const game of games) {
    const gameUpdate = await GameUpdatesRepository.get(game.gameCode, true);
    if (gameUpdate.nextCoinConsumeTime) {
      let remaining = 5;
      while (remaining > 0) {
        try {
          logger.info(
            `Restarting game consume timer (game code: ${
              game.gameCode
            }, expire at: ${gameUpdate.nextCoinConsumeTime.toISOString()})`
          );
          await startTimer(
            game.id,
            0,
            GAME_COIN_CONSUME_TIME,
            gameUpdate.nextCoinConsumeTime
          );
          break;
        } catch (err) {
          remaining--;
          if (remaining === 0) {
            logger.error(
              `Failed to restart game consume timer (game code: ${
                game.gameCode
              }, expire at: ${gameUpdate.nextCoinConsumeTime.toISOString()})`
            );
          } else {
            await sleep(1000);
          }
        }
      }
    }
  }
}

export async function restartTimers(req: any, resp: any) {
  await restartBuyinTimers();
  await restartGameConsumeCoinTimers();
  resp.status(200).send(JSON.stringify({status: 'OK'}));
}

export function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
