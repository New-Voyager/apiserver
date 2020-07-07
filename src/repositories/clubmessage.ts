import {ClubMessageInput} from '@src/entity/clubmessage';
import {Club} from '@src/entity/club';
import {getRepository} from 'typeorm';
import {ClubMessageType} from '../entity/clubmessage';
import {Player} from '@src/entity/player';

export interface ClubMessageInputFormat {
  messageType: ClubMessageType;
  text: string;
  gameNum: number;
  handNum: number;
  giphyLink: string;
  playerTags: string;
}

class ClubMessageRepositoryImpl {
  public async sendClubMessage(
    clubId: string,
    message: ClubMessageInputFormat
  ) {
    try {
      let invalidPlayer = '';
      const clubRepository = getRepository(Club);
      const club = await clubRepository.findOne({where: {displayId: clubId}});
      const playerArray = message.playerTags.split(',');
      const playerRepository = getRepository<Player>(Player);
      playerArray.forEach(player => {
        const result = playerRepository.findOne({where: {uuid: player}});
        if (!result) {
          invalidPlayer = player;
        }
      });
      if (!club) {
        throw new Error(`Club ${clubId} is not found`);
      } else if (invalidPlayer !== '') {
        throw new Error(`Player ${invalidPlayer} is not found`);
      } else {
        if (
          message.messageType.toString() === 'TEXT' &&
          message.text !== '' &&
          message.text !== undefined
        ) {
          return this.saveMessage(0, clubId, message);
        } else if (
          message.messageType.toString() === 'GIPHY' &&
          message.giphyLink !== '' &&
          message.giphyLink !== undefined
        ) {
          return this.saveMessage(2, clubId, message);
        } else if (
          message.messageType.toString() === 'HAND' &&
          message.handNum !== undefined
        ) {
          return this.saveMessage(1, clubId, message);
        } else {
          throw new Error('Bad parameters');
        }
      }
    } catch (e) {
      throw new Error(e.message);
    }
  }

  public async saveMessage(
    messageType: number,
    clubId: string,
    message: ClubMessageInputFormat
  ) {
    const sendMessage = new ClubMessageInput();
    sendMessage.text = message.text;
    sendMessage.messageType = messageType;
    sendMessage.clubId = clubId;
    5;
    sendMessage.gameNum = message.gameNum;
    sendMessage.handNum = message.handNum;
    sendMessage.giphyLink = message.giphyLink;
    sendMessage.playerTags = message.playerTags;
    const repository = getRepository(ClubMessageInput);
    const response = await repository.save(sendMessage);
    return response.id;
  }

  public async getClubMessage(clubId: string): Promise<Array<any>> {
    try {
      const clubRepository = getRepository(Club);
      const club = await clubRepository.findOne({where: {displayId: clubId}});
      if (!club) {
        throw new Error(`Club ${clubId} is not found`);
      } else {
        const clubMessageRepository = getRepository(ClubMessageInput);
        const clubMessages = await clubMessageRepository.find({
          where: {
            clubId: clubId,
          },
          order: {id: 'DESC'},
          take: 50,
        });
        return clubMessages;
      }
    } catch (e) {
      throw new Error(e.message);
    }
  }
}

export const ClubMessageRepository = new ClubMessageRepositoryImpl();
