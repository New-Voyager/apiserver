let pgHostKey = 'POSTGRES_HOST';
let pgPortKey = 'POSTGRES_PORT';
let pgUserKey = 'POSTGRES_USER';
let pgPasswordKey = 'POSTGRES_PASSWORD';
let pgDbNameKey = 'POSTGRES_DB';
let pgSSLKey = 'POSTGRES_SSL';

let pgDebugHostKey = 'POSTGRES_DEBUG_HOST';
let pgDebugPortKey = 'POSTGRES_DEBUG_PORT';
let pgDebugUserKey = 'POSTGRES_DEBUG_USER';
let pgDebugPasswordKey = 'POSTGRES_DEBUG_PASSWORD';
let pgDebugDbNameKey = 'POSTGRES_DEBUG_DB';

let debugHost: string | undefined =
  'voyager-poker-postgresql-nyc3-01-do-user-7667119-0.b.db.ondigitalocean.com';
let debugPort: number | undefined = 25060;
let debugDB: string | undefined = 'defaultdb';
let debugUser: string | undefined = 'doadmin';
let debugPassword: string | undefined = 'v7wvhf4wo704h4q4';

if (process.env[pgDebugHostKey]) {
  debugHost = process.env[pgDebugHostKey];
}

if (process.env[pgDebugPortKey]) {
  var debugPortString: string | undefined = process.env[pgDebugPortKey];
  if (debugPortString !== undefined) {
    debugPort = parseInt(debugPortString);
  }
}

let ssl = false;
if (process.env[pgSSLKey]) {
  if (process.env[pgSSLKey] === '1' || process.env[pgSSLKey] === 'true') {
    ssl = true;
  }
}

if (process.env[pgDebugUserKey]) {
  debugUser = process.env[pgDebugUserKey];
}

if (process.env[pgDebugPasswordKey]) {
  debugPassword = process.env[pgDebugPasswordKey];
}

if (process.env[pgDebugDbNameKey]) {
  debugDB = process.env[pgDebugDbNameKey];
}
let profile = '';
if (process.env.NODE_ENV) {
  profile = process.env.NODE_ENV.toLowerCase();
}

let playerEntities = ['build/src/entity/player/**/*.js'];
if (profile === 'int-test') {
  playerEntities = [
    'build/src/entity/player/**/*.js',
    'src/entity/player/**/*.ts',
  ];
}

let gameEntities = ['build/src/entity/game/**/*.js'];
if (profile === 'int-test') {
  gameEntities = ['build/src/entity/game/**/*.js', 'src/entity/game/**/*.ts'];
}

let historyEntities = ['build/src/entity/history/**/*.js'];
if (profile === 'int-test') {
  historyEntities = [
    'build/src/entity/history/**/*.js',
    'src/entity/history/**/*.ts',
  ];
}

let debugEntities = ['build/src/entity/debug/**/*.js'];
if (profile === 'int-test') {
  debugEntities = [
    'build/src/entity/debug/**/*.js',
    'src/entity/debug/**/*.ts',
  ];
}

let configs: any = {
  default: {
    name: 'default',
    type: 'postgres',
    host: process.env[pgHostKey],
    port: process.env[pgPortKey],
    username: process.env[pgUserKey],
    password: process.env[pgPasswordKey],
    database: process.env[pgDbNameKey],
    logging: false,
    cache: true,
    synchronize: true,
    bigNumberStrings: false,
    entities: [],
  },
  users: {
    name: 'users',
    type: 'postgres',
    host: process.env[pgHostKey],
    port: process.env[pgPortKey],
    username: process.env[pgUserKey],
    password: process.env[pgPasswordKey],
    database: 'users', //process.env[pgDbNameKey],
    logging: false,
    cache: true,
    synchronize: true,
    bigNumberStrings: false,
    entities: playerEntities,
  },
  livegames: {
    name: 'livegames',
    type: 'postgres',
    host: process.env[pgHostKey],
    port: process.env[pgPortKey],
    username: process.env[pgUserKey],
    password: process.env[pgPasswordKey],
    database: 'livegames', //process.env[pgDbNameKey],
    logging: false,
    cache: true,
    synchronize: true,
    bigNumberStrings: false,
    entities: gameEntities,
  },
  history: {
    name: 'history',
    type: 'postgres',
    host: process.env[pgHostKey],
    port: process.env[pgPortKey],
    username: process.env[pgUserKey],
    password: process.env[pgPasswordKey],
    database: 'history',
    logging: false,
    cache: true,
    synchronize: true,
    bigNumberStrings: false,
    entities: historyEntities,
  },
  debug: {
    name: 'debug',
    type: 'postgres',
    host: debugHost,
    port: debugPort,
    username: debugUser,
    password: debugPassword,
    database: debugDB,
    logging: false,
    cache: true,
    synchronize: true,
    bigNumberStrings: false,
    ssl: true,
    extra: {
      ssl: {
        rejectUnauthorized: false,
      },
    },
    entities: debugEntities,
  },
  // test: {
  //   name: 'default',
  //   type: 'sqlite',
  //   database: ':memory:',
  //   dropSchema: true,
  //   synchronize: true,
  //   logging: false,
  //   cache: true,
  //   entities: ['build/src/entity/**/*.js', '../build/src/entity/**/*.js'],
  // },
};
if (process.env.NODE_ENV === 'test') {
  process.env.DB_USED = 'sqllite';
  configs = {
    users: {
      name: 'users',
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      logging: false,
      cache: true,
      entities: [
        'build/src/entity/player/**/*.js',
        '../build/src/entity/player/**/*.js',
      ],
    },
    livegames: {
      name: 'livegames',
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      logging: false,
      cache: true,
      entities: [
        'build/src/entity/game/**/*.js',
        '../build/src/entity/game/**/*.js',
      ],
    },
    history: {
      name: 'history',
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      logging: false,
      cache: true,
      entities: [
        'build/src/entity/history/**/*.js',
        '../build/src/entity/history/**/*.js',
      ],
    },
  };
  // export default {
  //   livegames: configs.livegames,
  //   history: configs.history,
  //   users: configs.users,
  // };
} else {
  // let envs = [pgHostKey, pgPortKey, pgUserKey, pgPasswordKey];
  // let errs = [];
  // for (const v of envs) {
  //   if (!process.env[v]) {
  //     errs.push('env is not defined');
  //   }
  // }
  // if (errs.length > 0) {
  //   throw new Error(errs.join('\n'));
  // }

  // update ssl flag if specified
  if (ssl) {
    let extra: any = {
      ssl: {
        rejectUnauthorized: false,
      },
    };
    configs.default.ssl = true;
    configs.default.extra = extra;

    configs.livegames.ssl = true;
    configs.livegames.extra = extra;

    configs.users.ssl = true;
    configs.users.extra = extra;

    configs.history.ssl = true;
    configs.history.extra = extra;
  }
}
//export let default: any = configs.defaults;
// export let users: any = configs.users;
// export let livegames: any = configs.livegames;
// export let history: any = configs.history;
// export let debug: any = configs.debug;
export function getConnections(): any {
  return {
    default: configs.default,
    livegames: configs.livegames,
    history: configs.history,
    users: configs.users,
    debug: configs.debug,
  };
}
