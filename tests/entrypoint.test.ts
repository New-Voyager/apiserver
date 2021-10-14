require('source-map-support').install();
require('module-alias/register');
require('reflect-metadata');

process.env.TZ = 'UTC';
beforeAll(async () => {
  const {start} = require('@src/server');
  await start(false, {intTest: true});
});

// import './announcements';
// import './auth';
// import './chat';
// import './chipstrack';
// import './club';
// import './clubmessage';
// import './game';
// import './history';
// import './observers';
// import './stats';

// import './club.test';
// import './clubmessage.test';
// import './game.test';
// import './gameserver.test';
// import './hand.test';
// import './helloworld.test';
// import './player.test';
// import './reload.test';
// import './seatchange.test';
// import './waitlistseating.test';

// import './game-types';

import './game/seatChange.test';
