import * as vscode from 'vscode';

import BasePreview from "./base-preview";
import htmlTemplate from './lake-preview/index.html';

export default class LakePreview extends BasePreview {
  private readonly _onDidChange = this._register(new vscode.EventEmitter<{}>());
	/**
	 * Fired to tell VS Code that an edit has occurred in the document.
	 *
	 * This updates the document's dirty indicator.
	 */
	public readonly onDidChange = this._onDidChange.event;

  private readonly _onReady = this._register(new vscode.EventEmitter<{}>());
	/**
	 * Fired to tell VS Code that an edit has occurred in the document.
	 *
	 * This updates the document's dirty indicator.
	 */
	public readonly onReady = this._onReady.event;

  private readonly _onSave = this._register(new vscode.EventEmitter<{}>());
	/**
	 * Fired to tell VS Code that an edit has occurred in the document.
	 *
	 * This updates the document's dirty indicator.
	 */
	public readonly onSave = this._onSave.event;

  getCssSource(): string[] {
      return [
          'https://unpkg.com/antd@4.24.13/dist/antd.css',
          'https://gw.alipayobjects.com/render/p/yuyan_npm/@alipay_lakex-doc/1.11.0/umd/doc.css',
      ];
  }

  getJSSource(): string[] {
      return [
        'https://unpkg.com/react@18/umd/react.production.min.js',
        'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
        'https://gw.alipayobjects.com/render/p/yuyan_npm/@alipay_lakex-doc/1.11.0/umd/doc.umd.js',
        '/media/message.js',
        '/media/lake-preview.js'
      ];
  }

  getHTMLTemplate() {
      return htmlTemplate;
  }

  onMessage(message: any): void {
      switch (message.type) {
          case 'contentchange':
              this._onDidChange.fire({});
              break;
          case 'ready':
              this._onReady.fire({});
              break;
          case 'save':
              this._onSave.fire({});
              break;
          default:
              super.onMessage(message);
              break;
      }
  }

  async undo() {
    return this.message.undo();
  }

  async redo() {
    return this.message.redo();
  }

  async getContent() {
    return this.message.getContent();
  }

  async updateContent(content?: Uint8Array) {
    return this.message.updateContent(content);
  }
}
