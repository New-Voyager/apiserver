import {ClubHostMessages} from '@src/entity/clubmessage';
import {Club, ClubMember} from '@src/entity/club';
import {getConnection, getRepository} from 'typeorm';
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
    memberID: number,
    messageType: HostMessageType,
    name: string,
    playerUuid: string,
    playerId: number
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
          member: {id: memberID},
        },
      });
      if (!resp.length) return null;
      const count = await hostMessageRepository.count({
        club: {id: club.id},
        member: {id: memberID},
        messageType: messageType,
        readStatus: false,
      });
      return {
        memberId: memberID,
        playerId: playerUuid,
        memberName: name,
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

  public async hostMessageSummary(club: Club): Promise<any> {
    try {
      const query = `
        SELECT DISTINCT chm.member as "memberId", p.name, p.uuid as "playerUuid", p.id as "playerId" FROM club_host_messages chm
        INNER JOIN club_member cm on cm.id = chm.member
        INNER JOIN player p on cm.player_id = p.id 
        where chm.club = ${club.id} order by chm.member DESC`;
      const members = await getConnection().query(query);

      const summary = new Array<any>();
      for await (const member of members) {
        const resp = await this.hostMessageSummaryWithMemberId(
          club,
          member.memberId,
          HostMessageType.TO_HOST,
          member.name,
          member.playerUuid,
          member.playerId
        );
        if (resp) summary.push(resp);
      }
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
          id: 'ASC',
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
          memberId: clubMember.id,
          playerId: clubMember.player.uuid,
          memberName: clubMember.player.name,
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
