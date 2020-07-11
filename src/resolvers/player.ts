import * as _ from 'lodash';
import {PlayerRepository} from '@src/repositories/player';
import {ClubRepository} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';

async function getClubs(playerId: string): Promise<Array<any>> {
  const clubMembers = await ClubRepository.getPlayerClubs(playerId);
  if (!clubMembers) {
    return [];
  }
  const clubs = _.map(clubMembers, x => {
    return {
      name: x.name,
      private: true,
      imageId: '',
      clubId: x.clubid,
      memberCount: x.memberCount,
    };
  });
  return clubs;
}

const resolvers: any = {
  Query: {
    myClubs: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      return getClubs(ctx.req.playerId);
    },
    allPlayers: async (parent, args, ctx, info) => {
      //if (!ctx.req.playerId) {
      //  throw new Error('Unauthorized');
      //}
      const players = await PlayerRepository.getPlayers();
      return _.map(players, x => {
        return {
          playerId: x.uuid,
          name: x.name,
          lastActiveTime: x.updatedAt,
        };
      });
    },
    playerById: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      const player = await PlayerRepository.getPlayerById(ctx.req.playerId);
      if (!player) {
        throw new Error('Player not found');
      }
      return {
        uuid: player.uuid,
        id: player.id,
        name: player.name,
        lastActiveTime: player.updatedAt,
      };
    },
  },
  Mutation: {
    createPlayer: async (parent, args, ctx, info) => {
      const errors = new Array<string>();
      if (!args.player) {
        errors.push('player object not found');
      }
      if (args.player.name === '') {
        errors.push('name is a required field');
      }
      if (args.player.deviceId === '') {
        errors.push('deviceId is a required field');
      }
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      try {
        const playerInput = args.player;
        return PlayerRepository.createPlayer(
          playerInput.name,
          playerInput.deviceId
        );
      } catch (err) {
        console.log(err);
        throw new Error('Failed to register Player');
      }
    },
    leaveClub: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      const isClubMember = await ClubRepository.isClubMember(
        args.clubId,
        ctx.req.playerId
      );
      if (!isClubMember) {
        // nothing to do
        return ClubMemberStatus[ClubMemberStatus.LEFT];
      }
      await ClubRepository.leaveClub(args.clubId, ctx.req.playerId);
      return ClubMemberStatus[ClubMemberStatus.LEFT];
    },
  },
  Player: {
    clubs: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      return getClubs(parent.playerId);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
