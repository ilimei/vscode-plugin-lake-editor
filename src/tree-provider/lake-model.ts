/* eslint-disable @typescript-eslint/naming-convention */

import * as vscode from 'vscode';
import * as path from 'path';
import Tar from 'tar';
import Yaml from 'yaml';
import { mkdirSync, writeFileSync } from 'fs';

export interface ILakeNode {
  title: string;
  type: 'DOC' | 'TITLE';
  sourceUri: vscode.Uri;
  nodes?: ILakeNode[];
}

export interface IMetaData {
  meta: string;
  meta_digest: string;
}

export interface IMetaConfig {
  book: {
    path: string;
    public: 0 | 1;
    tocYml: string;
    type: string;
  },
  config: {
    endecryptType: number;
  },
  docs: [],
  version: string;
}

export interface IToc {
  type: 'DOC' | 'TITLE';
  title: string;
  uuid: string;
  url: string;
  prev_uuid: string;
  sibling_uuid: string;
  child_uuid: ''
  parent_uuid: string;
  doc_id: number;
  level: number;
  id: number;
  open_window: number;
  visible: number;
}

export interface IDocEntry {
  doc: {
    body: string;
    body_asl: string;
    body_draft: string;
    body_draft_asl: string;
    content_updated_at: string;
    cover?: string;
    custom_cover?: string | null;
    created_at: string;
    custom_description?: string | null;
    description: string;
    editor_meta: string;
    first_published_at: string;
    format: string;
    id: number;
    public: number;
    published_at: string;
    slug: string;
    status: number;
    title: string;
    updated_at: string;
    user_id: number;
    word_count: number;
  },
  doc_digest: string;
}

export class ILakeTocNode implements ILakeNode {
  nodes: ILakeTocNode[] = [];

  constructor(private _toc: IToc, private _uri: vscode.Uri) {
  }

  public get id() {
    return this._toc.id;
  }

  public get uuid() {
    return this._toc.uuid;
  }

  public get url() {
    return this._toc.url;
  }

  public get title() {
    return this._toc.title;
  }

  public get sourceUri() {
    return this._uri;
  }

  public get type() {
    return this._toc.type;
  }
}

export class LakeRoot implements ILakeNode {
  private _paths: string[] = [];
  private _entries: Tar.ReadEntry[] = [];
  private _title: string;
  private nodeMap: Map<string, ILakeTocNode> = new Map();
  private childNodes: ILakeTocNode[] = [];

  static map: Map<string, LakeRoot> = new Map();
  private promise: Promise<void>;

  static normalUri(uri: vscode.Uri) {
    if (uri.scheme === 'lake') {
      return uri.with({
        scheme: 'file',
        path: uri.path.replace(/\.lakebook.*$/, '.lakebook'),
      });
    }
    return uri;
  }

  static getLakeRoot(uri: vscode.Uri) {
    const normalUri = LakeRoot.normalUri(uri);
    const lakeRoot = LakeRoot.map.get(normalUri.toString());
    if (lakeRoot) {
      return lakeRoot;
    } else {
      const root = new LakeRoot(normalUri);
      LakeRoot.map.set(normalUri.toString(), root);
      return root;
    }
  }

  static removeLakeRoot(uri: vscode.Uri) {
    const lakeRoot = LakeRoot.map.get(uri.toString());
    if (lakeRoot) {
      LakeRoot.map.delete(uri.toString());
    }
  }

  constructor(private _uri: vscode.Uri) {
    try {
      let metaDataStr = '';
      this._title = path.basename(this._uri.fsPath);
      this.promise = new Promise((resolve) => {
        Tar.list({
          file: this._uri.fsPath,
          onentry: (entry: Tar.ReadEntry) => {
            this._entries.push(entry);
            this._paths.push(entry.path);
            if (entry.path.endsWith('$meta.json')) {

              entry.on('data', chunk => {
                metaDataStr += chunk.toString();
              });

              entry.on('end', () => {
                // console.log(metaDataStr); // Here is your string
              });
            }
          },
          sync: true,
        });
        resolve();
      });

      const metaData = JSON.parse(metaDataStr) as IMetaData;
      const metaConfig = JSON.parse(metaData.meta) as IMetaConfig;
      const tocs = Yaml.parse(metaConfig.book.tocYml) as IToc[];
      for (const toc of tocs) {
        const node = new ILakeTocNode(toc, this._uri);
        this.nodeMap.set(toc.uuid, node);
        if (toc.level === 0) {
          this.childNodes.push(node);
        } else if (toc.parent_uuid) {
          const parentNode = this.nodeMap.get(toc.parent_uuid);
          if (parentNode) {
            parentNode.nodes.push(node);
          }
        }
      }
    } catch (e) {
      vscode.window.showErrorMessage(e.toString());
    }
  }

  public get title() {
    return this._title;
  }

  public get type() {
    return 'TITLE' as const;
  }

  public get sourceUri() {
    return this._uri;
  }

  public get nodes() {
    return this.childNodes;
  }

  public async getContent(uri: vscode.Uri): Promise<Uint8Array> {
    await this.promise;
    const entry = this._entries.find(entry => entry.path.endsWith(uri.query));
    if (entry) {
      return new Promise((resolve, reject) => {
        Tar.list({
          sync: true,
          file: LakeRoot.normalUri(this._uri).fsPath,
          filter(path, entry) {
            return path.endsWith(uri.query);
          },
          onentry: (entry: Tar.ReadEntry) => {
            let dataStr = '';
            entry.on('data', chunk => {
              dataStr += chunk.toString();
            });

            entry.on('end', () => {
              try {
                const docEntry = JSON.parse(dataStr) as IDocEntry;
                resolve(new TextEncoder().encode(docEntry.doc.body_asl));
              } catch (e) {
                reject(e);
              }
            });
          }
        });
      });
    }
    return new Uint8Array();
  }
}

export class LakeBookModel {
  private _lakeRoots: LakeRoot[];

  constructor() {
    this._lakeRoots = [];
  }

  public get roots() {
    return this._lakeRoots;
  }

  public openLakeBook(fileUri: vscode.Uri) {
    this._lakeRoots.push(LakeRoot.getLakeRoot(fileUri));
  }

  public unzipLakeBook(fileUri: vscode.Uri) {
    const root = LakeRoot.getLakeRoot(fileUri);
    return this.unzipNode(root, path.dirname(fileUri.fsPath));
  }

  public async unzipNode(node: ILakeTocNode | LakeRoot, parentDir: string) {
    if (node.nodes?.length > 0 || node.type === 'TITLE') {
      parentDir = path.resolve(parentDir, node.title.replace('\.lakebook', ''));
      mkdirSync(parentDir, { recursive: true });
    }
    if (node.type === 'DOC') {
      const content = await this.getLakeRootContent(node.sourceUri.with({
        scheme: 'lake',
        path: path.join(node.sourceUri.path.replace(/^\/([^:+]:)/, '$1'), node.title),
        query: node.url + '.json',
      }));
      writeFileSync(path.resolve(parentDir, node.title + '.lake'), content);
    }
    if (node.nodes?.length > 0) {
      await Promise.all(node.nodes.map(childNode => this.unzipNode(childNode, parentDir)));
    }
  }

  public getLakeRootContent(uri: vscode.Uri) {
    const root = LakeRoot.getLakeRoot(uri);
    return root.getContent(uri);
  }

  static async getLakeURIContent(uri: vscode.Uri) {
    const root = LakeRoot.getLakeRoot(uri);
    return root.getContent(uri);
  }
}
