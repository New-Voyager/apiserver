require('source-map-support').install();
require('module-alias/register');
require('reflect-metadata');
import {start} from '@src/server';

process.env.TZ = 'UTC';
start(true);
