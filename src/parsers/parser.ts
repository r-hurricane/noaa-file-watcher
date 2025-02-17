import {createLogger} from "../logging.js";
import {IFileInfo} from "../services/fileService.js";
import {Logger} from "winston";

export interface IParser {
    parse(file: IFileInfo, contents: string): void;
}

export abstract class Parser implements IParser {
    protected logger: Logger;

    protected constructor(label: string) {
        this.logger = createLogger(label);
    }

    public abstract parse(file: IFileInfo, contents: string): void;
}