pgHostKey = 'POSTGRES_HOST';
pgPortKey = 'POSTGRES_PORT';
pgUserKey = 'POSTGRES_USER';
pgPasswordKey = 'POSTGRES_PASSWORD';
pgDbNameKey = 'POSTGRES_DB';

configs = {
  default: {
    "name": "default",
    "type": "postgres",
    "host": process.env[pgHostKey],
    "port": process.env[pgPortKey],
    "username": process.env[pgUserKey],
    "password": process.env[pgPasswordKey],
    "database": process.env[pgDbNameKey],
    "logging": false,
    "cache": true,
    "synchronize": true,
    "bigNumberStrings": false,
    "entities": ["build/src/entity/**/*.js"]
  },
  test: {
    "name": "default",
    "type": "sqlite",
    "database": ":memory:",
    "dropSchema": true,
    "synchronize": true,
    "logging": false,
    "cache": true,
    "entities": ["build/src/entity/**/*.js", "../build/src/entity/**/*.js"]
  }
}

if (process.env.NODE_ENV === 'test') {
  process.env.DB_USED = 'sqllite';
  module.exports = configs.test;
} else {
  envs = [pgHostKey, pgPortKey, pgUserKey, pgPasswordKey, pgDbNameKey];
  errs = [];
  for (const v of envs) {
    if (!process.env[v]) {
      errs.push(`${v} is not defined`);
    }
  }
  if (errs.length > 0) {
    throw new Error(errs.join('\n'));
  }
  module.exports = configs.default;
}
