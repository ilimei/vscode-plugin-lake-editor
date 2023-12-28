import * as vscode from 'vscode';
import * as path from 'path';
import { LakeViewType } from '../common/constants';
import { ILakeNode, LakeBookModel, ILakeTocNode, LakeRoot } from './lake-model';

export default class LakeBookTreeProvider implements vscode.TreeDataProvider<ILakeNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void | ILakeNode | ILakeNode[]>();
    readonly onDidChangeTreeData: vscode.Event<void | ILakeNode | ILakeNode[]> = this._onDidChangeTreeData.event;

    static currentModel: LakeBookModel | null = null;
    static async getLakeURIContent(uri: vscode.Uri) {
        if (this.currentModel && uri.scheme === 'lake') {
            return LakeBookModel.getLakeURIContent(uri);
        }
        return new Uint8Array();
    }

    private model: LakeBookModel;

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
                query: element.url + '.json',
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
