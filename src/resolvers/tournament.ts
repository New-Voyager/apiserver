import {Nats} from '@src/nats';
import {TournamentRepository} from '@src/repositories/tournament';
import {Cache} from '@src/cache/index';
import {ChipUnit, GameStatus, GameType, TableStatus} from '@src/entity/types';
import {centsToChips} from '@src/utils';
import {TournamentPlayingStatus} from '@src/repositories/balance';
import {sleep} from '@src/timer';

const resolvers: any = {
  Query: {
    getTournamentInfo: async (parent, args, ctx, info) => {
      return getTournamentInfo(ctx.req.playerId, args.tournamentId);
    },
    getTournamentTableInfo: async (parent, args, ctx, info) => {
      return getTournamentTableInfo(
        ctx.req.playerId,
        args.tournamentId,
        args.tableNo
      );
    },
    getTournamentGameInfo: async (parent, args, ctx, info) => {
      return getTournamentGameInfo(ctx.req.playerId, args.gameCode);
    },
  },

  Mutation: {
    scheduleTournament: async (parent, args, ctx, info) => {
      return scheduleTournament(ctx.req.playerId, args.input);
    },
    registerTournament: async (parent, args, ctx, info) => {
      return registerTournament(
        ctx.req.playerId,
        args.playerUuid,
        args.tournamentId
      );
    },
    unregisterTournament: async (parent, args, ctx, info) => {
      return false;
      //return unregisterTournament(ctx.req.playerId, args.tournamentId);
    },
    startTournament: async (parent, args, ctx, info) => {
      return startTournament(ctx.req.playerId, args.tournamentId);
    },
    joinTournament: async (parent, args, ctx, info) => {
      return joinTournament(ctx.req.playerId, args.tournamentId);
    },
    cancelTournament: async (parent, args, ctx, info) => {
      return cancelTournament(ctx.req.playerId, args.tournamentId);
    },
    kickoffTournament: async (parent, args, ctx, info) => {
      return kickoffTournament(ctx.req.playerId, args.tournamentId);
    },
    triggerAboutToStartTournament: async (parent, args, ctx, info) => {
      return triggerAboutToStartTournament(ctx.req.playerId, args.tournamentId);
    },
  },
};

async function getTournamentInfo(
  playerUuid: string,
  tournamentId: number
): Promise<any> {
  const ret = await TournamentRepository.getTournamentData(tournamentId);
  ret.tournamentChannel =
    TournamentRepository.getTournamentChannel(tournamentId);
  return ret;
}

async function scheduleTournament(
  playerUuid: string,
  input: any
): Promise<number> {
  const ret = await TournamentRepository.scheduleTournament(
    input.name,
    '',
    input.starTime
  );
  return ret;
}

async function joinTournament(
  playerUuid: string,
  tournamentId: number
): Promise<any> {
  await TournamentRepository.joinTournament(playerUuid, tournamentId);
  // get tournament info after I joined
  let retries = 5;
  while (retries > 0) {
    const data = await Cache.getTournamentData(tournamentId);
    if (data) {
      // check for my table
      for (const table of data.tables) {
        for (const player of table.players) {
          if (player.playerUuid === playerUuid) {
            // found the player
            const tournamentTableInfo =
              await TournamentRepository.getTournamentTableInfo(
                tournamentId,
                table.tableNo
              );
            const ret = translateTournamentTableInfo(
              tournamentId,
              table.tableNo,
              tournamentTableInfo
            );
            ret.handToPlayerChannel = Nats.getPlayerHandChannel(
              tournamentTableInfo.gameCode,
              player.playerId
            );
            ret.handToPlayerTextChannel = Nats.getPlayerHandTextChannel(
              tournamentTableInfo.gameCode,
              player.playerId
            );
            ret.playing = true;
            ret.gameID = TournamentRepository.getTableGameId(
              tournamentId,
              table.tableNo
            );
            return ret;
          }
        }
      }
    }
    retries--;
    await sleep(500);
  }
  throw new Error(`Player did not join the tournament`);
}

