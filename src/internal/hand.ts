import {getRepository} from 'typeorm';
import {HandHistory, HandWinners, WonAtStatus, GameType} from '@src/entity/hand';
import {STATUS_CODES} from 'http';

/**
 * Hand Server API class
 */
class HandServerAPIs{
    public async saveHand(req: any, resp: any){
        const registerPayload = req.body;
        
        /**
         * Checking Whether all required data is available
         */
        const errors = new Array<string>();
        try {
            if (!registerPayload.ClubId) {
              errors.push('ClubId is missing');
            }
            if (!registerPayload.GameNum) {
              errors.push('GameNum is missing');
            }
            if (!registerPayload.HandNum) {
              errors.push('HandNum is missing');
            }
            if (!registerPayload.Players || registerPayload.Players.length == 0) {
                errors.push('Players are missing');
            } 
            if (!registerPayload.GameType) {
                errors.push('GameType is missing');
            } else {
                if (
                    registerPayload.GameType != GameType[GameType.HOLDEM] &&
                    registerPayload.GameType != GameType[GameType.OMAHA] &&
                    registerPayload.GameType != GameType[GameType.OMAHA_HILO] &&
                    registerPayload.GameType != GameType[GameType.UNKNOWN]
                ) {
                    errors.push('invalid GameType field');
                }
            }
            if (!registerPayload.StartedAt) {
                errors.push('StartedAt is missing');
            }
            if (!registerPayload.EndedAt) {
                errors.push('EndedAt is missing');
            }
            if (!registerPayload.Result) {
                errors.push('Result is missing');
            }else{
                if (!registerPayload.Result.pot_winners || registerPayload.Result.pot_winners.length == 0) {
                    errors.push('pot_winners is missing');
                }
            }
            if (!registerPayload.Result.won_at) {
                errors.push('won_at is missing');
            }else{
                if (
                    registerPayload.Result.won_at != WonAtStatus[WonAtStatus.FLOP] &&
                    registerPayload.Result.won_at != WonAtStatus[WonAtStatus.PREFLOP] &&
                    registerPayload.Result.won_at != WonAtStatus[WonAtStatus.RIVER] &&
                    registerPayload.Result.won_at != WonAtStatus[WonAtStatus.SHOWDOWN] &&
                    registerPayload.Result.won_at != WonAtStatus[WonAtStatus.TURN]
                ) {
                    errors.push('invalid Won_at field');
                }
            }
            if(!registerPayload.Result.pot_winners){
                errors.push('pot_winners field is missing');
            }
            if (!('showdown' in registerPayload.Result)){
                errors.push('showdown field is missing');
            }else{
                if(registerPayload.Result.showdown){
                    if(!registerPayload.Result.total_pot){
                        errors.push('total_pot field is missing');
                    }
                    if(registerPayload.GameType == GameType[GameType.OMAHA_HILO]){
                        if(!registerPayload.Result.hi_winning_cards){
                            errors.push('hi_winning_cards field is missing');
                        }
                        if(!registerPayload.Result.hi_winning_rank){
                            errors.push('hi_winning_rank field is missing');
                        }
                        if(!registerPayload.Result.lo_winning_cards){
                            errors.push('lo_winning_cards field is missing');
                        }
                        if(!registerPayload.Result.lo_winning_rank){
                            errors.push('lo_winning_rank field is missing');
                        }
                    }else{
                        if(!registerPayload.Result.winning_cards){
                            errors.push('winning_cards field is missing');
                        }
                        if(!registerPayload.Result.rank_num){
                            errors.push('rank_num field is missing');
                        }
                    }
                }else{

                }
            }
        } catch (err) {
            resp.status(500).send('Internal service error');
            return;
        }

        /**
         * If any data is missing throwing errors
         */
        if (errors.length) {
            resp.status(500).send(JSON.stringify(errors));
            return;
        }

        /**
         * Working on the data
         */
        try {
            const handHistoryRepository = getRepository(HandHistory);
            const handWinnersRepository = getRepository(HandWinners);

            let handHistory = new HandHistory();
            const wonAt: string = registerPayload.Result.won_at;
            const gameType: string = registerPayload.GameType;

            /**
             * Assigning values and saving hand history
             */
            handHistory.clubId = registerPayload.ClubId;
            handHistory.gameNum = registerPayload.GameNum;
            handHistory.handNum = registerPayload.HandNum;
            handHistory.gameType = GameType[gameType];
            handHistory.wonAt = WonAtStatus[wonAt];
            handHistory.showDown = registerPayload.Result.showdown;
            if(registerPayload.Result.showdown){
                if(registerPayload.GameType == GameType[GameType.OMAHA_HILO]){
                    handHistory.winningCards = registerPayload.Result.hi_winning_cards.join(", ");
                    handHistory.winningRank = registerPayload.Result.hi_winning_rank;
                    handHistory.loWinningCards = registerPayload.Result.lo_winning_cards.join(", ");
                    handHistory.loWinningRank = registerPayload.Result.lo_winning_rank;
                }else{
                    handHistory.winningCards = registerPayload.Result.winning_cards.join(", ");;
                    handHistory.winningRank = registerPayload.Result.rank_num;
                }
                handHistory.totalPot = registerPayload.Result.total_pot;
            }
            handHistory.timeStarted = registerPayload.StartedAt;
            handHistory.timeEnded = registerPayload.EndedAt;
            handHistory.data = registerPayload;
            await handHistoryRepository.save(handHistory);

            /**
             * Assigning values and saving hand winners
             */
            if(registerPayload.Result.showdown){
                if(registerPayload.GameType == GameType[GameType.OMAHA_HILO]){
                    await registerPayload.Result.pot_winners[0].hi_winners.forEach( async (winner: { winning_cards: Array<string>; rank_num: number; player: number; received: number; }) => {
                        let handWinners = new HandWinners();
                        handWinners.clubId = registerPayload.ClubId;
                        handWinners.gameNum = registerPayload.GameNum;
                        handWinners.handNum = registerPayload.HandNum;
                        handWinners.winningCards = winner.winning_cards.join(", ");
                        handWinners.winningRank = winner.rank_num;
                        handWinners.playerId = winner.player;
                        handWinners.received = winner.received;
                        await handWinnersRepository.save(handWinners);
                    });

                    await registerPayload.Result.pot_winners[0].lo_winners.forEach( async (winner: { winning_cards: Array<string>; rank_num: number; player: number; received: number; }) => {
                        let handWinners = new HandWinners();
                        handWinners.clubId = registerPayload.ClubId;
                        handWinners.gameNum = registerPayload.GameNum;
                        handWinners.handNum = registerPayload.HandNum;
                        handWinners.winningCards = winner.winning_cards.join(", ");
                        handWinners.winningRank = winner.rank_num;
                        handWinners.playerId = winner.player;
                        handWinners.received = winner.received;
                        handWinners.isHigh = false;
                        await handWinnersRepository.save(handWinners);
                    });
                }else{
                    await registerPayload.Result.pot_winners[0].winners.forEach( async (winner: { winning_cards: Array<string>; rank_num: number; player: number; received: number; }) => {
                        let handWinners = new HandWinners();
                        handWinners.clubId = registerPayload.ClubId;
                        handWinners.gameNum = registerPayload.GameNum;
                        handWinners.handNum = registerPayload.HandNum;
                        handWinners.winningCards = winner.winning_cards.join(", ");
                        handWinners.winningRank = winner.rank_num;
                        handWinners.playerId = winner.player;
                        handWinners.received = winner.received;
                        await handWinnersRepository.save(handWinners);
                    });
                }            
            }else{
                await registerPayload.Result.pot_winners[0].winners.forEach( async (winner: { player: number; received: number; }) =>{
                    let handWinners = new HandWinners();
                    handWinners.clubId = registerPayload.ClubId;
                    handWinners.gameNum = registerPayload.GameNum;
                    handWinners.handNum = registerPayload.HandNum;
                    handWinners.playerId = winner.player;
                    handWinners.received = winner.received;
                    await handWinnersRepository.save(handWinners);
                });
            }

            resp.status(200).send(JSON.stringify({status: 'OK'}));
        } catch (err) {
            resp.status(500).send('Internal service error');
            return;
        }
    }
}

export const HandServerAPI = new HandServerAPIs();