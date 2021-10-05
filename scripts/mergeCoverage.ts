/*

yarn tsn-script ./scripts/mergeCoverage.ts --report ./coverage0/coverage-final.json --report ./coverage1/coverage-final.json
yarn ts-node-script ./scripts/mergeCoverage.ts --report ./cov-int/coverage-final.json --report ./cov-unit/coverage-final.json
*/

import * as fs from 'fs-extra'
import * as yargs from 'yargs'
const { createCoverageMap } = require('istanbul-lib-coverage')
const { createReporter } = require('istanbul-api');

main().catch(err => {
  console.error(err)
  process.exit(1)
})

async function main () {
  const argv = yargs
    .options({
      report: {
        type: 'array', // array of string
        desc: 'Path of json coverage report file',
        demandOption: true,
      },
      reporters: {
        type: 'array',
        default: ['json', 'lcov'],
      }
    })
    .argv

  const reportFiles = argv.report as string[]
  const reporters = argv.reporters as string[]

  const map = createCoverageMap({})

  reportFiles.forEach(file => {
    const r = fs.readJsonSync(file)
    map.merge(r)
  })

  const reporter = createReporter();
  // reporter.addAll(['json', 'lcov', 'text']);
  // reporter.addAll(['json', 'lcov']);
  reporter.addAll(reporters)
  reporter.write(map)
  console.log('Created a merged coverage report in ./coverage')
}