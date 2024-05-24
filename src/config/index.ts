import * as vscode from 'vscode';

export class LakeEditorConfig {
  config: vscode.WorkspaceConfiguration;

  constructor(name: string) {
    this.config = vscode.workspace.getConfiguration(name);
  }

  get showTitle(): boolean {
    return this.config.get('showTitle');
  }

  get showToolbar(): boolean {
    return this.config.get('showToolbar');
  }

  get defaultFontSize(): number {
    return this.config.get('defaultFontSize');
  }

  get paragraphSpacing(): boolean {
    return this.config.get('paragraphSpacing');
  }
}

export function getConfig() {
  return new LakeEditorConfig('lakeEditor');
}
