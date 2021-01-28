import {ClubHostMessages} from '@src/entity/clubmessage';
import {Club, ClubMember} from '@src/entity/club';
import {getConnection, getRepository} from 'typeorm';
import {HostMessageType} from '../entity/types';
import {getLogger} from '@src/utils/log';
import {ClubRepository} from './club';
import {repeat} from 'lodash';
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
      const count = await hostMessageRepository.count({
        club: {id: club.id},
        member: {id: clubMember.id},
        messageType: messageType,
        readStatus: false,
      });
      return [
        {
          memberID: clubMember.id,
          memberName: clubMember.player.name,
          memberImageId: null,
          newMessageCount: count,
          lastMessageTime: resp[0].messageTime,
          lastMessageText: resp[0].text,
          messageType: HostMessageType[resp[0].messageType],
        },
      ];
    } catch (e) {
      logger.error(JSON.stringify(e));
      throw new Error(e.message);
    }
  }

  public async hostMessageSummaryWithoutMemberId(club: Club): Promise<any> {
    try {
      const query = `
        SELECT DISTINCT member as memberId FROM club_host_messages where club = ${club.id} order by id DESC
      `;
      const members = await getConnection().query(query);
      const summary = new Array<any>();
      for await (const member of members) {
        const clubMember = await ClubRepository.getClubMemberById(
          club,
          member.memberId
        );
        if (!clubMember) {
          logger.error(
            `Member: ${member.memberId} is not a member in club ${club.name}`
          );
          throw new Error(
            `Member: ${member.memberId} is not a member in club ${club.name}`
          );
        }
        const resp = await this.hostMessageSummaryWithMemberId(
          club,
          clubMember,
          HostMessageType.TO_HOST
        );
        summary.push(resp[0]);
      }
      return summary;
    } catch (e) {
      logger.error(JSON.stringify(e));
      throw new Error(e.message);
    }
  }
}

export const HostMessageRepository = new HostMessageRepositoryImpl();
