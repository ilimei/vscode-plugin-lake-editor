import * as vscode from 'vscode';
import EditorProvider from './editor-provider';

export function registerCustomEditorProvider(context: vscode.ExtensionContext) {
  const editorProvider = new EditorProvider(context.extensionUri);

  context.subscriptions.push(vscode.window.registerCustomEditorProvider(EditorProvider.viewType, editorProvider, {
    supportsMultipleEditorsPerDocument: true,
  }));
}
