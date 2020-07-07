import {HandHistory} from '@src/entity/hand';
import {getRepository, LessThan, MoreThan} from 'typeorm';
import {PageOptions} from '@src/types';

class HandRepositoryImpl {
  public async getSpecificHandHistory(
    clubId: string,
    gameNum: string,
    handNum: string
  ): Promise<HandHistory | undefined> {
    const handHistoryRepository = getRepository(HandHistory);
    const handHistory = await handHistoryRepository.findOne({
      where: {clubId: clubId, gameNum: gameNum, handNum: handNum},
    });
    return handHistory;
  }

  public async getLastHandHistory(
    clubId: string,
    gameNum: string
  ): Promise<HandHistory | undefined> {
    const handHistoryRepository = getRepository(HandHistory);
    const hands = await handHistoryRepository.find({
      where: {clubId: clubId, gameNum: gameNum},
    });
    const sortedHands = hands.sort((b, a) => {
      return b.handNum < a.handNum ? 1 : b.handNum > a.handNum ? -1 : 0;
    });
    return sortedHands[0];
  }

  public async getAllHandHistory(
    clubId: string,
    gameNum: string,
    pageOptions?: PageOptions
  ): Promise<Array<HandHistory>> {
    if (!pageOptions) {
      pageOptions = {
        count: 10,
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

    console.log(`pageOptions count: ${pageOptions.count}`);
    let take = pageOptions.count;
    if (!take || take > 10) {
      take = 10;
    }

    const findOptions: any = {
      where: {
        clubId: clubId,
        gameNum: gameNum,
      },
      order: order,
      take: take,
    };

    if (pageWhere) {
      findOptions['where']['id'] = pageWhere;
    }
    const handHistoryRepository = getRepository(HandHistory);
    const handHistory = await handHistoryRepository.find(findOptions);
    return handHistory;
  }
}

export const HandRepository = new HandRepositoryImpl();
