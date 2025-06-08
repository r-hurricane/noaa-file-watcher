import {IFileInfo} from "../services/fileService.js";
import {IParserResult, ParserBase} from "./parser.js";
import nodePath from "node:path";
import fs from "node:fs";
import {parseAtcf} from '@r-hurricane/atcf-parser';

export class AtcfParser extends ParserBase {

    public constructor() {
        super('ATCF');
    }

    public override async parse(_file: IFileInfo, savePath: string, contents: Uint8Array<ArrayBufferLike>)
        : Promise<IParserResult>
    {

        // Parse the ATCF text
        this.logger.debug('Starting to parse ATCF contents');
        if (this.logger.isSillyEnabled()) this.logger.silly(contents);
        const atcfFile = parseAtcf(contents.toString());

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

        // The code for a storm is not the file path but the basin + gen number.
        return { code: `ATCF.${atcfFile.data[0].date?.getFullYear()}${atcfFile.data[0].basin}${atcfFile.genNo}`, json: atcfFile };
    }
}