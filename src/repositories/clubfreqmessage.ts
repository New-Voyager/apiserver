import {Club} from '@src/entity/club';
import {getRepository} from 'typeorm';
import {Player} from '@src/entity/player';
import {FavouriteMessage} from '@src/entity/clubfreqmessage';
const MAX_ALLOWED_MESSAGES = 20;
export interface FavouriteMessageInputFormat {
  clubCode: string;
  playerId: string;
  text: string;
  audioLink: string;
  imageLink: string;
}
import {getLogger} from '@src/utils/log';
const logger = getLogger('clubfreqmessage');

class ClubFreqMessageRepositoryImpl {
  public async saveFreqMessage(message: FavouriteMessageInputFormat) {
    if (
      (message.playerId === '' || message.playerId === undefined) &&
      message.clubCode !== '' &&
      message.clubCode !== undefined
    ) {
      return this.saveClubMessage(message);
    } else if (
      (message.clubCode === '' || message.clubCode === undefined) &&
      message.playerId !== '' &&
      message.playerId !== undefined
    ) {
      return this.savePlayerMessage(message);
    } else {
      throw new Error(
        'Invalid parameters. Either clubCode or playerId must be specified'
      );
    }
  }

  public async saveClubMessage(message: FavouriteMessageInputFormat) {
    try {
      const clubRepository = getRepository(Club);
      const club = await clubRepository.findOne({
        where: {clubCode: message.clubCode},
      });
      if (!club) {
        throw new Error(`Club ${message.clubCode} is not found`);
      } else {
        const findOptions: any = {
          where: {
            clubCode: message.clubCode,
          },
          order: {id: 'ASC'},
        };
        const clubFreqMessageRepository = getRepository(FavouriteMessage);
        const clubFreqMessages = await clubFreqMessageRepository.find(
          findOptions
        );
        if (clubFreqMessages.length >= MAX_ALLOWED_MESSAGES) {
          clubFreqMessageRepository.delete(clubFreqMessages[0].id);
          return this.saveMessage(message, 0);
        }
        return this.saveMessage(message, 0);
      }
    } catch (e) {
      throw e;
    }
  }

  public async savePlayerMessage(message: FavouriteMessageInputFormat) {
    try {
      const playerRepository = getRepository<Player>(Player);
      const player = playerRepository.findOne({
        where: {uuid: message.playerId},
      });
      if (!player) {
        throw new Error(`Club ${message.playerId} is not found`);
      } else {
        const findOptions: any = {
          where: {
            playerId: message.playerId,
          },
          order: {id: 'ASC'},
        };
        const clubFreqMessageRepository = getRepository(FavouriteMessage);
        const clubFreqMessages = await clubFreqMessageRepository.find(
          findOptions
        );
        if (clubFreqMessages.length >= MAX_ALLOWED_MESSAGES) {
          clubFreqMessageRepository.delete(clubFreqMessages[0].id);
          return this.saveMessage(message, 1);
        }
        return this.saveMessage(message, 1);
      }
    } catch (e) {
      throw e;
    }
  }

  public async saveMessage(message: FavouriteMessageInputFormat, flag: number) {
    if (flag === 0) message.playerId === '';
    else message.clubCode === '';
    const saveMessage = new FavouriteMessage();
    saveMessage.text = message.text;
    saveMessage.clubCode = message.clubCode;
    saveMessage.audioLink = message.audioLink;
    saveMessage.imageLink = message.imageLink;
    saveMessage.playerId = message.playerId;
    const repository = getRepository(FavouriteMessage);
    const response = await repository.save(saveMessage);
    return response.id;
  }

  public async clubFavoriteMessage(clubCode: string): Promise<Array<any>> {
    try {
      const clubRepository = getRepository(Club);
      const club = await clubRepository.findOne({where: {clubCode: clubCode}});
      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      } else {
        const findOptions: any = {
          where: {
            clubCode: clubCode,
          },
          take: MAX_ALLOWED_MESSAGES,
        };
        const clubFreqMessageRepository = getRepository(FavouriteMessage);
        const clubFreqMessages = await clubFreqMessageRepository.find(
          findOptions
        );
        return clubFreqMessages;
      }
    } catch (e) {
      throw e;
    }
  }

  public async playerFavoriteMessage(playerId: string): Promise<Array<any>> {
    try {
      const playerRepository = getRepository<Player>(Player);
      const player = playerRepository.findOne({
        where: {uuid: playerId},
      });
      if (!player) {
        throw new Error(`Player ${playerId} is not found`);
      } else {
        const findOptions: any = {
          where: {
            playerId: playerId,
          },
          take: MAX_ALLOWED_MESSAGES,
        };
        const clubFreqMessageRepository = getRepository(FavouriteMessage);
        const clubFreqMessages = await clubFreqMessageRepository.find(
          findOptions
        );
        return clubFreqMessages;
      }
    } catch (e) {
      throw e;
    }
  }
}

export const ClubFreqMessageRepository = new ClubFreqMessageRepositoryImpl();
