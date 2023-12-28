import * as vscode from 'vscode';
import { Disposable } from '../../common/dispose';
import LakeBookTreeProvider from '../../tree-provider/lakebool-tree-provider';

export interface LakeDocumentDelegate {
	getFileData(): Promise<Uint8Array>;
}

export default class LakeDocument extends Disposable implements vscode.CustomDocument {
	static async create(
		uri: vscode.Uri,
		backupId: string | undefined,
	): Promise<LakeDocument | PromiseLike<LakeDocument>> {
		const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
		return new LakeDocument(uri, dataFile);
	}

	private static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		if (uri.scheme === 'untitled') {
			return new Uint8Array();
		}
		if(uri.scheme === 'lake') {
			return LakeBookTreeProvider.getLakeURIContent(uri);
		}
		return new Uint8Array(await vscode.workspace.fs.readFile(uri));
	}

	private delegate: LakeDocumentDelegate;

	constructor(public readonly uri: vscode.Uri, private _dataURI: vscode.Uri) {
		super();
	}

	setDelegate(delegate: LakeDocumentDelegate) {
		this.delegate = delegate;
	}

	async content() {
		return await LakeDocument.readFile(this._dataURI);
	}

	dispose(): void {
		this._onDidDispose.fire();
		super.dispose();
	}

	private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	public readonly onDidDispose = this._onDidDispose.event;

	private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
		readonly content?: Uint8Array;
	}>());
	public readonly onDidChangeContent = this._onDidChangeDocument.event;

	private readonly _onDidChange = this._register(new vscode.EventEmitter<{}>());
	public readonly onDidChange = this._onDidChange.event;

	/**
	 * Called by VS Code when the user saves the document.
	 */
	async save(cancellation: vscode.CancellationToken): Promise<void> {
		await this.saveAs(this.uri, cancellation);
	}

	/**
	 * Called by VS Code when the user saves the document to a new location.
	 */
	async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
		const fileData = await this.delegate.getFileData();
		if (cancellation.isCancellationRequested) {
			return;
		}
		await vscode.workspace.fs.writeFile(targetResource, fileData);
	}

	/**
	 * Called by VS Code when the user calls `revert` on a document.
	 */
	async revert(_cancellation: vscode.CancellationToken): Promise<void> {
		const diskContent = await LakeDocument.readFile(this.uri);
		this._onDidChangeDocument.fire({
			content: diskContent,
		});
	}

	/**
	 * Called by VS Code to backup the edited document.
	 *
	 * These backups are used to implement hot exit.
	 */
	async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
		await this.saveAs(destination, cancellation);

		return {
			id: destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(destination);
				} catch {
					// noop
				}
			}
		};
	}
}
