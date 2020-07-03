import { HandRepository} from '@src/repositories/hand';
  import {WonAtStatus, GameType} from '@src/entity/hand';
  import {PageOptions} from '@src/types';
  import * as _ from 'lodash';

  const resolvers: any = {
    Query: {
        lastHandHistory: async (parent, args, ctx, info) => {
            const handHistory = await HandRepository.getLastHandHistory(args.club_id, args.game_num);
            let hand: any;
            if(handHistory){
                hand = {
                    clubId: handHistory.clubId,
                    data: handHistory.data,
                    gameNum: handHistory.gameNum,
                    gameType: GameType[handHistory.gameType],
                    handNum: handHistory.handNum,
                    loWinningCards: handHistory.loWinningCards,
                    loWinningRank: handHistory.loWinningRank,
                    showDown: handHistory.showDown,
                    timeEnded: handHistory.timeEnded,
                    timeStarted: handHistory.timeStarted,
                    totalPot: handHistory.totalPot,
                    winningCards: handHistory.winningCards,
                    winningRank: handHistory.winningRank,
                    wonAt: WonAtStatus[handHistory.wonAt],
                }
            }
            return hand;
        },
        specificHandHistory: async (parent, args, ctx, info) => {
            const handHistory = await HandRepository.getSpecificHandHistory(args.club_id, args.game_num, args.hand_num);
            let hand: any;
            if(handHistory){
                hand = {
                    clubId: handHistory.clubId,
                    data: handHistory.data,
                    gameNum: handHistory.gameNum,
                    gameType: GameType[handHistory.gameType],
                    handNum: handHistory.handNum,
                    loWinningCards: handHistory.loWinningCards,
                    loWinningRank: handHistory.loWinningRank,
                    showDown: handHistory.showDown,
                    timeEnded: handHistory.timeEnded,
                    timeStarted: handHistory.timeStarted,
                    totalPot: handHistory.totalPot,
                    winningCards: handHistory.winningCards,
                    winningRank: handHistory.winningRank,
                    wonAt: WonAtStatus[handHistory.wonAt],
                }
            }
            return hand;
        },
        allHandHistory: async (parent, args, ctx, info) => {
            const handHistory = await HandRepository.getAllHandHistory(args.club_id, args.game_num, args.page);
            let hands = new Array<any>();

            for (const hand of handHistory) {
                hands.push(
                    {
                        pageId: hand.id,
                        clubId: hand.clubId,
                        data: hand.data,
                        gameNum: hand.gameNum,
                        gameType: GameType[hand.gameType],
                        handNum: hand.handNum,
                        loWinningCards: hand.loWinningCards,
                        loWinningRank: hand.loWinningRank,
                        showDown: hand.showDown,
                        timeEnded: hand.timeEnded,
                        timeStarted: hand.timeStarted,
                        totalPot: hand.totalPot,
                        winningCards: hand.winningCards,
                        winningRank: hand.winningRank,
                        wonAt: WonAtStatus[hand.wonAt],
                    }
                )
            }
            return hands;
        },

    },
    Mutation: {

    }
};

export function getResolvers() {
    return resolvers;
  }