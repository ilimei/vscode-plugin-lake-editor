import * as vscode from 'vscode';
import LakeBookTreeProvider from './lakebool-tree-provider';

export function registerTreeProvider(context: vscode.ExtensionContext) {
    const treeProvider = new LakeBookTreeProvider(context);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('lakeEditor.lakebookExplorer', treeProvider));
}