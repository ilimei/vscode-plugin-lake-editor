import * as vscode from 'vscode';
import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/types";
import { randomUUID } from 'crypto';

function isRequestError(err: any): err is RequestError {
    return err.status !== 200;
}

export class GithubCore {
    session: vscode.AuthenticationSession | undefined;
    octokit: Octokit | undefined;
    repo: {
        id: number;
        node_id: string;
        name: string;
        full_name: string;
    } | undefined;

    async getSession() {
        if (this.octokit) {
            return true;
        }
        try {
            const session = await vscode.authentication.getSession('github', ['user:email', 'repo', 'gist'], { createIfNone: true });
            if (session) {
                this.session = session;
                this.octokit = new Octokit({
                    auth: session.accessToken,
                    log: console,
                });
                vscode.window.showInformationMessage(`Authenticated as ${session.account.label}`);
                return true;
            } else {
                vscode.window.showErrorMessage('Authentication failed');
                return false;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Authentication error: ${error.message}`);
            return false;
        }
    }

    async gitRepo() {
        if (!this.session && !await this.getSession()) {
            return false;
        }
        const repo = await this.octokit?.repos.get({
            owner: this.session.account.label,
            repo: 'vscode-lake-images',
        }).catch(err => {
            return err as RequestError;
        });
        if (!isRequestError(repo)) {
            this.repo = repo.data;
            return true;
        }
        const data = await this.octokit?.repos.createForAuthenticatedUser({
            name: 'vscode-lake-images',
            description: 'Images for vscode-lake',
            auto_init: true,
            private: false,
        }).catch(err => {
            return err as RequestError;
        });
        if (isRequestError(data)) {
            if (data.status === 201) {
                const repo = await this.octokit?.repos.get({
                    owner: this.session.account.label,
                    repo: 'vscode-lake-images',
                }).catch(err => {
                    return err as RequestError;
                });
                if (!isRequestError(repo)) {
                    this.repo = repo.data;
                    vscode.window.showInformationMessage(`Create repo success: ${repo.data.full_name}`);
                    return true;
                }
            }
            vscode.window.showErrorMessage(`Create repo failed: ${data.status} ${data.errors?.map(v => v.message) || ''}`);
            return false;
        }
        this.repo = data.data;
        return true;
    }

    async uploadImage(base64: string) {
        if (!this.repo && !await this.gitRepo()) {
            return;
        }
        const date = new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + new Date().getDate();
        const path = `${date}/${randomUUID()}.png`;
        const ret = await this.octokit?.repos.createOrUpdateFileContents({
            path: path,
            owner: this.session!.account.label,
            repo: 'vscode-lake-images',
            message: 'upload image',
            content: base64,
        }).catch(err => {
            console.error(err);
            return err as RequestError & { message: string };
        });
        if (ret.status === 201) {
            return `https://github.com/${this.session!.account.label}/vscode-lake-images/raw/main/${path}`;
        }
        if (isRequestError(ret)) {
            vscode.window.showErrorMessage(`Upload image failed: ${ret.status} ${ret.errors?.map(v => v.message) || ret.message || ''}`);
            return false;
        }
        return ret.data.content?.download_url;
    }
}

export function getGithubCore() {
    return new GithubCore();
}
