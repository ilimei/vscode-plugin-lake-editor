/**
 * vscode 服务端的message处理
 */
import * as vscode from 'vscode';
import { Request } from './message-client';

export default class MessageServer {

    maxDeep = 0;
    size = 0;
    rootFolder: vscode.Uri;
    requestsMap: { [key: string]: Request } = {};

    private _onSizeChange: vscode.EventEmitter<number> = new vscode.EventEmitter<number>();
    readonly onSizeChange: vscode.Event<number> = this._onSizeChange.event;

    constructor(
        private webview: vscode.Webview,
        private resource: vscode.Uri,
        private resourceRoot: vscode.Uri,) {
        const rootFolder = vscode.workspace.workspaceFolders?.find(v => {
            return this.resourceRoot.path.startsWith(v.uri.path);
        });
        this.rootFolder = rootFolder?.uri;
        this.maxDeep = this.resourceRoot.path.split('/').length - 1;
    }

    async load() {
      const buf = await vscode.workspace.fs.readFile(this.resource);
      const imgPath = this.resource.fsPath;
      const extName = imgPath.split(/\./g).pop();
      this.size = buf.length;
      this._onSizeChange.fire(this.size);
      return { ext: extName, buf: new Uint8Array(buf).buffer };
    }

    async onMessage(message: { type: string, requestId: number, data: any }) {
        console.info('server onMessage', message);
        if (this.requestsMap[message.requestId]) {
            this.requestsMap[message.requestId].resolve(message.data);
            delete this.requestsMap[message.requestId];
            return;
        }
        if(message.type) {
          if (!this[message.type] || typeof this[message.type] !== 'function') {
              throw new Error(`message.type ${message.type} method not found`);
          }
          if (this[message.type]) {
              const ret = await this[message.type](message.data);
              this.webview.postMessage({ requestId: message.requestId, data: ret });
          }
        }
    }

    async undo() {
      return this._trans('undo');
    }

    async redo() {
      return this._trans('redo');
    }

    async getContent(): Promise<Uint8Array> {
      return this._trans('getContent');
    }

    async updateContent(content?: Uint8Array) {
      return this._trans('updateContent', content);
    }

    _trans(type: string, data: any = null, timeout: number = -1): any {
      const requestId = 'server_' + parseInt((Math.random() + '').slice(2), 10);
      const request: Request = {
          requestId,
          resolve: () => { },
      };
      const p = new Promise((resolve, reject) => {
          request.resolve = resolve;
          if (timeout > 0) {
              setTimeout(() => {
                  delete this.requestsMap[requestId];
                  reject(`call method ${type} data=${data} timeout ${timeout}`);
              }, timeout);
          }
      });
      this.requestsMap[requestId] = request;
      this.webview.postMessage({
          type,
          requestId,
          data,
      });
      return p;
  }
}
