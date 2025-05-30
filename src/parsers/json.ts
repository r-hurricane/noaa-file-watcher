import {IFileInfo} from "../services/fileService.js";
import {IParserResult, ParserBase} from "./parser.js";
import nodePath from "node:path";

export class JsonParser extends ParserBase {

    public constructor() {
        super('JSON');
    }

    public override async parse(_file: IFileInfo, savePath: string, fileContents: Uint8Array<ArrayBufferLike>)
        : Promise<IParserResult>
    {

        // Parse the JSON from the file
        this.logger.debug('Passing through the JSON from downloaded file.');

        // Convert binary byte[] to UTF-8 string
        const contents = Buffer.from(fileContents).toString('utf-8');
        if (this.logger.isSillyEnabled()) this.logger.silly(contents);
        const saveUrl = nodePath.parse(savePath);

        return { code: `JSON.${saveUrl.name}`, json: JSON.parse(contents) };
    }
}