import {AtcfParser} from './atcf.js';
import {IParser} from "./parser.js";
import {JsonParser} from "./json.js";
import {ShapeParser} from "./shape.js";
import {TwoParser} from "./two.js";
import {WmoParser} from './wmo.js';

export const parsers = new Map<string, IParser>;
parsers.set('atcf', new AtcfParser());
parsers.set('json', new JsonParser());
parsers.set('shape', new ShapeParser());
parsers.set('two', new TwoParser());
parsers.set('wmo', new WmoParser());
