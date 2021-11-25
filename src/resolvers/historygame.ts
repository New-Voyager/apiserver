import {getLogger, errToStr} from '@src/utils/log';
import {default as _} from 'lodash';
import {getSessionTimeStr} from './util';
import {Cache} from '@src/cache/index';
import {GameStatus} from '@src/entity/types';
import {HistoryRepository} from '@src/repositories/history';
import {GameRepository} from '@src/repositories/game';
import {Player} from '@src/entity/player/player';
import {centsToChips} from '@src/utils';

const logger = getLogger('resolvers::history_game');

const resolvers: any = {
  Query: {
    gameResultTable: async (parent, args, ctx, info) => {
      return await getGameResultTable(args.gameCode);
    },
    downloadResult: async (parent, args, ctx, info) => {
      return await downloadResult(ctx.req.playerId, args.gameCode);
    },
  },
};

export async function getGameResultTable(gameCode: string) {
  try {
    logger.info(`[${gameCode}] Retrieving results`);
    const game = await Cache.getGame(gameCode);
    let resp: Array<any> = [];
    if (!game || game.status === GameStatus.ENDED) {
      resp = await HistoryRepository.getGameResultTable(gameCode);
    } else {
      resp = await GameRepository.getGameResultTable(gameCode);
    }

    for (const r of resp) {
      let sessionTime = r.sessionTime;
      if (!sessionTime) {
        sessionTime = 0;
      }
      if (r.satAt) {
        const currentSessionTime = Math.round(
          (new Date().getTime() - r.satAt.getTime()) / 1000
        );
        // in seconds
        sessionTime = sessionTime + currentSessionTime;
      }
      r.sessionTime = sessionTime;
      r.sessionTimeStr = getSessionTimeStr(r.sessionTime);
    }

    const converted = resultTableToClientUnits(resp);
    return converted;
  } catch (err) {
    logger.error(
      `Error in getting game result table. gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(`Failed to get game result table. ${JSON.stringify(err)}`);
  }
}

function resultTableToClientUnits(input: any): any {
  const resultTable: Array<any> = [];
  for (const r of input) {
    const t = {...r};
    t.buyIn = centsToChips(t.buyIn);
    t.profit = centsToChips(t.profit);
    t.stack = centsToChips(t.stack);
    t.rakePaid = centsToChips(t.rakePaid);
    resultTable.push(t);
  }
  return resultTable;
}

export async function downloadResult(playerId: string, gameCode: string) {
  try {
    const player = await Cache.getPlayer(playerId);
    const game = await HistoryRepository.getCompletedGame(gameCode, player.id);
    logger.info(
      `[${game.gameCode}:${game.gameId}] [${player.uuid}] Downloading results`
    );
    let includeTips = false;
    if (game.clubCode) {
      const club = await Cache.getClub(game.clubCode);
      const owner: Player | undefined = await Promise.resolve(club.owner);
      if (owner) {
        if (owner.uuid === playerId) {
          includeTips = true;
        }
      }
    }
    const resp = await HistoryRepository.getGameResultTable(gameCode);
    const headers: Array<string> = ['name', 'id', 'hands', 'buyin', 'profit'];
    if (includeTips) {
      headers.push('tips');
    }
    const csvRows = new Array<string>();
    csvRows.push(headers.join(','));
    for (const row of resp) {
      const fields = new Array<string>();
      fields.push(row.playerName);
      fields.push(row.playerId);
      fields.push(row.handsPlayed);
      fields.push(row.buyIn);
      fields.push(row.profit);
      if (includeTips) {
        fields.push(row.rakePaid);
      }
      csvRows.push(fields.join(','));
    }
    const output = csvRows.join('\n');
    logger.info(
      `[${game.gameCode}:${game.gameId}] [${player.uuid}] Downloading results successful`
    );
    return output;
  } catch (err) {
    logger.error(
      `[${gameCode}] [${playerId}] Error while downloading result. ${errToStr(
        err
      )}`
    );
    throw new Error(`Failed to get game result table. ${JSON.stringify(err)}`);
  }
}

export function getResolvers() {
  return resolvers;
}
