import {IFileInfo} from "../services/fileService.js";
import {ParserBase} from "./parser.js";
import nodePath from "node:path";
import fs from "node:fs";
import {parseAtcf} from '@r-hurricane/atcf-parser';

export class AtcfParser extends ParserBase {

    public constructor() {
        super('ATCF');
    }

    public override parse(_file: IFileInfo, savePath: string, contents: string): string | null {

        // Parse the ATCF text
        this.logger.debug('Starting to parse ATCF contents');
        if (this.logger.isSillyEnabled()) this.logger.silly(contents);
        const atcfFile = parseAtcf(contents);

        // Stringify
        const jsonContents = JSON.stringify(atcfFile);
        this.logger.debug(`Parsed ACF data ${savePath}`);
        if (this.logger.isSillyEnabled()) this.logger.silly(jsonContents);

        // Write the JSON to same path as .dat (with .json)
        const saveUrl = nodePath.parse(savePath);
        const saveJsonPath = savePath.substring(0, savePath.length - saveUrl.ext.length) + '.json';
        this.logger.debug(`Saving JSON to filesystem at ${saveJsonPath}`);
        fs.writeFileSync(saveJsonPath, jsonContents);
        this.logger.debug(`Saved JSON to filesystem at ${saveJsonPath}`);

        return saveUrl.name;
    }
}