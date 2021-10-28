import {HandHistory} from '@src/entity/history/hand';
import {getAppSettings, resetAppSettings} from '@src/firebase';
import {AppCoinRepository} from '@src/repositories/appcoin';
import {DevRepository} from '@src/repositories/dev';
import {GameUpdatesRepository} from '@src/repositories/gameupdates';
import {HandRepository} from '@src/repositories/hand';
import {errToLogString, getLogger} from '@src/utils/log';
import * as fs from 'fs';
import {remove, shuffle} from 'lodash';
import * as yaml from 'yaml';
import {GameAPI} from './game';
import {HandServerAPI} from './hand';

const logger = getLogger('internal::bots');

const playerIdName = {
  1: 'yong',
  2: 'brian',
  3: 'tom',
  4: 'jim',
  5: 'rob',
  6: 'john',
  7: 'michael',
  8: 'bill',
  9: 'david',
  10: 'rich',
  11: 'josh',
  12: 'chris',
  13: 'olivia',
  14: 'emma',
  15: 'charlotte',
};

const cardMap: any = {
  1: '2s',
  2: '2h',
  4: '2d',
  8: '2c',
  17: '3s',
  18: '3h',
  20: '3d',
  24: '3c',
  40: '4c',
  33: '4s',
  34: '4h',
  36: '4d',
  50: '5h',
  52: '5d',
  56: '5c',
  49: '5s',
  65: '6s',
  66: '6h',
  68: '6d',
  72: '6c',
  81: '7s',
  82: '7h',
  84: '7d',
  88: '7c',
  97: '8s',
  98: '8h',
  100: '8d',
  104: '8c',
  113: '9s',
  114: '9h',
  116: '9d',
  120: '9c',
  130: 'Th',
  132: 'Td',
  136: 'Tc',
  129: 'Ts',
  152: 'Jc',
  145: 'Js',
  146: 'Jh',
  148: 'Jd',
  161: 'Qs',
  162: 'Qh',
  164: 'Qd',
  168: 'Qc',
  177: 'Ks',
  178: 'Kh',
  180: 'Kd',
  184: 'Kc',
  200: 'Ac',
  193: 'As',
  194: 'Ah',
  196: 'Ad',
};

function getCards(cardsInt: Array<number> | number): Array<string> | string {
  if (typeof cardsInt === 'number') {
    return cardMap[cardsInt as number];
  } else {
    const ret = Array<string>();
    const cards = cardsInt as Array<number>;
    for (const i in cards) {
      ret.push(cardMap[cards[i]]);
    }
    return ret;
  }
}

class Deck {
  private cards: Array<number>;

  constructor() {
    this.cards = [];
    for (const card of Object.keys(cardMap)) {
      this.cards.push(parseInt(card));
    }
    this.cards = shuffle(this.cards);
  }

  public remove(cards: number | Array<number>) {
    if (typeof cards === 'number') {
      const card = cards as number;
      const index = this.cards.indexOf(card);
      if (index > -1) {
        this.cards.splice(index, 1);
      }
    } else {
      const cardsArray = cards as Array<number>;
      for (const card of cardsArray) {
        const index = this.cards.indexOf(card);
        if (index > -1) {
          this.cards.splice(index, 1);
        }
      }
    }
  }

  public popCards(gameType: string): Array<number> {
    let noOfCards = 2;
    if (gameType === 'OMAHA') {
      noOfCards = 4;
    }
    if (gameType === 'PLO') {
      noOfCards = 4;
    }
    if (gameType === 'PLO_HILO') {
      noOfCards = 4;
    }
    if (gameType === 'FIVE_CARD_PLO_HILO') {
      noOfCards = 4;
    }
    if (gameType === 'FIVE_CARD_PLO') {
      noOfCards = 4;
    }

    const cards: Array<number> = [];
    for (let i = 0; i < noOfCards; i++) {
      cards.push(this.cards[0]);
      this.cards.splice(0, 1);
    }

    return cards;
  }
}

