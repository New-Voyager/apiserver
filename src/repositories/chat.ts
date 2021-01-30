import {ChatText} from '@src/entity/chat';
import {Club} from '@src/entity/club';
import {Player} from '@src/entity/player';
import {ChatTextType} from '@src/entity/types';
import {getRepository} from 'typeorm';
import * as _ from 'lodash';

class ChatTextRepositoryImpl {
  public async addClubChatText(text: string, club: Club): Promise<boolean> {
    const repo = getRepository(ChatText);
    // if the text exists don't add it
    const existing = await repo.find({
      text: text,
      club: {id: club.id},
      type: ChatTextType.CLUB,
    });

    if (existing.length > 0) {
      return true;
    }

    await repo
      .createQueryBuilder()
      .insert()
      .values({
        text: text,
        club: {id: club.id},
        type: ChatTextType.CLUB,
      })
      .execute();
    return true;
  }

  public async removeClubChatText(text: string, club: Club): Promise<boolean> {
    const repo = getRepository(ChatText);
    await repo
      .createQueryBuilder()
      .delete()
      .where({
        text: text,
        club: {id: club.id},
        type: ChatTextType.CLUB,
      })
      .execute();
    return true;
  }

  public async addPlayerChatText(
    text: string,
    player: Player
  ): Promise<boolean> {
    const repo = getRepository(ChatText);

    // if the text exists don't add it
    const existing = await repo.find({
      text: text,
      player: {id: player.id},
      type: ChatTextType.PLAYER,
    });

    if (existing.length > 0) {
      return true;
    }
    await repo
      .createQueryBuilder()
      .insert()
      .values({
        text: text,
        player: {id: player.id},
        type: ChatTextType.PLAYER,
      })
      .execute();
    return true;
  }

  public async removePlayerChatText(
    text: string,
    player: Player
  ): Promise<boolean> {
    const repo = getRepository(ChatText);
    await repo
      .createQueryBuilder()
      .delete()
      .where({
        text: text,
        player: {id: player.id},
        type: ChatTextType.PLAYER,
      })
      .execute();
    return true;
  }

  public async addSystemChatText(text: string): Promise<boolean> {
    const repo = getRepository(ChatText);
    // if the text exists don't add it
    const existing = await repo.find({
      text: text,
      type: ChatTextType.SYSTEM,
    });
    if (existing.length > 0) {
      return true;
    }
    await repo
      .createQueryBuilder()
      .insert()
      .values({
        text: text,
        type: ChatTextType.SYSTEM,
      })
      .execute();
    return true;
  }

  public async getChatTexts(player: Player, club?: Club): Promise<string[]> {
    // get system texts
    let texts = new Array<string>();
    const repo = getRepository(ChatText);
    const systemTexts = await repo.find({type: ChatTextType.SYSTEM});
    texts.push(...systemTexts.map(x => x.text));

    // get club texts
    if (club) {
      const clubTexts = await repo.find({
        type: ChatTextType.CLUB,
        club: {id: club.id},
      });
      texts.push(...clubTexts.map(x => x.text));
    }

    // get player texts
    const playerTexts = await repo.find({
      type: ChatTextType.PLAYER,
      player: {id: player.id},
    });
    texts.push(...playerTexts.map(x => x.text));
    texts = _.uniq(texts).sort();
    return texts;
  }
}

export const ChatTextRepository = new ChatTextRepositoryImpl();
