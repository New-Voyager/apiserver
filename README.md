# apiserver

[![CircleCI](https://circleci.com/gh/New-Voyager/apiserver.svg?style=svg&circle-token=332b6c164df3a333a6d6e14282ca317d0c52abe5)](https://app.circleci.com/pipelines/github/New-Voyager/apiserver)

## Development
To run the project with postgres database, you need to run the postgres in docker.
```
docker-compose -f docker-compose-pg.yaml up
```

Then, run the server using either yarn and npm command.
```
yarn debug
```
To run in windows, use debug-windows script.
```
yarn debug-windows 
```

## Testing
There are two run configurations to run tests in package json
First run the the server in test mode, which will use sqllite for database
  "test-server": "NODE_ENV=test DB_USED=sqllite node build/index.js"
```
yarn test-server
```

In windows, use test-server-windows script.
```
yarn test-server-windows
```

Then, run the jest test with test configuration. 
    "test": "NODE_ENV=test jest --runInBand",
```
yarn test
```

You can run below make target to run both test-server and tests.
```
make test
```
