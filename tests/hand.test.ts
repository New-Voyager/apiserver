import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase} from './utils/utils';
import * as handutils from './utils/hand.testutils';
import { concatAST } from 'graphql';

let hand1 = require('../docs/hands/ended_at_flop.json');
let hand2 = require('../docs/hands/hi_lo.json');
let hand3 = require('../docs/hands/showdown.json');
let hand4 = require('../docs/hands/split_pots.json');

const HANDSERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

beforeAll(async done => {
  await resetDatabase();
  done();
});

afterAll(async done => {
  done();
});

describe('Hand Server', () => {

  test('Save hand data', async () => {
    // console.log('Saving Hand_history and hand_winners data');
    try {
      const resp1 = await axios.post(
        `${HANDSERVER_API}/save-hand`,
        hand1
      );
      expect(resp1.status).toBe(200);
      expect(resp1.data.status).toBe('OK');

      const resp2 = await axios.post(
        `${HANDSERVER_API}/save-hand`,
        hand2
      );
      expect(resp2.status).toBe(200);
      expect(resp2.data.status).toBe('OK');

      const resp3 = await axios.post(
        `${HANDSERVER_API}/save-hand`,
        hand3
      );
      expect(resp3.status).toBe(200);
      expect(resp3.data.status).toBe('OK');

      const resp4 = await axios.post(
        `${HANDSERVER_API}/save-hand`,
        hand4
      );
      expect(resp4.status).toBe(200);
      expect(resp4.data.status).toBe('OK');

    } catch (err) {
      expect(true).toBeFalsy();
    }
  });

  test('Get specific hand history', async() => {
    // console.log('Getting specific Hand_history data');

    try {
      let resp1 = await handutils.getSpecificHandHistory('12345', 1, 1, 1);
      expect(resp1.gameType).toBe('HOLDEM');
      expect(resp1.wonAt).toBe('FLOP');

      let resp2 = await handutils.getSpecificHandHistory('12345', 1, 1, 2);
      expect(resp2.gameType).toBe('HOLDEM');
      expect(resp2.wonAt).toBe('SHOWDOWN');

      let resp3 = await handutils.getSpecificHandHistory('12345', 1, 1, 3);
      expect(resp3.gameType).toBe('OMAHA_HILO');
      expect(resp3.wonAt).toBe('SHOWDOWN');

      let resp4 = await handutils.getSpecificHandHistory('12345', 1, 1, 4);
      expect(resp4.gameType).toBe('HOLDEM');
      expect(resp4.wonAt).toBe('SHOWDOWN');

    } catch (err) {
      expect(true).toBeFalsy();
    }
  });

  test('Get latest hand history', async() => {
    // console.log('Getting latest Hand_history data');

    try {
      let resp1 = await handutils.getLastHandHistory('12345', 1, 1);
      expect(resp1.gameType).toBe('HOLDEM');
      expect(resp1.wonAt).toBe('SHOWDOWN');
      expect(resp1.handNum).toBe(4);

    } catch (err) {
      expect(true).toBeFalsy();
    }
  });

  test('Get all hand history', async() => {
    // console.log('Getting all Hand_history data');

    try {
      let resp1 = await handutils.getAllHandHistory('12345', 1, 1);
      expect(resp1).toHaveLength(4);

    } catch (err) {
      expect(true).toBeFalsy();
    }
  });

  test('get all hand history pagination', async () => {
    let data = hand1;
    for (let i = 5; i < 17; i++) {
      data.handNum = i;
      await axios.post(
        `${HANDSERVER_API}/save-hand`,
        data
      );
    }
    let resp1 = await handutils.getAllHandHistory('12345', 1, 1);
    expect(resp1).toHaveLength(10);

    const lastHand = resp1[9];
    let resp2 = await handutils.getAllHandHistory('12345', 1, 1, {
      prev: lastHand.pageId,
      count: 5,
    });
    expect(resp2).toHaveLength(5);
  });
    

});