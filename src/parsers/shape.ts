import {iter} from 'but-unzip';
import fs from "node:fs";
import {IFileInfo} from "../services/fileService.js";
import nodePath from "node:path";
import {ParserBase} from "./parser.js";

// @ts-ignore
import shpjs from 'shpjs';

export class ShapeParser extends ParserBase {

    public constructor() {
        super('SHAPE');
    }

    public override async parse(file: IFileInfo, savePath: string, contents: Uint8Array<ArrayBufferLike>): Promise<string | null> {

        // Parse the Shape zip file
        this.logger.debug('Starting to parse Shape contents');
        if (this.logger.isSillyEnabled()) this.logger.silly(contents);
        const geojson = {
            'shape': await shpjs(contents),
            'wmo': await this.extractTwoText(contents)
        };

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

        return file.lastModified?.toUTCString() ?? null;
    }

    private async extractTwoText(contents: Uint8Array<ArrayBufferLike>): Promise<object> {
        // Loop through all files in zip, and find the RTF ones
        let twoText: {[key: string]: string} = {};
        for (let f of iter(contents)) {
            if (!f.filename.endsWith('rtf')) continue;

            // Get the basin name
            const nameMatch = f.filename.match(/two_(.*?)_text/);
            const basn = nameMatch?.at(1) || f.filename;

            // Extract the two text
            const fileBuff = await f.read();

            // Add to object
            twoText[basn] = fileBuff.toString();
        }

        return twoText;
    }
}