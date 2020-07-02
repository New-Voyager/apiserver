// import {PORT_NUMBER} from './utils/utils';
// import {default as axios} from 'axios';
// import {resetDatabase} from './utils/utils';

// const HANDSERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

// describe('Hand server APIs', () => {
//     beforeEach(async done => {
//       await resetDatabase();
//       done();
//     });
  
//     afterEach(async done => {
//       done();
//     });

//     test('Save Hand data', async () => {
//         console.log('Saving Hand_history and hand_winners data');
//         const gameServer = {
//           ipAddress: '10.1.1.1',
//           currentMemory: 100,
//           status: 'ACTIVE',
//         };
//         try {
//           const resp = await axios.post(
//             `${GAMESERVER_API}/register-game-server`,
//             gameServer
//           );
//           expect(resp.status).toBe(200);
//           expect(resp.data.status).toBe('OK');
//         } catch (err) {
//           console.error(JSON.stringify(err));
//           expect(true).toBeFalsy();
//         }
//       });

// });