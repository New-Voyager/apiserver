import {ClubHostMessages} from '@src/entity/clubmessage';
import {Club, ClubMember} from '@src/entity/club';
import {getRepository} from 'typeorm';
import {HostMessageType} from '../entity/types';
import {getLogger} from '@src/utils/log';
import {ClubRepository} from './club';
const logger = getLogger('host-message');

class HostMessageRepositoryImpl {
  public async sendHostMessage(
    club: Club,
    clubMember: ClubMember,
    text: string,
    messageType: HostMessageType
  ): Promise<ClubHostMessages> {
    try {
      const hostMessageRepository = getRepository(ClubHostMessages);
      const newMessage = new ClubHostMessages();
      newMessage.club = club;
      newMessage.member = clubMember;
      newMessage.messageType = messageType;
      newMessage.text = text;
      const resp = await hostMessageRepository.save(newMessage);
      return resp;
    } catch (e) {
      logger.error(JSON.stringify(e));
      throw new Error(e.message);
    }
  }

  public async hostMessageSummaryWithMemberId(
    club: Club,
    clubMember: ClubMember
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
      // let query = `SELECT DISTINCT member as memberId FROM club_host_messages where club = ${club.id} order by id`;
      const members = await getRepository(ClubHostMessages)
        .createQueryBuilder()
        .select('member')
        .distinct(true)
        .orderBy('id', 'DESC')
        .where('club.id = :id', {id: club.id})
        .getMany();
      // const members = await getConnection().query(query);
      console.log(members);
      const memberIds = members[0]['memberId'];

      const summary = new Array<any>();
      for await (const memberId of memberIds) {
        const clubMember = await ClubRepository.getClubMemberById(
          club,
          memberId
        );
        if (!clubMember) {
          logger.error(
            `Member: ${memberId} is not a member in club ${club.name}`
          );
          throw new Error(
            `Member: ${memberId} is not a member in club ${club.name}`
          );
        }
        const resp = await this.hostMessageSummaryWithMemberId(
          club,
          clubMember
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
