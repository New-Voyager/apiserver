import {
    ClubMessageInputFormat, ClubMessageRepository
} from '@src/repositories/clubmessage';

const resolvers: any = {
    Mutation: {
      sendClubMessage: async (parent, args, ctx, info) => {
    
          const errors = new Array<string>();
          if (!args.clubId) {
            errors.push('ClubId not found');
          }
          if (!args.message) {
            errors.push('Message Object not found');
          }
          if (args.message.messageType === '') {
            errors.push('Message Type is a required field');
          }
          if (args.message.gameNum === '') {
            errors.push('Game Number is a required field');
          }
          if (args.message.playerTags.length === 0) {
            errors.push('Player Tags is a required field');
          }
    
          if (errors.length > 0) {
            throw new Error(errors.join('\n'));
          }
    
          try {
            return ClubMessageRepository.sendClubMessage(args.clubid,args.message);
          } catch (err) {
            console.log(err);
            throw new Error('Failed to send the message');
          }
        },
    }
}
  

export function getResolvers() {
    return resolvers;
  }
  