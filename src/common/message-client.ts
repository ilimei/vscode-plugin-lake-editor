
export interface Request {
  requestId: number | string;
  resolve: (data: any) => void;
}

export default class Message {

  timeout: Request[] = [];
  requestsMap: { [key: string]: Request } = {};

  constructor() {
      window.addEventListener('message', async e => {
          if (this.requestsMap[e.data.requestId]) {
              this.requestsMap[e.data.requestId].resolve(e.data.data);
              delete this.requestsMap[e.data.requestId];
          }
      });
  }

  async load(): Promise<{ buf: Buffer, ext: string }> {
      return await this._trans('load');
  }

  _trans(type: string, data: any = null, timeout: number = -1): any {
      const requestId = parseInt((Math.random() + '').slice(2), 10);
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
      // @ts-ignore
      vscode.postMessage({
          type,
          requestId,
          data,
      });
      return p;
  }
}

// @ts-ignore
window.message = new Message();
