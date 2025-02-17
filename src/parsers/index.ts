import {AtcfParser} from './atcf.js';
import {IParser} from "./parser.js";
import {ShapeParser} from "./shape.js";
import {WmoParser} from './wmo.js';

export const parsers = new Map<string, IParser>;
parsers.set('atcf', new AtcfParser());
parsers.set('shape', new ShapeParser());
parsers.set('wmo', new WmoParser());
