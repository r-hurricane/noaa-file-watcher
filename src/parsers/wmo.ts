import fs from "node:fs";
import {IFileInfo} from "../services/fileService.js";
import nodePath from 'node:path';
import {IParserResult, ParserBase} from "./parser.js";
import {parseWmo} from "@r-hurricane/wmo-parser";
import {NOUS42} from "@r-hurricane/wmo-parser/dist/parsers/no/NOUS42.js";

export class WmoParser extends ParserBase {

    public constructor() {
        super('WMO');
    }

    public override async parse(file: IFileInfo, savePath: string, fileContents: Uint8Array<ArrayBufferLike>)
        : Promise<IParserResult>
    {

        // Parse the WMO
        this.logger.debug('Starting to parse WMO contents');
        if (this.logger.isSillyEnabled()) this.logger.silly(fileContents);
        const parsedWmo = parseWmo(fileContents.toString(), { dateCtx: file.lastModified  });
        const jsonContents = JSON.stringify(parsedWmo);
        this.logger.debug(`Parsed WMO ${parsedWmo.header?.designator}.${parsedWmo.header?.station}`);
        if (this.logger.isSillyEnabled()) this.logger.silly(jsonContents);

        // Write the JSON to same path as .txt (with .json)
        const ext = nodePath.parse(savePath).ext;
        const saveJsonPath = savePath.substring(0, savePath.length - ext.length) + '.json';
        this.logger.debug(`Saving JSON to filesystem at ${saveJsonPath}`);
        fs.writeFileSync(saveJsonPath, jsonContents);
        this.logger.debug(`Saved JSON to filesystem at ${saveJsonPath}`);

        // TCPOD Needs to have a special code
        let code = `WMO.${parsedWmo.header?.designator}.${parsedWmo.header?.station}`;
        if (parsedWmo.message instanceof NOUS42)
            code += `.${parsedWmo.message.header.tcpod.full}`;

        return { code: code, json: parsedWmo };
    }
}