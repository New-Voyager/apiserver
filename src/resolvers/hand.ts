import {HandRepository} from '@src/repositories/hand';
import {WonAtStatus, GameType} from '@src/entity/hand';
import {ClubRepository} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';
import {PlayerRepository} from '@src/repositories/player';

const resolvers: any = {
  Query: {
    lastHandHistory: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }

      const clubMembers1 = await ClubRepository.getMembers(args.clubId);
      const clubMember = await ClubRepository.isClubMember(
        args.clubId,
        ctx.req.playerId
      );

      const player = await PlayerRepository.getPlayerById(ctx.req.playerId);
      if (!player) {
        throw new Error(`Player ${ctx.req.playerId} is not found`);
      }

      if (!clubMember) {
        console.log(
          `The user ${ctx.req.playerId} is not a member of ${
            args.clubId
          }, ${JSON.stringify(clubMembers1)}`
        );
        throw new Error('Unauthorized');
      }

      if (clubMember.status == ClubMemberStatus.KICKEDOUT) {
        console.log(
          `The user ${ctx.req.playerId} is kicked out of ${args.clubId}`
        );
        throw new Error('Unauthorized');
      }

      const handHistory = await HandRepository.getLastHandHistory(
        args.clubId,
        args.gameNum
      );
      let hand: any;
      if (handHistory) {
        hand = {
          clubId: handHistory.clubId,
          data: handHistory.data,
          gameNum: handHistory.gameNum,
          gameType: GameType[handHistory.gameType],
          handNum: handHistory.handNum,
          loWinningCards: handHistory.loWinningCards,
          loWinningRank: handHistory.loWinningRank,
          showDown: handHistory.showDown,
          timeEnded: handHistory.timeEnded,
          timeStarted: handHistory.timeStarted,
          totalPot: handHistory.totalPot,
          winningCards: handHistory.winningCards,
          winningRank: handHistory.winningRank,
          wonAt: WonAtStatus[handHistory.wonAt],
        };
      } else {
        throw new Error('No hand found');
      }
      return hand;
    },
    specificHandHistory: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }

      const player = await PlayerRepository.getPlayerById(ctx.req.playerId);
      if (!player) {
        throw new Error(`Player ${ctx.req.playerId} is not found`);
      }

      const clubMembers1 = await ClubRepository.getMembers(args.clubId);
      const clubMember = await ClubRepository.isClubMember(
        args.clubId,
        ctx.req.playerId
      );

      if (!clubMember) {
        console.log(
          `The user ${ctx.req.playerId} is not a member of ${
            args.clubId
          }, ${JSON.stringify(clubMembers1)}`
        );
        throw new Error('Unauthorized');
      }

      if (clubMember.status == ClubMemberStatus.KICKEDOUT) {
        console.log(
          `The user ${ctx.req.playerId} is kicked out of ${args.clubId}`
        );
        throw new Error('Unauthorized');
      }

      const handHistory = await HandRepository.getSpecificHandHistory(
        args.clubId,
        args.gameNum,
        args.handNum
      );
      let hand: any;
      if (handHistory) {
        hand = {
          clubId: handHistory.clubId,
          data: handHistory.data,
          gameNum: handHistory.gameNum,
          gameType: GameType[handHistory.gameType],
          handNum: handHistory.handNum,
          loWinningCards: handHistory.loWinningCards,
          loWinningRank: handHistory.loWinningRank,
          showDown: handHistory.showDown,
          timeEnded: handHistory.timeEnded,
          timeStarted: handHistory.timeStarted,
          totalPot: handHistory.totalPot,
          winningCards: handHistory.winningCards,
          winningRank: handHistory.winningRank,
          wonAt: WonAtStatus[handHistory.wonAt],
        };
      } else {
        throw new Error('No hand found');
      }
      return hand;
    },
    allHandHistory: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }

      const player = await PlayerRepository.getPlayerById(ctx.req.playerId);
      if (!player) {
        throw new Error(`Player ${ctx.req.playerId} is not found`);
      }

      const clubMembers1 = await ClubRepository.getMembers(args.clubId);
      const clubMember = await ClubRepository.isClubMember(
        args.clubId,
        ctx.req.playerId
      );

      if (!clubMember) {
        console.log(
          `The user ${ctx.req.playerId} is not a member of ${
            args.clubId
          }, ${JSON.stringify(clubMembers1)}`
        );
        throw new Error('Unauthorized');
      }

      if (clubMember.status == ClubMemberStatus.KICKEDOUT) {
        console.log(
          `The user ${ctx.req.playerId} is kicked out of ${args.clubId}`
        );
        throw new Error('Unauthorized');
      }

      const handHistory = await HandRepository.getAllHandHistory(
        args.clubId,
        args.gameNum,
        args.page
      );
      const hands = new Array<any>();

      for (const hand of handHistory) {
        hands.push({
          pageId: hand.id,
          clubId: hand.clubId,
          data: hand.data,
          gameNum: hand.gameNum,
          gameType: GameType[hand.gameType],
          handNum: hand.handNum,
          loWinningCards: hand.loWinningCards,
          loWinningRank: hand.loWinningRank,
          showDown: hand.showDown,
          timeEnded: hand.timeEnded,
          timeStarted: hand.timeStarted,
          totalPot: hand.totalPot,
          winningCards: hand.winningCards,
          winningRank: hand.winningRank,
          wonAt: WonAtStatus[hand.wonAt],
        });
      }
      return hands;
    },
  },
  Mutation: {},
};

export function getResolvers() {
  return resolvers;
}
