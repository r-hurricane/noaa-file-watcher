import {IFileInfo} from "../services/fileService.js";
import {ParserBase} from "./parser.js";

export class AtcfParser extends ParserBase {

    public constructor() {
        super('ATCF');
    }

    public override parse(_file: IFileInfo, _savePath: string, _contents: string): string | null {
        return 'Temporary';
    }
}