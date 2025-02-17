import {IFileInfo} from "../services/fileService.js";

export interface INoaaFileModel {
    id: number | null;
    href: string | null;
    code: string | null;
    modified_on: string | null;
    savePath: string | null;
}

export class NoaaFileModel implements INoaaFileModel {
    public id: number | null = null;
    public href: string | null = null;
    public code: string | null = null;
    public modified_on: string | null = null;
    public savePath: string | null = null;

    public constructor(param: INoaaFileModel)
    {
        this.id = param?.id ?? null;
        this.href = param?.href ?? null;
        this.code = param?.code ?? null;
        this.modified_on = param?.modified_on ?? null;
        this.savePath = param?.savePath ?? null;
    }

    public toString(): string {
        return `NoaaFile(id=${this.id}, href=${this.href}, code=${this.code}, modified_on=${this.modified_on}, savePath=${this.savePath})`;
    }
}

export abstract class FileDatabase {

    public abstract connect(): Promise<void>;
    public abstract getAllLatest(files: Array<IFileInfo>): Promise<Map<string, NoaaFileModel | null>>;
    public abstract insertFile(file: INoaaFileModel): Promise<void>;
    public abstract end(): Promise<void>;

}