import * as vscode from 'vscode';
import LakePreview from './lake-preview';
import { Disposable, disposeAll } from '../../common/dispose';
import LakeDocument from './lake-document';
import { LakeViewType } from '../../common/constants';

export default class LakeEditorProvider extends Disposable implements vscode.CustomEditorProvider<LakeDocument> {
  public static readonly viewType = LakeViewType;
  private previews: LakePreview[] = [];

  constructor(private readonly extensionRoot: vscode.Uri) {
    super();
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<LakeDocument>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  saveCustomDocument(document: LakeDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return this.saveCustomDocumentAs(document, document.uri, cancellation);
  }

  saveCustomDocumentAs(document: LakeDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
    return document.saveAs(destination, cancellation);
  }

  revertCustomDocument(document: LakeDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return document.revert(cancellation);
  }

  backupCustomDocument(document: LakeDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }

  async openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext): Promise<LakeDocument> {
    console.info('open custom document', uri);
    const doc = await LakeDocument.create(uri, openContext.backupId);

    return doc;
  }

  resolveCustomEditor(document: LakeDocument, webviewEditor: vscode.WebviewPanel): void | Thenable<void> {
    const lakePreview = new LakePreview(this.extensionRoot, document.uri, webviewEditor);
    this.previews.push(lakePreview);

    this._register(lakePreview.onDispose(() => {
      const index = this.previews.indexOf(lakePreview);
      if (index !== -1) {
        this.previews.splice(index, 1);
      }
    }));

    document.setDelegate({
      getFileData: async () => {
        if(lakePreview.isDisposed) {
          return new Uint8Array();
        }
        const content = await lakePreview.getContent();
        return content;
      },
    });

    const listeners: vscode.Disposable[] = [];

    listeners.push(document.onDidChangeContent(e => {
      if (lakePreview) {
        lakePreview.updateContent(e.content);
      }
    }));

    document.onDidDispose(() => disposeAll(listeners));

    this._register(lakePreview.onReady(async () => {
      const content = await document.content();
      lakePreview.updateContent(content);
    }));

    this._register(lakePreview.onDidChange(() => {
      // Tell VS Code that the document has been edited by the use.
      this._onDidChangeCustomDocument.fire({
        document,
        undo: () => {
          lakePreview.undo();
        },
        redo: () => {
          lakePreview.redo();
        },
      });
    }));
  }
}
