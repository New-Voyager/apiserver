import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase} from './utils/utils';

let hand1 = require('../docs/hands/ended_at_flop.json');
let hand2 = require('../docs/hands/hi_lo.json');
let hand3 = require('../docs/hands/showdown.json');
let hand4 = require('../docs/hands/split_pots.json');

const HANDSERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

describe('start a new game', () => {
    beforeEach(async done => {
      await resetDatabase();
      done();
    });
  
    afterEach(async done => {
      done();
    });

    test('Save Hand data', async () => {
        console.log('Saving Hand_history and hand_winners data');
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

});