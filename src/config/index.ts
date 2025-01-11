import * as vscode from 'vscode';

export class LakeEditorConfig {
  constructor(private name: string) {
  }

  get config() {
    return vscode.workspace.getConfiguration(this.name);
  }

  get showTitle(): boolean {
    return this.config.get('showTitle');
  }

  get showToc(): boolean {
    return this.config.get('showToc');
  }

  get showToolbar(): boolean {
    return this.config.get('showToolbar');
  }

  get formatLake(): boolean {
    return this.config.get('formatLake');
  }

  get uploadImageToGithub(): boolean {
    return this.config.get('uploadImageToGithub');
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
