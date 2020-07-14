import {
  ClubRepository,
  ClubCreateInput,
  ClubUpdateInput,
} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';
import {Player} from '@src/entity/player';
import {PageOptions} from '@src/types';
import * as _ from 'lodash';
import {GameStatus} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
const logger = getLogger('clubresolvers');

async function getClubGames(
  clubId: string,
  pageOptions?: PageOptions
): Promise<Array<any>> {
  const clubGames = await ClubRepository.getClubGames(clubId, pageOptions);
  const ret = _.map(clubGames, x => {
    let endedAt;
    let endedBy;
    if (x.endedAt) {
      endedAt = x.endedAt;
      if (x.endedBy) {
        endedBy = x.endedBy.name;
      }
    }

    return {
      pageId: x.id,
      title: x.title,
      type: x.gameType,
      gameId: x.gameId,
      startedBy: x.startedBy.name,
      startedAt: x.startedAt,
      status: GameStatus[x.status],
      endedAt: endedAt,
      endedBy: endedBy,
    };
  });
  // convert club games to PlayerClubGame
  return ret;
}

const resolvers: any = {
  Query: {
    clubMembers: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      const clubMembers1 = await ClubRepository.getMembers(args.clubId);
      const clubMember = await ClubRepository.isClubMember(
        args.clubId,
        ctx.req.playerId
      );
      if (!clubMember) {
        logger.error(
          `The user ${ctx.req.playerId} is not a member of ${
            args.clubId
          }, ${JSON.stringify(clubMembers1)}`
        );
        throw new Error('Unauthorized');
      }

      if (clubMember.status == ClubMemberStatus.KICKEDOUT) {
        logger.error(
          `The user ${ctx.req.playerId} is kicked out of ${args.clubId}`
        );
        throw new Error('Unauthorized');
      }

      const clubMembers = await ClubRepository.getMembers(args.clubId);
      const members = new Array<any>();
      /*
          type ClubMember {
          name: String!
          joinedDate: String!
          status: ClubMemberStatus!
          lastGamePlayedDate: DateTime
          imageId: String
        }*/
      for (const member of clubMembers) {
        members.push({
          name: member.player.name,
          joinedDate: member.joinedDate,
          status: ClubMemberStatus[member.status],
          lastGamePlayedDate: null,
          imageId: '',
          isOwner: member.isOwner,
          isManager: member.isManager,
          playerId: member.player.uuid,
        });
      }

      return members;
    },

    clubGames: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      const clubMember = await ClubRepository.isClubMember(
        args.clubId,
        ctx.req.playerId
      );
      if (!clubMember) {
        logger.error(
          `The user ${ctx.req.playerId} is not a member of ${args.clubId}`
        );
        throw new Error('Unauthorized');
      }
      logger.debug(`args in clubGames: ${JSON.stringify(args)}`);
      const clubGames = getClubGames(args.clubId, args.page);
      return clubGames;
    },

    clubById: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      logger.debug(JSON.stringify(args));
      const club = await ClubRepository.getClubById(args.clubId);
      if (!club) {
        throw new Error('Club not found');
      }
      return {
        id: club.id,
      };
    },
  },
  Mutation: {
    createClub: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }

      const errors = new Array<string>();
      if (!args.club) {
        errors.push('club object not found');
      }
      if (args.club.name === '') {
        errors.push('name is a required field');
      }
      if (args.club.description === '') {
        errors.push('description is a required field');
      }

      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      try {
        const input = args.club as ClubCreateInput;
        input.ownerUuid = ctx.req.playerId;
        return ClubRepository.createClub(input);
      } catch (err) {
        logger.error(err);
        throw new Error('Failed to create the club');
      }
    },
    updateClub: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }

      const errors = new Array<string>();
      if (!args.club) {
        errors.push('club object not found');
      }
      if (args.club.name && args.club.name === '') {
        errors.push('name is a required field');
      }
      if (args.club.description && args.club.description === '') {
        errors.push('description is a required field');
      }
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      try {
        const club = await ClubRepository.getClub(args.clubId);
        if (!club) {
          throw new Error(`Club ${args.clubId} is not found`);
        }
        const owner: Player | undefined = await Promise.resolve(club.owner);
        if (!owner) {
          throw new Error(`Club ${args.clubId} does not have a owner`);
        }
        if (ctx.req.playerId != owner.uuid) {
          throw new Error(
            `Unauthorized. ${ctx.req.playerId} is not the owner of the club ${args.clubId}`
          );
        }
        const input = args.club as ClubUpdateInput;
        return ClubRepository.updateClub(args.clubId, input);
      } catch (err) {
        logger.error(err);
        throw err;
      }
    },
    joinClub: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }

      const errors = new Array<string>();
      if (args.clubId === '') {
        errors.push('clubId is a required field');
      }
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      // TODO: We need to get owner id from the JWT
      const status = await ClubRepository.joinClub(
        args.clubId,
        ctx.req.playerId
      );
      return ClubMemberStatus[status];
    },

    approveMember: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }

      const errors = new Array<string>();
      if (args.clubId === '') {
        errors.push('clubId is a required field');
      }
      if (args.playerUuid === '') {
        errors.push('playerUuid is a required field');
      }
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      // TODO: We need to get owner id from the JWT
      const ownerId = ctx.req.playerId;
      const status = await ClubRepository.approveMember(
        ownerId,
        args.clubId,
        args.playerUuid
      );
      return ClubMemberStatus[status];
    },
    rejectMember: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }

      const errors = new Array<string>();
      if (args.clubId === '') {
        errors.push('clubId is a required field');
      }
      if (args.playerUuid === '') {
        errors.push('playerUuid is a required field');
      }
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      // TODO: We need to get owner id from the JWT
      const ownerId = ctx.req.playerId;
      const status = await ClubRepository.rejectMember(
        ownerId,
        args.clubId,
        args.playerUuid
      );
      return ClubMemberStatus[status];
    },
    kickMember: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      const errors = new Array<string>();
      if (args.clubId === '') {
        errors.push('clubId is a required field');
      }
      if (args.playerUuid === '') {
        errors.push('playerUuid is a required field');
      }
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      // TODO: We need to get owner id from the JWT
      const ownerId = ctx.req.playerId;
      const status = await ClubRepository.kickMember(
        ownerId,
        args.clubId,
        args.playerUuid
      );
      return ClubMemberStatus[status];
    },
  },
};

export function getResolvers() {
  return resolvers;
}
