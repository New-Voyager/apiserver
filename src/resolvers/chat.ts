import {ChatTextRepository} from '@src/repositories/chat';
import {Cache} from '@src/cache';

async function getChatTexts(
  playerId: string,
  clubCode: string
): Promise<Array<string>> {
  const player = await Cache.getPlayer(playerId);
  let club;
  if (clubCode) {
    club = await Cache.getClub(clubCode);
  }
  const texts = await ChatTextRepository.getChatTexts(player, club);
  return texts;
}

async function addClubChatText(
  playerId: string,
  clubCode: string,
  text: string
): Promise<boolean> {
  const club = await Cache.getClub(clubCode);
  await ChatTextRepository.addClubChatText(text, club);
  return true;
}

async function removeClubChatText(
  playerId: string,
  clubCode: string,
  text: string
): Promise<boolean> {
  const club = await Cache.getClub(clubCode);
  await ChatTextRepository.removeClubChatText(text, club);
  return true;
}

async function addPlayerChatText(
  playerId: string,
  text: string
): Promise<boolean> {
  const player = await Cache.getPlayer(playerId);
  await ChatTextRepository.addPlayerChatText(text, player);
  return true;
}

async function removePlayerChatText(
  playerId: string,
  text: string
): Promise<boolean> {
  const player = await Cache.getPlayer(playerId);
  await ChatTextRepository.removePlayerChatText(text, player);
  return true;
}

const resolvers: any = {
  Query: {
    chatTexts: async (parent, args, ctx, info) => {
      return getChatTexts(ctx.req.playerId, args.clubCode);
    },
  },
  Mutation: {
    addClubChatText: async (parent, args, ctx, info) => {
      return addClubChatText(ctx.req.playerId, args.clubCode, args.text);
    },
    removeClubChatText: async (parent, args, ctx, info) => {
      return removeClubChatText(ctx.req.playerId, args.clubCode, args.text);
    },
    addPlayerChatText: async (parent, args, ctx, info) => {
      return addPlayerChatText(ctx.req.playerId, args.text);
    },
    removePlayerChatText: async (parent, args, ctx, info) => {
      return removePlayerChatText(ctx.req.playerId, args.text);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
