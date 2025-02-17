import fs from "node:fs";
import {IFileInfo} from "../services/fileService.js";
import nodePath from "node:path";
import {IParserResult, ParserBase} from "./parser.js";
import {parseTwo} from "@r-hurricane/two-parser";

export class TwoParser extends ParserBase {

    public constructor() {
        super('TWO');
    }

    public override async parse(file: IFileInfo, savePath: string, contents: Uint8Array<ArrayBufferLike>)
        : Promise<IParserResult>
    {

        // Parse the Shape zip file
        this.logger.debug('Starting to parse Shape contents');
        if (this.logger.isSillyEnabled()) this.logger.silly(contents);
        const geojson = await parseTwo(contents, file.lastModified);

        // Stringify
        const jsonContents = JSON.stringify(geojson);
        this.logger.debug(`Parsed Shape data ${savePath}`);
        if (this.logger.isSillyEnabled()) this.logger.silly(jsonContents);

        // Write the JSON to same path as .zip (with .json)
        const saveUrl = nodePath.parse(savePath);
        const saveJsonPath = savePath.substring(0, savePath.length - saveUrl.ext.length) + '.json';
        this.logger.debug(`Saving JSON to filesystem at ${saveJsonPath}`);
        fs.writeFileSync(saveJsonPath, jsonContents);
        this.logger.debug(`Saved JSON to filesystem at ${saveJsonPath}`);

        return { code: `TWO.${file.lastModified?.toISOString() ?? new Date().toISOString()}`, json: geojson };
    }
}