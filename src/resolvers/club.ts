import {ClubRepository, ClubCreateInput} from "@src/repositories/club";
import {ClubMemberStatus} from "@src/entity/club";

const resolvers: any = {
    Query: {
      clubMembers: async (parent, args, ctx, info) => {
        if(!ctx.req.playerId) {
          throw new Error(`Unauthorized`);
        }

        // get user id from the JWT
        const ownerId = "";
        const clubMembers = await ClubRepository.getMembers(args.clubId, ownerId);
        const members = new Array<any>();
          /*
          type ClubMember {
          name: String!
          joinedDate: String!
          status: ClubMemberStatus!
          lastGamePlayedDate: DateTime
          imageId: String
        }*/
        for(const member of clubMembers) {
          members.push({
            name: member.player.name,
            joinedDate: member.joinedDate,
            status: ClubMemberStatus[member.status],
            lastGamePlayedDate: null,
            imageId: "",
            isOwner: member.isOwner,
            isManager: member.isManager,
            playerId: member.player.uuid,
          });
        }
        return members;
      }
    },
    Mutation: {
        createClub: async (parent, args, ctx, info) => {
          let errors = new Array<string>();
          if(!args.club) {
            errors.push("club object not found");
          }
          if(args.club.name === "") {
            errors.push("name is a required field");
          }
          if(args.club.description === "") {
            errors.push("deviceId is a required field");
          }
          if(args.club.ownerUuid === "") {
            errors.push("ownerUuid is a required field");
          }          
          if(errors.length > 0) {
            throw new Error(errors.join("\n"));
          }

          try {
            const input = args.club as ClubCreateInput;
            return ClubRepository.createClub(input);
          } catch(err) {
            console.log(err);
            throw new Error("Failed to register Player");
          }
        },
        joinClub: async (parent, args, ctx, info) => {
          if(!ctx.req.playerId) {
            throw new Error(`Unauthorized`);
          }

          let errors = new Array<string>();
          if(args.clubId === "") {
            errors.push("clubId is a required field");
          }
          if(args.playerUuid === "") {
            errors.push("playerUuid is a required field");
          }
          if(errors.length > 0) {
            throw new Error(errors.join("\n"));
          }

          // TODO: We need to get owner id from the JWT
          const ownerId = ctx.req.playerId;
          const status = await ClubRepository.joinClub(ownerId, args.clubId, args.playerUuid);
          return ClubMemberStatus[status];
        },

        approveMember: async (parent, args, ctx, info) => {
          if(!ctx.req.playerId) {
            throw new Error(`Unauthorized`);
          }

          let errors = new Array<string>();
          if(args.clubId === "") {
            errors.push("clubId is a required field");
          }
          if(args.playerUuid === "") {
            errors.push("playerUuid is a required field");
          }
          if(errors.length > 0) {
            throw new Error(errors.join("\n"));
          }

          // TODO: We need to get owner id from the JWT
          const ownerId = ctx.req.playerId;
          const status = await ClubRepository.approveMember(ownerId, args.clubId, args.playerUuid);
          return ClubMemberStatus[status];
        },
        rejectMember: async (parent, args, ctx, info) => {
          if(!ctx.req.playerId) {
            throw new Error(`Unauthorized`);
          }

          let errors = new Array<string>();
          if(args.clubId === "") {
            errors.push("clubId is a required field");
          }
          if(args.playerUuid === "") {
            errors.push("playerUuid is a required field");
          }
          if(errors.length > 0) {
            throw new Error(errors.join("\n"));
          }

          // TODO: We need to get owner id from the JWT
          const ownerId = ctx.req.playerId;
          const status = await ClubRepository.rejectMember(ownerId, args.clubId, args.playerUuid);
          return ClubMemberStatus[status];
        },
        kickMember: async (parent, args, ctx, info) => {
          if(!ctx.req.playerId) {
            throw new Error(`Unauthorized`);
          }          
          let errors = new Array<string>();
          if(args.clubId === "") {
            errors.push("clubId is a required field");
          }
          if(args.playerUuid === "") {
            errors.push("playerUuid is a required field");
          }
          if(errors.length > 0) {
            throw new Error(errors.join("\n"));
          }

          // TODO: We need to get owner id from the JWT
          const ownerId = ctx.req.playerId;
          const status = await ClubRepository.kickMember(ownerId, args.clubId, args.playerUuid);
          return ClubMemberStatus[status];
        }                     
    },
};

export function getResolvers() {
    return resolvers;
}
