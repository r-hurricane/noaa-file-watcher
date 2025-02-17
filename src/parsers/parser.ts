import {createLogger} from "../logging.js";
import {IFileInfo} from "../services/fileService.js";
import {Logger} from "winston";

export interface IParserResult {
    code: string | null,
    json?: object | null
}

export interface IParser {
    parse(file: IFileInfo, savePath: string, contents: Uint8Array<ArrayBufferLike>): Promise<IParserResult>;
}

export abstract class ParserBase implements IParser {
    protected logger: Logger;

    protected constructor(label: string) {
        this.logger = createLogger(`${label}Parser`);
    }

    public abstract parse(file: IFileInfo, savePath: string, contents: Uint8Array<ArrayBufferLike>): Promise<IParserResult>;
}