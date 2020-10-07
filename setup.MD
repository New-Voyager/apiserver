1. Run docker image of a postgres server
  create a volume for postgres data file
    docker volume create gamedb
    docker-compose -f docker-compose-pg.yaml up
2. How to setup database with some live games and past games
