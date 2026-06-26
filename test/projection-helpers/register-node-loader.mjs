import { register } from 'node:module';

register('./node-extension-loader.mjs', import.meta.url);
