import {ClubMessageInput} from '@src/entity/clubmessage';
import {Club} from '@src/entity/club';
import {getRepository, MoreThan, LessThan} from 'typeorm';
import {ClubMessageType} from '../entity/clubmessage';
import {Player} from '@src/entity/player';
import {PageOptions} from '@src/types';
import {FavouriteMessage} from '@src/entity/clubfreqmessage';

export interface FavouriteMessageInputFormat {
  clubId: string;
  playerId: string;
  text: string;
  audioLink: string;
  imageLink: string;
}

class ClubFreqMessageRepositoryImpl {
  public async sendClubMessage(message: FavouriteMessageInputFormat) {
    try {
      const clubRepository = getRepository(Club);
      const club = await clubRepository.findOne({
        where: {displayId: message.clubId},
      });
      const playerRepository = getRepository<Player>(Player);
      const player = playerRepository.findOne({
        where: {uuid: message.playerId},
      });
      if (!player) {
        throw new Error(`Club ${message.playerId} is not found`);
      }
      if (!club) {
        throw new Error(`Club ${message.clubId} is not found`);
      } else {
        const findOptions: any = {
          where: {
            clubId: message.clubId,
            playerId: message.playerId,
          },
          order: {id: 'ASC'},
        };
        const clubFreqMessageRepository = getRepository(FavouriteMessage);
        const clubFreqMessages = await clubFreqMessageRepository.find(
          findOptions
        );
        if (clubFreqMessages.length >= 20) {
          clubFreqMessageRepository.delete(clubFreqMessages[0].id);
          return this.saveMessageFunc(message);
        }
        return this.saveMessageFunc(message);
      }
    } catch (e) {
      throw new Error(e.message);
    }
  }

  public async saveMessageFunc(message: FavouriteMessageInputFormat) {
    const saveMessage = new FavouriteMessage();
    saveMessage.text = message.text;
    saveMessage.clubId = message.clubId;
    saveMessage.audioLink = message.audioLink;
    saveMessage.imageLink = message.imageLink;
    saveMessage.playerId = message.playerId;
    const repository = getRepository(FavouriteMessage);
    const response = await repository.save(saveMessage);
    return response.id;
  }

  public async getClubFreqMessage(
    clubId: string,
    playerId: string
  ): Promise<Array<any>> {
    try {
      const clubRepository = getRepository(Club);
      const club = await clubRepository.findOne({where: {displayId: clubId}});
      if (!club) {
        throw new Error(`Club ${clubId} is not found`);
      } else {
        const findOptions: any = {
          where: {
            clubId: clubId,
            playerId: playerId,
          },
          take: 20,
        };
        const clubFreqMessageRepository = getRepository(FavouriteMessage);
        const clubFreqMessages = await clubFreqMessageRepository.find(
          findOptions
        );
        return clubFreqMessages;
      }
    } catch (e) {
      throw new Error(e.message);
    }
  }
}

export const ClubFreqMessageRepository = new ClubFreqMessageRepositoryImpl();
