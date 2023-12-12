import * as vscode from 'vscode';
import LakePreview from './lake-preview';
import { Disposable, disposeAll } from '../../common/dispose';
import LakeDocument, { LakeDocumentDelegate } from './lake-document';

export default class LakeEditorProvider extends Disposable implements vscode.CustomEditorProvider<LakeDocument>, LakeDocumentDelegate {
	public static readonly viewType = 'lakeEditor.lakeEditor';
  private lakePreview: LakePreview | null = null;

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

  async getFileData() {
    if(!this.lakePreview) {
      return new Uint8Array();
    }
    const content = await this.lakePreview.getContent();
    return content;
  }

	async openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext): Promise<LakeDocument> {
		const doc = await LakeDocument.create(uri,openContext.backupId, this);
    const listeners: vscode.Disposable[] = [];

		listeners.push(doc.onDidChangeContent(e => {
			if(this.lakePreview) {
        this.lakePreview.updateContent(e.content);
      }
		}));

		doc.onDidDispose(() => disposeAll(listeners));

    return doc;
	}

	resolveCustomEditor(document: LakeDocument, webviewEditor: vscode.WebviewPanel): void | Thenable<void> {
    this.lakePreview = new LakePreview(this.extensionRoot, document.uri, webviewEditor);

    this._register(this.lakePreview.onReady(() => {
      this.lakePreview.updateContent(document.content);
    }));

    this._register(this.lakePreview.onDidChange(() => {
      // Tell VS Code that the document has been edited by the use.
			this._onDidChangeCustomDocument.fire({
				document,
        undo: () => { 
          this.lakePreview.undo();
         },
        redo: () => { 
          this.lakePreview.redo();
         },
			});
    }));
	}
}
