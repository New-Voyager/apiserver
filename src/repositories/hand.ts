import {v4 as uuidv4} from 'uuid';
import {HandHistory, HandWinners, WonAtStatus, GameType} from '@src/entity/hand';
import {
  getConnection,
  getRepository,
  getManager,
  Not,
  LessThan,
  MoreThan,
} from 'typeorm';
import {PageOptions} from '@src/types';

function isPostgres() {
    if (process.env.DB_USED === 'sqllite') {
      return false;
    }
    return true;
}

class HandRepositoryImpl {
    public async getSpecificHandHistory(clubId: number, gameNum: number, handNum: number): Promise< HandHistory | undefined> {
        const handHistoryRepository = getRepository(HandHistory);
        const handHistory = await handHistoryRepository.findOne({where: {clubId: clubId, gameNum: gameNum, handNum: handNum}});
        return handHistory;
    }

    public async getLastHandHistory(clubId: number, gameNum: number): Promise< HandHistory | undefined> {
        const handHistoryRepository = getRepository(HandHistory);
        const hands = await handHistoryRepository.find({where: {clubId: clubId, gameNum: gameNum}});
        var sortedHands = hands.sort(function mySort(b, a) {
            return b.handNum < a.handNum ?  1
            : b.handNum > a.handNum ? -1
            : 0;
        });
        return sortedHands[0];
    }

    public async getAllHandHistory(clubId: number, gameNum: number, pageOptions?: PageOptions): Promise< Array<HandHistory> > {
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
                gameNum: gameNum
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