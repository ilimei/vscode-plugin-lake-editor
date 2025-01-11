import * as vscode from 'vscode';
import MessageServer from '../common/message-server';
import { Disposable } from '../common/dispose';

export enum ViewState {
    disposed,
    visible,
    active,
}

function isMac(): boolean {
    if (typeof process === 'undefined') {
        return false;
    }
    return process.platform === 'darwin';
}

function escapeAttribute(value: string | vscode.Uri): string {
    return value.toString().replace(/"/g, '&quot;');
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 64; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


export default class BasePreview extends Disposable {
    protected readonly id: string = `${Date.now()}-${Math.random().toString()}`;

    private readonly _onDispose = this._register(new vscode.EventEmitter<void>());
    public readonly onDispose = this._onDispose.event;

    protected _previewState = ViewState.visible;
    protected _imageBinarySize: number = 0;
    protected message: MessageServer;
    protected nonce = getNonce();

    constructor(
        protected readonly extensionRoot: vscode.Uri,
        protected readonly resource: vscode.Uri,
        protected readonly webviewEditor: vscode.WebviewPanel,
    ) {
        super();
        const resourceRoot = resource.with({
            path: resource.path.replace(/\/[^\/]+?\.\w+$/, '/'),
        });
        webviewEditor.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                resourceRoot,
                extensionRoot,
            ]
        };

        this.message = new MessageServer(webviewEditor.webview, resource, resourceRoot);

        this._register(webviewEditor.webview.onDidReceiveMessage(message => {
            this.onMessage(message);
        }));

        this._register(webviewEditor.onDidChangeViewState((e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
            this.update(e.webviewPanel.active);
        }));

        this._register(webviewEditor.onDidDispose(() => {
            if (this._previewState === ViewState.active) {
                this.onDisposed();
            }
            this._previewState = ViewState.disposed;
            this._onDispose.fire();
            this.dispose();
        }));

        const watcher = this._register(vscode.workspace.createFileSystemWatcher(resource.fsPath));
        this._register(watcher.onDidChange(e => {
            if (e.toString() === this.resource.toString()) {
                this.render();
            }
        }));
        this._register(watcher.onDidDelete(e => {
            if (e.toString() === this.resource.toString()) {
                this.webviewEditor.dispose();
            }
        }));

        this._register(this.message.onSizeChange(size => {
            this._imageBinarySize = size;
            this.update(true);
        }));

        this.init();
        this.render();
        this.update(true);
        this.message.callClient('setActive');
    }

    protected init() {

    }

    get resourceUri() {
        return this.resource;
    }

    protected getTitle(): string {
        return '';
    }

    protected getCSSSource(): string[] {
        return [];
    }

    protected getJSSource(): string[] {
        return [];
    }

    protected getHTMLTemplate(): string {
        return '';
    }

    protected onMessage(message: any) {
        this.message?.onMessage(message, this);
    }

    protected onActive() {

    }

    protected onUnActive() {
    }

    protected onVisible() {

    }

    protected onDisposed() {

    }

    protected update(isActive: boolean = false) {
        if (this._previewState === ViewState.disposed) {
            return;
        }

        if (!isActive && this._previewState === ViewState.active) {
            this.onUnActive();
        }

        if (this.webviewEditor.active && isActive && this._previewState !== ViewState.active) {
            this._previewState = ViewState.active;
            this.onActive();
        } else {
            if (this._previewState === ViewState.active) {
                this.onVisible();
            }
            this._previewState = ViewState.visible;
        }

    }

    private async getWebviewContents() {
        const settings = {
            isMac: isMac(),
        };

        const nonce = this.nonce;

        return /* html */`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">

        <!-- Disable pinch zooming -->
        <meta name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">

        <title>${this.getTitle()}</title>
        ${this.getCSSSource().map(source => {
            return `<link rel="stylesheet" href="${escapeAttribute(this.extensionResource(source))}" type="text/css" media="screen" nonce="${nonce}">`;
        }).join('\n')
            }
        <meta name='referrer' content='never'>
        <meta id="image-preview-settings" data-settings="${escapeAttribute(JSON.stringify(settings))}">
        <script type="text/javascript" nonce="${nonce}">
            window.isDarkMode = ${vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'true' : 'false'};
            window.extensionResourceURI = ${JSON.stringify(this.extensionResource('/media').toString())};
            window.currentResourceURI = ${JSON.stringify(this.resource)};
            window.vscode = acquireVsCodeApi();
        </script>
    </head>
    <body>
        ${this.getHTMLTemplate()}
        ${this.getJSSource().map(source => {
                return `<script src="${escapeAttribute(this.extensionResource(source))}" nonce="${nonce}"></script>`;
            }).join('\n')}
    </body>
    </html>`;
    }

    public async getExtensionResource(path: string) {
        return escapeAttribute(this.extensionResource(path));
    }

    private extensionResource(path: string) {
        if (path.startsWith('http')) {
            return path;
        }
        return this.webviewEditor.webview.asWebviewUri(this.extensionRoot.with({
            path: this.extensionRoot.path + path
        }));
    }

    private async render() {
        if (this._previewState !== ViewState.disposed) {
            this.webviewEditor.webview.html = await this.getWebviewContents();
        }
    }
}
