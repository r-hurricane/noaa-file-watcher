import {AtcfParser} from './atcf.js';
import {IParser} from "./parser.js";
import {WmoParser} from './wmo.js';

export const parsers = new Map<string, IParser>;
parsers.set('wmo', new WmoParser());
parsers.set('atcf', new AtcfParser());