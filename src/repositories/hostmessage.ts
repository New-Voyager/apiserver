import {ClubHostMessages} from '@src/entity/clubmessage';
import {Club, ClubMember} from '@src/entity/club';
import {getRepository} from 'typeorm';
import {HostMessageType} from '../entity/types';
import {getLogger} from '@src/utils/log';
const logger = getLogger('host-message');

class HostMessageRepositoryImpl {
  public async sendHostMessage(
    club: Club,
    clubMember: ClubMember,
    text: string,
    messageType: HostMessageType
  ): Promise<any> {
    try {
      const hostMessageRepository = getRepository(ClubHostMessages);
      const newMessage = new ClubHostMessages();
      newMessage.club = club;
      newMessage.member = clubMember;
      newMessage.messageType = messageType;
      newMessage.text = text;
      const resp = await hostMessageRepository.save(newMessage);
      return {
        id: resp.id,
        clubCode: resp.club.clubCode,
        memberID: resp.member.id,
        messageTime: resp.messageTime,
        messageType: HostMessageType[resp.messageType],
        text: resp.text,
      };
    } catch (e) {
      logger.error(JSON.stringify(e));
      throw new Error(e.message);
    }
  }

  public async hostMessageSummaryWithMemberId(
    club: Club,
    clubMember: ClubMember,
    messageType: HostMessageType = HostMessageType.FROM_HOST
  ): Promise<any> {
    try {
      const hostMessageRepository = getRepository(ClubHostMessages);
      const resp = await hostMessageRepository.find({
        order: {
          id: 'DESC',
        },
        take: 1,
        where: {
          club: {id: club.id},
          member: {id: clubMember.id},
        },
      });
      if (!resp.length) return null;
      const count = await hostMessageRepository.count({
        club: {id: club.id},
        member: {id: clubMember.id},
        messageType: messageType,
        readStatus: false,
      });
      return {
        memberID: clubMember.id,
        memberName: clubMember.player.name,
        memberImageId: null,
        newMessageCount: count,
        lastMessageTime: resp[0].messageTime,
        lastMessageText: resp[0].text,
        messageType: HostMessageType[resp[0].messageType],
      };
    } catch (e) {
      logger.error(JSON.stringify(e));
      throw new Error(e.message);
    }
  }

  public async hostMessageSummary(
    club: Club,
    allClubMembers: ClubMember[]
  ): Promise<any> {
    try {
      const summary = new Array<any>();
      for await (const member of allClubMembers) {
        const resp = await this.hostMessageSummaryWithMemberId(
          club,
          member,
          HostMessageType.TO_HOST
        );
        if (resp) summary.push(resp);
      }
      summary.sort((a, b) => (a.lastMessageTime > b.lastMessageTime ? 0 : 1));
      return summary;
    } catch (e) {
      logger.error(JSON.stringify(e));
      throw new Error(e.message);
    }
  }

  public async hostMessages(
    club: Club,
    clubMember: ClubMember,
    first?: number,
    afterId?: number
  ): Promise<any> {
    try {
      const hostMessageRepository = getRepository(ClubHostMessages);
      const resp = await hostMessageRepository.find({
        order: {
          id: 'DESC',
        },
        where: {
          club: {id: club.id},
          member: {id: clubMember.id},
        },
      });

      const messages = new Array<any>();
      for await (const message of resp) {
        messages.push({
          id: message.id,
          clubCode: club.clubCode,
          memberID: clubMember.id,
          messageTime: message.messageTime,
          messageType: HostMessageType[message.messageType],
          text: message.text,
        });
      }

      return messages;
    } catch (e) {
      logger.error(JSON.stringify(e));
      throw new Error(e.message);
    }
  }

  public async markAsRead(
    club: Club,
    clubMember: ClubMember,
    messageType: HostMessageType
  ): Promise<boolean> {
    try {
      const hostMessageRepository = getRepository(ClubHostMessages);
      await hostMessageRepository.update(
        {
          club: {id: club.id},
          member: {id: clubMember.id},
          messageType: messageType,
        },
        {
          readStatus: true,
        }
      );
      return true;
    } catch (e) {
      logger.error(JSON.stringify(e));
      throw new Error(e.message);
    }
  }
}

export const HostMessageRepository = new HostMessageRepositoryImpl();
