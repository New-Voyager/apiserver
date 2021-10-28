module.exports = async () => {
  require('source-map-support').install();
  require('module-alias/register');
  require('reflect-metadata');
  require('ts-node/register');
  const {start} = require('@src/server');
  // await start(false, {intTest: true});
};
