pgHostKey = 'POSTGRES_HOST';
pgPortKey = 'POSTGRES_PORT';
pgUserKey = 'POSTGRES_USER';
pgPasswordKey = 'POSTGRES_PASSWORD';
pgDbNameKey = 'POSTGRES_DB';

configs = {
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
    entities: ['build/src/entity/player/**/*.js'],
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
    entities: ['build/src/entity/game/**/*.js'],
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
    entities: ['build/src/entity/history/**/*.js'],
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
      entities: ['build/src/entity/player/**/*.js', '../build/src/entity/player/**/*.js'],
    },
    livegames: {
      name: 'livegames',
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      logging: false,
      cache: true,
      entities: ['build/src/entity/game/**/*.js', '../build/src/entity/game/**/*.js'],
    },
    history: {
      name: 'history',
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      logging: false,
      cache: true,
      entities: ['build/src/entity/history/**/*.js', '../build/src/entity/history/**/*.js'],
    },
  };
  module.exports = {
    livegames: configs.livegames,
    history: configs.history,
    users: configs.users,
  }
} else {
  envs = [pgHostKey, pgPortKey, pgUserKey, pgPasswordKey];
  errs = [];
  for (const v of envs) {
    if (!process.env[v]) {
      errs.push(`${v} is not defined`);
    }
  }
  if (errs.length > 0) {
    throw new Error(errs.join('\n'));
  }
  module.exports = {
    livegames: configs.livegames,
    history: configs.history,
    users: configs.users,
    default: configs.default,
  }
}
