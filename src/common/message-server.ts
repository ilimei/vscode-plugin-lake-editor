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

    async onMessage(message: { type: string, requestId: number, data: any }, context: any) {
        if (this.requestsMap[message.requestId]) {
            this.requestsMap[message.requestId].resolve(message.data);
            delete this.requestsMap[message.requestId];
            return;
        }
        if(message.type) {
          if (!context[message.type] || typeof context[message.type] !== 'function') {
              throw new Error(`message.type ${message.type} method not found`);
          }
          if (context[message.type]) {
              const ret = await context[message.type](message.data);
              this.webview.postMessage({ requestId: message.requestId, data: ret });
          }
        }
    }

    public callClient(type: string, data: any = null, timeout: number = -1): any {
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
