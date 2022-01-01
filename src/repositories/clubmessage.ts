import {ClubMessageInput} from '@src/entity/player/clubmessage';
import {Club, ClubMember} from '@src/entity/player/club';
import {MoreThan, LessThan, Not} from 'typeorm';
import {ClubMessageType} from '@src/entity/types';
import {Player} from '@src/entity/player/player';
import {PageOptions} from '@src/types';
import {getLogger} from '@src/utils/log';
import {v4 as uuidv4} from 'uuid';
import {Nats} from '@src/nats';
import {ClubUpdateType} from './types';
import {Cache} from '@src/cache/index';
import {getUserConnection, getUserRepository} from '.';
import {PokerGame} from '@src/entity/game/game';

const logger = getLogger('repositories::clubmessage');

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
    player: Player,
    clubCode: string,
    message: ClubMessageInputFormat
  ) {
    try {
      let invalidPlayer = '';
      const clubRepository = getUserRepository(Club);
      const club = await clubRepository.findOne({where: {clubCode: clubCode}});
      if (message.playerTags) {
        const playerArray = message.playerTags.split(',');
        const playerRepository = getUserRepository<Player>(Player);
        playerArray.forEach(player => {
          const result = playerRepository.findOne({where: {uuid: player}});
          if (!result) {
            invalidPlayer = player;
          }
        });
      }

      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      } else if (invalidPlayer !== '') {
        throw new Error(`Player ${invalidPlayer} is not found`);
      } else {
        if (
          message.messageType.toString() === 'TEXT' &&
          message.text !== '' &&
          message.text !== undefined
        ) {
          return this.saveMessage(0, club, message, player);
        } else if (
          message.messageType.toString() === 'GIPHY' &&
          message.giphyLink !== '' &&
          message.giphyLink !== undefined
        ) {
          return this.saveMessage(2, club, message, player);
        } else if (
          message.messageType.toString() === 'HAND' &&
          message.handNum !== undefined
        ) {
          return this.saveMessage(1, club, message, player);
        } else {
          throw new Error('Bad parameters');
        }
      }
    } catch (e) {
      throw e;
    }
  }

  public async playerJoined(club: Club, player: Player) {
    const sendMessage = new ClubMessageInput();
    const msg: any = {
      name: player.name,
      id: player.id,
      uuid: player.uuid,
    };
    sendMessage.text = JSON.stringify(msg);
    sendMessage.messageType = ClubMessageType.JOIN_CLUB;
    sendMessage.clubCode = club.clubCode;
    sendMessage.player = player;
    const repository = getUserRepository(ClubMessageInput);
    const response = await repository.save(sendMessage);
    const messageId = uuidv4();
    const data = {
      playerName: player.name,
      playerUuid: player.uuid,
    };
    // TODO: send firebase notification
    // we need to send this message to all the club members
    Nats.sendClubUpdate(
      club.clubCode,
      club.name,
      ClubUpdateType[ClubUpdateType.NEW_MEMBER],
      messageId,
      data
    );

    return response.id;
  }

  public async playerKickedout(club: Club, player: Player) {
    const sendMessage = new ClubMessageInput();
    const msg: any = {
      name: player.name,
      id: player.id,
      uuid: player.uuid,
    };
    sendMessage.text = JSON.stringify(msg);
    sendMessage.messageType = ClubMessageType.KICKED_OUT;
    sendMessage.clubCode = club.clubCode;
    sendMessage.player = player;
    const repository = getUserRepository(ClubMessageInput);
    const response = await repository.save(sendMessage);
    const messageId = uuidv4();
    // TODO: send firebase notification
    // we need to send this message to all the club members
    Nats.sendClubUpdate(
      club.clubCode,
      club.name,
      ClubUpdateType[ClubUpdateType.MEMBER_LEFT],
      messageId
    );

    return response.id;
  }

  public async playerLeft(club: Club, player: Player) {
    const sendMessage = new ClubMessageInput();
    const msg: any = {
      name: player.name,
      id: player.id,
      uuid: player.uuid,
    };
    sendMessage.text = JSON.stringify(msg);
    sendMessage.messageType = ClubMessageType.LEAVE_CLUB;
    sendMessage.clubCode = club.clubCode;
    sendMessage.player = player;
    const repository = getUserRepository(ClubMessageInput);
    const response = await repository.save(sendMessage);
    const messageId = uuidv4();
    // TODO: send firebase notification
    // we need to send this message to all the club members
    Nats.sendClubUpdate(
      club.clubCode,
      club.name,
      ClubUpdateType[ClubUpdateType.MEMBER_LEFT],
      messageId
    );

    return response.id;
  }

  public async newGameCreated(club: Club, game: PokerGame, player: Player) {
    const sendMessage = new ClubMessageInput();
    const msg: any = {
      name: player.name,
      gameCode: game.gameCode,
      gameType: game.gameType,
      sb: game.smallBlind,
      bb: game.bigBlind,
    };
    sendMessage.text = JSON.stringify(msg);
    sendMessage.messageType = ClubMessageType.NEW_GAME;
    sendMessage.clubCode = club.clubCode;
    sendMessage.player = player;
    const repository = getUserRepository(ClubMessageInput);
    const response = await repository.save(sendMessage);
    return response.id;
  }

  public async saveMessage(
    messageType: number,
    club: Club,
    message: ClubMessageInputFormat,
    player: Player
  ) {
    const sendMessage = new ClubMessageInput();
    sendMessage.text = message.text;
    sendMessage.messageType = messageType;
    sendMessage.clubCode = club.clubCode;
    sendMessage.gameNum = message.gameNum;
    sendMessage.handNum = message.handNum;
    sendMessage.giphyLink = message.giphyLink;
    sendMessage.playerTags = message.playerTags;
    sendMessage.player = player;
    const repository = getUserRepository(ClubMessageInput);
    const response = await repository.save(sendMessage);

    const messageId = uuidv4();
    // TODO: send firebase notification
    // we need to send this message to all the club members
    Nats.sendClubUpdate(
      club.clubCode,
      club.name,
      ClubUpdateType[ClubUpdateType.CLUB_CHAT],
      messageId
    );

    return response.id;
  }

  public async getClubMessage(
    clubCode: string,
    pageOptions?: PageOptions
  ): Promise<Array<ClubMessageInput>> {
    try {
      const clubRepository = getUserRepository(Club);
      const club = await clubRepository.findOne({where: {clubCode: clubCode}});
      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      } else {
        if (!pageOptions) {
          pageOptions = {
            count: 50,
            prev: 0x7fffffff,
          };
        }

        let order: any = {
          id: 'ASC',
        };

        let pageWhere: any;
        if (pageOptions.next) {
          order = {
            id: 'DESC',
          };
          pageWhere = MoreThan(pageOptions.next);
        } else {
          if (pageOptions.prev) {
            order = {
              id: 'DESC',
            };
            pageWhere = LessThan(pageOptions.prev);
          }
        }

        //logger.info(`pageOptions count: ${pageOptions.count}`);
        let take = pageOptions.count;
        if (!take || take > 50) {
          take = 50;
        }
        const clubRepository = getUserRepository(Club);
        const club = await clubRepository.findOne({
          where: {clubCode: clubCode},
        });
        if (!club) {
          throw new Error(`Club ${clubCode} is not found`);
        }

        const findOptions: any = {
          where: {
            clubCode: clubCode,
          },
          order: order,
          take: take,
        };
        if (pageWhere) {
          findOptions['where']['id'] = pageWhere;
        }
        const clubMessageRepository = getUserRepository(ClubMessageInput);
        const clubMessages = await clubMessageRepository.find(findOptions);
        return clubMessages;
      }
    } catch (e) {
      throw e;
    }
  }

  public async getUnreadMessageCount(
    club: Club,
    player: Player
  ): Promise<number> {
    const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
    if (!clubMember) {
      return 0;
    }
    let date = clubMember.lastMessageRead;
    if (date === null) {
      date = clubMember.joinedDate;
    }
    const query = `SELECT COUNT(DISTINCT("ClubMessageInput"."id")) as "cnt" 
              FROM "club_messages" "ClubMessageInput" 
              WHERE "ClubMessageInput"."club_code" = $1 AND 
              "ClubMessageInput"."player_id" != $2 AND 
              "ClubMessageInput"."message_time" > $3`;

    const result = await getUserConnection().query(query, [
      club.clubCode,
      player.id,
      date,
    ]);
    return result[0]['cnt'];
  }

  public async markMessagesRead(club: Club, player: Player) {
    const clubMemberRepo = getUserRepository(ClubMember);
    const now = new Date();
    await clubMemberRepo.update(
      {
        club: {id: club.id},
        player: {id: player.id},
      },
      {
        lastMessageRead: now.toISOString(),
      }
    );
    return true;
  }
}

export const ClubMessageRepository = new ClubMessageRepositoryImpl();
