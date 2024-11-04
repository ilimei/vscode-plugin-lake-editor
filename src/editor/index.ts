import * as vscode from 'vscode';
import LakeEditorProvider from './lake-preview/lake-editor-provider';
import LakePreview from './lake-preview/lake-preview';

export function registerCustomEditorProvider(context: vscode.ExtensionContext) {
  const lakeEditorProvider = new LakeEditorProvider(context.extensionUri);

  vscode.commands.executeCommand('setContext', 'lakeEditorFocus', false);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(LakeEditorProvider.viewType, lakeEditorProvider, {
      supportsMultipleEditorsPerDocument: false,
      webviewOptions: {
        retainContextWhenHidden: true,
      }
    })
  );

  context.subscriptions.push(vscode.commands.registerCommand('lakeEditor.pasteAsPlainText', () => {
    LakePreview.pasteAsPlainText();
  }));

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('lakeEditor.markdownEditor', lakeEditorProvider, {
      supportsMultipleEditorsPerDocument: false,
      webviewOptions: {
        retainContextWhenHidden: true,
      }
    })
  );
}