async function startTournament(
  playerUuid: string,
  tournamentId: number
): Promise<boolean> {
  await TournamentRepository.startTournament(tournamentId);
  return true;
}

async function kickoffTournament(
  playerUuid: string,
  tournamentId: number
): Promise<boolean> {
  await TournamentRepository.kickoffTournament(tournamentId);
  return true;
}

async function triggerAboutToStartTournament(
  playerUuid: string,
  tournamentId: number
): Promise<boolean> {
  await TournamentRepository.triggerAboutToStartTournament(tournamentId);
  return true;
}

async function cancelTournament(
  playerUuid: string,
  tournamentId: number
): Promise<boolean> {
  const ret = false;
  return ret;
}

async function registerTournament(
  reqPlayerUuid: string,
  playerUuid: string,
  tournamentId: number
): Promise<boolean> {
  if (!playerUuid) {
    playerUuid = reqPlayerUuid;
  }

  await TournamentRepository.registerTournament(playerUuid, tournamentId);
  return true;
}

export function getResolvers() {
  return resolvers;
}

function translateTournamentTableInfo(
  tournamentId: number,
  tableNo: number,
  tournamentTableInfo: any
): any {
  const ret = tournamentTableInfo as any;
  ret.tableNo = tableNo;
  ret.tournamentId = tournamentId;
  for (const player of ret.players) {
    player.status = TournamentPlayingStatus[player.status];
    player.stack = centsToChips(player.stack);
  }
  ret.gameType = GameType[ret.gameType];
  ret.gameToPlayerChannel = Nats.getGameChannel(tournamentTableInfo.gameCode);
  ret.playerToHandChannel = Nats.getPlayerToHandChannel(
    tournamentTableInfo.gameCode
  );
  ret.handToAllChannel = Nats.getHandToAllChannel(tournamentTableInfo.gameCode);
  ret.gameChatChannel = Nats.getChatChannel(tournamentTableInfo.gameCode);
  ret.clientAliveChannel = Nats.getClientAliveChannel(
    tournamentTableInfo.gameCode
  );
  ret.tournamentChannel =
    TournamentRepository.getTournamentChannel(tournamentId);

  /*
  hard code some values here for now
  **/
  ret.actionTime = 15;
  ret.maxPlayersInTable = 6;
  ret.title = 'Tournament';
  ret.chipUnit = ChipUnit[ChipUnit.DOLLAR];
  ret.status = GameStatus[GameStatus.ACTIVE];
  ret.tableStatus = TableStatus[TableStatus.GAME_RUNNING];
  return ret;
}

async function getTournamentTableInfo(
  playerUuid: string,
  tournamentId: number,
  tableNo: number
): Promise<any> {
  const player = await Cache.getPlayer(playerUuid);
  const tournamentTableInfo = await TournamentRepository.getTournamentTableInfo(
    tournamentId,
    tableNo
  );
  const ret = translateTournamentTableInfo(
    tournamentId,
    tableNo,
    tournamentTableInfo
  );
  ret.handToPlayerChannel = Nats.getPlayerHandChannel(
    tournamentTableInfo.gameCode,
    player.id
  );
  ret.handToPlayerTextChannel = Nats.getPlayerHandTextChannel(
    tournamentTableInfo.gameCode,
    player.id
  );
  ret.gameID = TournamentRepository.getTableGameId(tournamentId, tableNo);

  return ret;
}

async function getTournamentGameInfo(
  playerUuid: string,
  gameCode: string
): Promise<any> {
  const toks = gameCode.split('-');
  if (toks.length < 3) {
    throw new Error(`Invalid gameCode: ${gameCode}`);
  }
  const tournamentId = parseInt(toks[1]);
  const tableNo = parseInt(toks[2]);
  return getTournamentTableInfo(playerUuid, tournamentId, tableNo);
}
