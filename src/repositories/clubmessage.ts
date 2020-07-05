import { ClubMessageInput} from '@src/entity/clubmessage';
import {Club} from '@src/entity/club';
import {
  getRepository,
} from 'typeorm';
import {ClubMessageType} from '../entity/clubmessage'


export interface  ClubMessageInputFormat {
    messageType: ClubMessageType;
    text: string;
    gameNum: number;
    handNum: number
    giphyLink: string;
    playerTags: [number];
}

function isPostgres() {
    if (process.env.DB_USED === 'sqllite') {
      return false;
    }
    return true;
  }


class ClubMessageRepositoryImpl {

    public async sendClubMessage(clubId: string, message: ClubMessageInputFormat) {
        const clubRepository = getRepository(Club);

            //const club = await clubRepository.findOne({where: {displayId: clubId}});
            // if (!club) {
            //   throw 'ClubId not found';
            // }
            //else{
              var sendMessage = new ClubMessageInput();
              sendMessage.text = message.text;
              sendMessage.messageType = Object.keys(ClubMessageType).indexOf(message.messageType.toString());
              sendMessage.gameNum = message.gameNum;
              sendMessage.handNum = message.handNum;
              sendMessage.giphyLink = message.giphyLink;
              sendMessage.playerTags = message.playerTags;
              const repository = getRepository(ClubMessageInput);
              var response  = await repository.save(sendMessage);
              return response.id   
            //}
    }

}

export const ClubMessageRepository = new ClubMessageRepositoryImpl();
