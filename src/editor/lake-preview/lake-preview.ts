import * as vscode from 'vscode';
import * as path from 'path';

import BasePreview from "../base-preview";
import htmlTemplate from './index.html';
import { getConfig } from '../../config';

export default class LakePreview extends BasePreview {
  private readonly _onDidChange = this._register(new vscode.EventEmitter<void>());
  public readonly onDidChange = this._onDidChange.event;

  private readonly _onReady = this._register(new vscode.EventEmitter<void>());
  public readonly onReady = this._onReady.event;

  private readonly _onSave = this._register(new vscode.EventEmitter<void>());
  public readonly onSave = this._onSave.event;

  config = getConfig();

  getCSSSource(): string[] {
    return [
      '/media/editor/antd.4.24.13.css',
      '/media/editor/doc.css',
    ];
  }

  getJSSource(): string[] {
    return [
      '/media/editor/react.production.min.js',
      '/media/editor/react-dom.production.min.js',
      '/media/editor/doc.umd.js',
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
        this._onDidChange.fire();
        break;
      case 'ready':
        this._onReady.fire();
        break;
      case 'save':
        this._onSave.fire();
        break;
      default:
        super.onMessage(message);
        break;
    }
  }

  async getWorkspaceFileUri(path: string) {
    if (!vscode.workspace.workspaceFolders) {
      return null;
    }
    for (const folder of vscode.workspace.workspaceFolders) {
      const uri = folder.uri.with({ path: folder.uri.path + '/' + path });
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.File) {
          return uri;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  async openFileAtPosition(filePath: string, line: number, column: number) {
    try {
      const finalURI = path.isAbsolute(filePath) ? vscode.Uri.parse(filePath) : await this.getWorkspaceFileUri(filePath);
      if (!finalURI) {
        return;
      }
      const stat = await vscode.workspace.fs.stat(finalURI);
      if (stat.type === vscode.FileType.File) {
        await vscode.commands.executeCommand('vscode.open', finalURI);
        if (vscode.window.activeTextEditor && line > 0) {
          const position = new vscode.Position(line - 1, column - 1);
          vscode.window.activeTextEditor.selection = new vscode.Selection(position, position);
          vscode.window.activeTextEditor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * 
   * @param href 文件路径 例如 xxx.md:2:3 或者 http链接
   */
  async visitLink(href: string) {
    if (href.startsWith('http')) {
      await vscode.env.openExternal(vscode.Uri.parse(href));
      return;
    }
    const result = href.match(/^(.+?)(:\d+)?(:\d+)?$/);
    if (result) {
      const [, filePath, line, column] = result;
      if (filePath) {
        this.openFileAtPosition(filePath, line ? Number(line.slice(1)) : 0, column ? Number(column.slice(1)) : 1);
        return;
      }
    }
  }

  async getConfig() {
    return {
      showToc: this.config.showToc,
      showTitle: this.config.showTitle,
      showToolbar: this.config.showToolbar,
      defaultFontSize: this.config.defaultFontSize,
      paragraphSpacing: this.config.paragraphSpacing,
    };
  }

  async onActive() {
    return this.message.callClient('setActive');
  }

  async windowStateChange(focused: boolean) {
    return this.message.callClient('windowStateChange', { active: this.webviewEditor.active && focused });
  }

  async undo() {
    return this.message.callClient('undo');
  }

  async redo() {
    return this.message.callClient('redo');
  }

  async switchTheme() {
    return this.message.callClient('switchTheme', { isDark: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark });
  }

  async getContent(): Promise<Uint8Array> {
    return this.message.callClient('getContent');
  }

  async updateContent(content?: Uint8Array) {
    return this.message.callClient('updateContent', content);
  }

  async uploadImage(data: Uint8Array) {
    const newPath = path.join(path.dirname(this.resource.fsPath), 'image.png');
    const targetResource = this.resource.with({ path: newPath });
    await vscode.workspace.fs.writeFile(targetResource, data);
    return {
      size: data.length,
      url: this.webviewEditor.webview.asWebviewUri(targetResource).toString().replace(/"/g, '&quot;'),
      filename: 'image.png',
    };
  }
}
