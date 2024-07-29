import * as vscode from 'vscode';
import LakeEditorProvider from './lake-preview/lake-editor-provider';

export function registerCustomEditorProvider(context: vscode.ExtensionContext) {
  const lakeEditorProvider = new LakeEditorProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(LakeEditorProvider.viewType, lakeEditorProvider, {
      supportsMultipleEditorsPerDocument: false,
      webviewOptions: {
        retainContextWhenHidden: true,
      }
    })
  );
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('lakeEditor.markdownEditor', lakeEditorProvider, {
      supportsMultipleEditorsPerDocument: false,
      webviewOptions: {
        retainContextWhenHidden: true,
      }
    })
  );
}
