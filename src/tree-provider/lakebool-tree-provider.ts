import * as vscode from 'vscode';
import * as path from 'path';
import Tar from 'tar';
import Yaml from 'yaml';
import { LakeViewType } from '../common/constants';

export interface ILakeNode {
    title: string;
    type: 'DOC' | 'TITLE';
    sourceUri: vscode.Uri;
    nodes?: ILakeNode[];
}

export interface IMetaData {
    meta: string;
    meta_digest: string;
}

export interface IMetaConfig {
    book: {
        path: string;
        public: 0 | 1;
        tocYml: string;
        type: string;
    },
    config: {
        endecryptType: number;
    },
    docs: [],
    version: string;
}

export interface IToc {
    type: 'DOC' | 'TITLE';
    title: string;
    uuid: string;
    url: string;
    prev_uuid: string;
    sibling_uuid: string;
    child_uuid: ''
    parent_uuid: string;
    doc_id: number;
    level: number;
    id: number;
    open_window: number;
    visible: number;
}

export class ILakeTocNode implements ILakeNode {
    nodes: ILakeTocNode[] = [];

    constructor(private _toc: IToc, private _uri: vscode.Uri) {
    }

    public get id() {
        return this._toc.id;
    }

    public get uuid() {
        return this._toc.uuid;
    }

    public get url() {
        return this._toc.url;
    }

    public get title() {
        return this._toc.title;
    }

    public get sourceUri() {
        return this._uri;
    }

    public get type() {
        return this._toc.type;
    }
}

export class LakeRoot implements ILakeNode {
    private _paths: string[] = [];
    private _entries: Tar.ReadEntry[] = [];
    private _title: string;
    private nodeMap: Map<string, ILakeTocNode> = new Map();
    private childNodes: ILakeTocNode[] = [];

    constructor(private _uri: vscode.Uri) {
        try {
            let metaDataStr = '';
            this._title = path.basename(this._uri.fsPath);
            Tar.list({
                file: this._uri.fsPath,
                onentry: (entry: Tar.ReadEntry) => {
                    this._entries.push(entry);
                    this._paths.push(entry.path);
                    if (entry.path.endsWith('$meta.json')) {

                        entry.on('data', chunk => {
                            metaDataStr += chunk.toString();
                        });

                        entry.on('end', () => {
                            console.log(metaDataStr); // Here is your string
                        });
                    }
                },
                sync: true,
            });
            const metaData = JSON.parse(metaDataStr) as IMetaData;
            const metaConfig = JSON.parse(metaData.meta) as IMetaConfig;
            const tocs = Yaml.parse(metaConfig.book.tocYml) as IToc[];
            for (const toc of tocs) {
                const node = new ILakeTocNode(toc, this._uri);
                this.nodeMap.set(toc.uuid, node);
                if (toc.level === 0) {
                    this.childNodes.push(node);
                } else if (toc.parent_uuid) {
                    const parentNode = this.nodeMap.get(toc.parent_uuid);
                    if (parentNode) {
                        parentNode.nodes.push(node);
                    }
                }
            }
            console.info(this.childNodes);
            // this._tree = treeFromPaths(files, _uri, 
            //     path.basename(this._uri.fsPath))
        } catch (e) {
            vscode.window.showErrorMessage(e.toString());
        }
    }

    public get title() {
        return this._title;
    }

    public get type() {
        return 'TITLE' as const;
    }

    public get sourceUri() {
        return this._uri;
    }

    public get nodes() {
        return this.childNodes;
    }
}

export class LakeBookModel {
    private _lakeRoots: LakeRoot[];

    constructor() {
        this._lakeRoots = [];
    }

    public get roots() {
        return this._lakeRoots;
    }

    public openLakeBook(fileUri: vscode.Uri) {
        this._lakeRoots.push(new LakeRoot(fileUri));
    }

}

export default class LakeBookTreeProvider implements vscode.TreeDataProvider<ILakeNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void | ILakeNode | ILakeNode[]>();
    readonly onDidChangeTreeData: vscode.Event<void | ILakeNode | ILakeNode[]> = this._onDidChangeTreeData.event;

    static currentModel: LakeBookModel | null = null;
    static async getLakeURIContent(uri: vscode.Uri) {
        if (this.currentModel && uri.scheme === 'lake') {
            const node = this.currentModel.roots.find(root => root.sourceUri.toString() === uri.toString());
            if (node) {
                const entry = node['_entries'].find(entry => entry.path.endsWith(uri.query));
                if (entry) {
                    const chunks = [];
                    entry.on('data', chunk => {
                        chunks.push(chunk);
                    });
                    entry.on('end', () => {
                        Buffer.concat(chunks);
                    });
                }
            }
        }
        return new Uint8Array();
    }

    model: LakeBookModel;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.clear();
        this.registerCommands();
    }

    openLakeBook(uri: vscode.Uri) {
        this.model?.openLakeBook(uri);
        this._onDidChangeTreeData.fire();
    }

    openLakeBookSource(uri: vscode.Uri) {
        vscode.commands.executeCommand('vscode.openWith', uri, LakeViewType, { preview: true });
    }

    getTreeItem(element: ILakeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const isFile = element.type === 'DOC';
        const command = element instanceof ILakeTocNode && isFile ? {
            command: 'lakeEditor.openLakebookSource',
            title: 'Open Lakebook Source',
            arguments: [element.sourceUri.with({
                scheme: 'lake',
                path: path.join(element.sourceUri.path, element.title),
                query: element.url,
            })],
        } : void 0;

        if (element instanceof LakeRoot) {
            return {
                label: element.title,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: 'lakebook',
                iconPath: new vscode.ThemeIcon('file-zip'),
            };
        }
        return {
            label: element.title,
            command,
            collapsibleState: isFile ? void 0 : vscode.TreeItemCollapsibleState.Expanded,
            contextValue: 'lakebook',
            iconPath: isFile ? vscode.ThemeIcon.File : new vscode.ThemeIcon('folder'),
        };
    }

    getChildren(element?: ILakeNode): vscode.ProviderResult<ILakeNode[]> {
        if (!element) {
            return this.model.roots;
        }
        return element.nodes;
    }

    getParent?(element: ILakeNode): vscode.ProviderResult<ILakeNode> {
        throw new Error('Method not implemented.');
    }

    resolveTreeItem?(item: vscode.TreeItem, element: ILakeNode, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
        throw new Error('Method not implemented.');
    }

    private clear() {
        this.model = null;
        this.model = new LakeBookModel();
        LakeBookTreeProvider.currentModel = this.model;
        this._onDidChangeTreeData.fire();
    }

    private registerCommands() {
        vscode.commands.registerCommand('lakeEditor.exploreLakebook', (uri: vscode.Uri) => {
            this.openLakeBook(uri);
        });
        vscode.commands.registerCommand('lakeEditor.openLakebookSource', (uri: vscode.Uri) => {
            this.openLakeBookSource(uri);
        });
    }
}