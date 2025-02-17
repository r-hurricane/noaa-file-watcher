import {createLogger} from "../logging.js";
import {IFileInfo} from "../services/fileService.js";
import {Logger} from "winston";

export interface IParser {
    parse(file: IFileInfo, savePath: string, contents: string): string | null;
}

export abstract class ParserBase implements IParser {
    protected logger: Logger;

    protected constructor(label: string) {
        this.logger = createLogger(`${label}Parser`);
    }

    public abstract parse(file: IFileInfo, savePath: string, contents: string): string | null;
}