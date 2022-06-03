import {Nats} from '@src/nats';
import {TournamentRepository} from '@src/repositories/tournament';
import {Cache} from '@src/cache/index';
import {TournamentPlayingStatus} from '@src/repositories/tournament';
import {ChipUnit, GameStatus, GameType, TableStatus} from '@src/entity/types';
import {centsToChips} from '@src/utils';

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
    seatBotsInTournament: async (parent, args, ctx, info) => {
      return seatBotsInTournament(ctx.req.playerId, args.tournamentId, 0);
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
): Promise<boolean> {
  await TournamentRepository.joinTournament(playerUuid, tournamentId);
  return true;
}

async function startTournament(
  playerUuid: string,
  tournamentId: number
): Promise<boolean> {
  await TournamentRepository.startTournament(tournamentId);
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

async function seatBotsInTournament(
  playerUuid: string,
  tournamentId: number,
  botCount: number
): Promise<boolean> {
  if (!botCount) {
    botCount = 9;
  }
  await TournamentRepository.seatBotsInTournament(tournamentId, botCount);
  return true;
}

export function getResolvers() {
  return resolvers;
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
  const ret = tournamentTableInfo as any;
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
  ret.handToPlayerChannel = Nats.getPlayerHandChannel(
    tournamentTableInfo.gameCode,
    player.id
  );
  ret.handToPlayerTextChannel = Nats.getPlayerHandTextChannel(
    tournamentTableInfo.gameCode,
    player.id
  );
  ret.gameChatChannel = Nats.getChatChannel(tournamentTableInfo.gameCode);
  ret.clientAliveChannel = Nats.getClientAliveChannel(
    tournamentTableInfo.gameCode
  );

  /*
  hard code some values here for now
  **/
  ret.actionTime = 15;
  ret.maxPlayersInTable = 6;
  ret.title = 'Tournament';
  ret.chipUnit = ChipUnit[ChipUnit.DOLLAR];
  ret.status = GameStatus[GameStatus.ACTIVE];
  ret.tableStatus = TableStatus[TableStatus.GAME_RUNNING];
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