function handActionSteps(actionSteps: Array<any>): any {
  const actions = Array<any>();
  for (const action of actionSteps['actions']) {
    const actionType = action['action'];
    const seatNo = action['seatNo'];
    if (actionType === 'SB' || actionType === 'BB') {
      continue;
    }

    let actionStr = '';
    if (actionType === 'CHECK' || actionType === 'FOLD') {
      actionStr = `${seatNo}, ${actionType}`;
    } else {
      actionStr = `${seatNo}, ${actionType}, ${action['amount']}`;
    }
    actions.push({
      action: actionStr,
    });
  }
  return {
    'seat-actions': actions,
  };
}

export async function updateButtonPos(req: any, resp: any) {
  try {
    const gameCode = req.params.gameCode;
    if (!gameCode) {
      const res = {error: 'Invalid game code'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const buttonPos = parseInt(req.params.buttonPos, 10);
    if (!buttonPos) {
      const res = {error: 'Invalid button position'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    await GameUpdatesRepository.updateButtonPos(gameCode, buttonPos);
    resp.status(200).send({status: 'OK'});
  } catch (e) {
    resp.status(500).send({errors: errToLogString(e, false)});
  }
}

function convertHandLogToYaml(handlog: any): string {
  const club: any = {
    name: 'Bug Testing',
    description: 'testing',
  };

  const game: any = {
    create: true,
    title: 'bug testing',
    'game-type': handlog['gameType'],
    'small-blind': 1.0,
    'big-blind': 2.0,
    'min-players': 2,
    'max-players': 9,
    'game-length': 60,
    'buy-in-approval': false,
    'buy-in-min': 30,
    'buy-in-max': 3000,
    'action-time': 30,
  };

  const script: any = {
    club: club,
    game: game,
  };

  const startingSeats: Array<any> = [];
  const occupiedSeats: Array<number> = [];
  for (const seatNo in handlog['players']) {
    const player = handlog['players'][seatNo];
    occupiedSeats.push(parseInt(seatNo));
    startingSeats.push({
      seat: parseInt(seatNo),
      player: playerIdName[seatNo],
      'buy-in': player['balance']['before'],
    });
  }
  script['starting-seats'] = startingSeats;

  // sort the seat number
  occupiedSeats.sort();

  const log = handlog['handLog'];
  const gameType = handlog['gameType'];

  // find button pos
  const preflop = log['preflopActions'];
  let smallBlindPos = 1;
  for (const action of preflop['actions']) {
    if (action['action'] === 'SB') {
      smallBlindPos = action['seatNo'];
      break;
    }
  }

  // find index of smallblind
  const index = occupiedSeats.indexOf(smallBlindPos);
  // find the button pos
  let buttonPos = -1;
  if (index === 0) {
    buttonPos = occupiedSeats[occupiedSeats.length - 1];
  } else {
    buttonPos = occupiedSeats[index - 1];
  }

  const hand: any = {};
  const setup: any = {};
  // prepare setup
  setup['button-pos'] = buttonPos;
  const deck = new Deck();
  const flop = getCards(handlog['flop']);
  deck.remove(handlog['flop']);
  setup['flop'] = flop;
  const str = getCards(handlog['turn']) as string;
  setup['turn'] = str; //getCards(handlog['turn']) as string;
  deck.remove(handlog['turn']);
  setup['river'] = getCards(handlog['river']) as string;
  deck.remove(handlog['river']);

  const seatCards = Array<any>();
  // get cards for each player
  for (const seatNo of occupiedSeats) {
    const player = handlog['players'][seatNo];
    if (player['cards']) {
      seatCards.push({
        seat: seatNo,
        cards: getCards(player['cards']),
      });
    } else {
      seatCards.push({
        seat: seatNo,
        cards: getCards(deck.popCards(gameType)),
      });
    }
  }
  setup['seat-cards'] = seatCards;

  hand['setup'] = setup;

  hand['preflop'] = handActionSteps(log['preflopActions']);
  hand['flop'] = handActionSteps(log['flopActions']);
  hand['turn'] = handActionSteps(log['turnActions']);
  hand['river'] = handActionSteps(log['riverActions']);

  const hands: Array<any> = [];
  hands.push(hand);

  script['hands'] = hands;
  const yamlScript = yaml.stringify(script);
  return yamlScript;
}

export async function generateBotScript(req: any, resp: any) {
  try {
    const gameCode = req.params.gameCode;
    if (!gameCode) {
      const res = {error: 'Invalid game code'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const handNum = parseInt(req.params.handNum, 10);
    if (!handNum) {
      const res = {error: 'Invalid hand number'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const handlog = await HandRepository.getHandLog(gameCode, handNum);
    if (handlog == null) {
      resp.status(404).send(JSON.stringify({error: 'Cannot find the hand'}));
      return;
    }
    const yamlScript = convertHandLogToYaml(handlog);
    resp.status(200).send(yamlScript);
  } catch (e) {
    resp.status(500).send({errors: errToLogString(e, false)});
  }
}

export async function setServerSettings(req: any, resp: any) {
  const payload = req.body;
  const gameBlockTime = payload['game-block-time'];
  const notifyHostTimeWindow = payload['notify-host-time-window'];
  const gameCoinsPerBlock = payload['game-coins-per-block'];
  const freeTime = payload['free-time'];
  const newUserFreeCoins = payload['new-user-free-coins'];
  const ipGpsCheckInterval = payload['ip-gps-check-interval'];
  const maxClubs = payload['max-clubs'];

  const appSettings = getAppSettings();
  if (gameBlockTime) {
    appSettings.consumeTime = gameBlockTime;
  }

  if (notifyHostTimeWindow) {
    appSettings.notifyHostTimeWindow = notifyHostTimeWindow;
  }

  if (gameCoinsPerBlock) {
    appSettings.gameCoinsPerBlock = gameCoinsPerBlock;
  }

  if (freeTime) {
  }

  if (newUserFreeCoins !== undefined && newUserFreeCoins !== null) {
    appSettings.newUserFreeCoins = newUserFreeCoins;
  }

  if (ipGpsCheckInterval) {
    appSettings.ipGpsCheckInterval = ipGpsCheckInterval;
  }

  if (maxClubs) {
    appSettings.maxClubCount = maxClubs;
  }

  resp.status(200).send({status: 'OK'});
}

export async function resetServerSettings(req: any, resp: any) {
  logger.info('Reset server settings');
  resetAppSettings();
  resp.status(200).send({status: 'OK'});
}

export async function generateBotScriptDebugHand(req: any, resp: any) {
  try {
    const gameCode = req.params.gameCode;
    if (!gameCode) {
      const res = {error: 'Invalid game code'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const handNum = parseInt(req.params.handNum, 10);
    if (!handNum) {
      const res = {error: 'Invalid hand number'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const handlog = await DevRepository.getHandLog(gameCode, handNum);
    // let rawdata = fs
    //   .readFileSync(`${__dirname}/../bugs/handlog2.json`)
    //   .toString();
    // let handlog = JSON.parse(rawdata);
    if (handlog == null) {
      resp.status(404).send(JSON.stringify({error: 'Cannot find the hand'}));
      return;
    }
    const yamlScript = convertHandLogToYaml(handlog);
    resp.status(200).send(yamlScript);
  } catch (e) {
    resp.status(500).send({errors: errToLogString(e, false)});
  }
}

export async function buyBotCoins(req: any, resp: any) {
  try {
    const payload = req.body;
    const playerUuid = payload['player-uuid'];
    const appCoins = payload['coins'];
    // buy coins
    await AppCoinRepository.buyCoins(playerUuid, appCoins);
    resp.status(200).send({status: 'OK'});
  } catch (e) {
    resp.status(500).send({errors: errToLogString(e, false)});
  }
}
