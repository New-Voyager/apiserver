import {TournamentRepository} from '@src/repositories/tournament';

const resolvers: any = {
  Query: {
    getTournamentInfo: async (parent, args, ctx, info) => {
      return getTournamentInfo(ctx.req.playerId, args.tournamentId);
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
