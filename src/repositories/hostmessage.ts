import {ClubHostMessages, ClubMessageInput} from '@src/entity/clubmessage';
import {Club, ClubMember} from '@src/entity/club';
import {getRepository, MoreThan, LessThan} from 'typeorm';
import {ClubMessageType, HostMessageType} from '../entity/types';
import {Player} from '@src/entity/player';
import {PageOptions} from '@src/types';
import {getLogger} from '@src/utils/log';
const logger = getLogger('host-message');

class HostMessageRepositoryImpl {
  public async sendHostMessage(
    clubCode: string,
    clubMemberId: number,
    text: string,
    messageType: HostMessageType
  ): Promise<ClubHostMessages> {
    try {
      const hostMessageRepository = getRepository(ClubHostMessages);
      const newMessage = new ClubHostMessages();
      newMessage.clubCode = clubCode;
      newMessage.memberID = clubMemberId;
      newMessage.messageType = messageType;
      newMessage.text = text;
      const resp = await hostMessageRepository.save(newMessage);
      return resp;
    } catch (e) {
      logger.error(JSON.stringify(e));
      throw new Error(e.message);
    }
  }
}

export const HostMessageRepository = new HostMessageRepositoryImpl();
