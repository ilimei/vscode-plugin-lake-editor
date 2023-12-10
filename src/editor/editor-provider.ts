import path from 'path';
import * as vscode from 'vscode';
import BasePreview from './base-preview';
import LakePreview from './lake-preview';
import { Disposable, disposeAll } from '../common/dispose';
import LakeDocument, { LakeDocumentDelegate } from './lake-document';

export default class EditorProvider extends Disposable implements vscode.CustomEditorProvider<LakeDocument>, LakeDocumentDelegate {
	public static readonly viewType = 'lakeEditor.lakeEditor';
	private readonly _previews = new Set<BasePreview>();
	private _activePreview: BasePreview | null = null;
  lakePreview: LakePreview;

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

	getPreviewByDocument(document: vscode.CustomDocument, webviewEditor: vscode.WebviewPanel): BasePreview {
		// document.uri.path
		switch (path.extname(document.uri.path).toLowerCase()) {
			case '.lake':
				return new LakePreview(this.extensionRoot, document.uri, webviewEditor);
			default:
				break;
		}

		return null as BasePreview;
	}

  async getFileData() {
    console.info('lakePreview', this.lakePreview);
    if(!this.lakePreview) {
      return new Uint8Array();
    }
    const content = await this.lakePreview.getContent();
    console.info('content', content);
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
		// const preview = this.getPreviewByDocument(document, webviewEditor);
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

    this._register(this.lakePreview.onSave(() => {
      // Tell VS Code that the document has been edited by the use.
      this.saveCustomDocument(document, new vscode.CancellationTokenSource().token);
    }));

		this._previews.add(this.lakePreview);
		this.setActivePreview(this.lakePreview);

		webviewEditor.onDidDispose(() => { this._previews.delete(this.lakePreview); });

		webviewEditor.onDidChangeViewState(() => {
			if (webviewEditor.active) {
				this.setActivePreview(this.lakePreview);
			} else if (this._activePreview === this.lakePreview && !webviewEditor.active) {
				this.setActivePreview(undefined);
			}
		});
	}

	public get activePreview() { return this._activePreview; }

	private setActivePreview(value: BasePreview | undefined): void {
		this._activePreview = value;
		this.setPreviewActiveContext(!!value);
	}

	private setPreviewActiveContext(value: boolean) {
		// vscode.commands.executeCommand('setContext', 'blpPreviewFocus', value);
	}
}
