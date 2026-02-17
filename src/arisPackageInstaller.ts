import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';
import { path7za } from '7zip-bin';
import { PackageInstallSource } from './packageSearchService';

interface DownloadResult {
  content: string;
  resolvedVersion: string;
  sourceUrl?: string;
}

interface GitHubRelease {
  tag_name: string;
  zipball_url: string;
  assets?: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

interface GitHubRefResolution {
  ref: string;
  versionLabel: string;
  release?: GitHubRelease;
}

export interface PackageInstallResult {
  installedPath: string;
  resolvedVersion: string;
  sourceUrl?: string;
}

/**
 * Installs packages from Aris-compatible sources.
 */
export class ArisPackageInstaller {
  private readonly execFileAsync = promisify(execFile);
  private readonly userAgent = 'AHK-Converter-VSCode-Extension';

  public async installPackageToPath(
    packageName: string,
    source: PackageInstallSource,
    targetPath: string
  ): Promise<PackageInstallResult> {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    let result: DownloadResult;
    switch (source.type) {
      case 'github':
        result = await this.downloadFromGitHub(packageName, source);
        break;
      case 'gist':
        result = await this.downloadFromGist(source);
        break;
      case 'forums':
        result = await this.downloadFromForums(source);
        break;
      case 'archive':
        result = await this.downloadFromArchive(packageName, source);
        break;
      case 'ahk':
        result = await this.downloadFromAhkUrl(source);
        break;
      default:
        throw new Error(`Unsupported package source type: ${(source as { type: string }).type}`);
    }

    await fs.writeFile(targetPath, result.content, 'utf-8');

    return {
      installedPath: targetPath,
      resolvedVersion: result.resolvedVersion,
      sourceUrl: result.sourceUrl
    };
  }

  private async downloadFromAhkUrl(source: PackageInstallSource): Promise<DownloadResult> {
    if (!source.url) {
      throw new Error('AHK source URL is missing');
    }

    const content = await this.fetchText(source.url, {
      'Accept': 'text/plain,application/octet-stream,*/*'
    });

    return {
      content,
      resolvedVersion: source.version || 'latest',
      sourceUrl: source.url
    };
  }

  private async downloadFromGist(source: PackageInstallSource): Promise<DownloadResult> {
    if (!source.gistId) {
      throw new Error('Gist id is missing');
    }

    const gistApiUrl = `https://api.github.com/gists/${encodeURIComponent(source.gistId)}`;
    const gistResponse = await this.fetchJson(gistApiUrl, this.getGitHubHeaders());

    if (!this.isRecord(gistResponse) || !this.isRecord(gistResponse.files)) {
      throw new Error(`Gist ${source.gistId} response did not include files`);
    }

    const files = Object.entries(gistResponse.files)
      .filter((entry): entry is [string, Record<string, unknown>] => this.isRecord(entry[1]))
      .map(([key, value]) => ({
        key,
        filename: typeof value.filename === 'string' ? value.filename : key,
        rawUrl: typeof value.raw_url === 'string' ? value.raw_url : '',
        content: typeof value.content === 'string' ? value.content : undefined,
        truncated: value.truncated === true,
        language: typeof value.language === 'string' ? value.language : ''
      }));

    if (files.length === 0) {
      throw new Error(`Gist ${source.gistId} has no files`);
    }

    const requestedFile = source.gistFile?.trim().toLowerCase();
    let selected = files[0];

    if (requestedFile) {
      const exact = files.find(file => file.key.toLowerCase() === requestedFile || file.filename.toLowerCase() === requestedFile);
      if (!exact) {
        throw new Error(`File ${source.gistFile} was not found in gist ${source.gistId}`);
      }
      selected = exact;
    } else {
      const preferred = files.find(file => /\.(ahk|ahk2|ah2)$/i.test(file.filename));
      if (preferred) {
        selected = preferred;
      }
    }

    const content = selected.content && !selected.truncated
      ? selected.content
      : await this.fetchText(selected.rawUrl, {
        'Accept': 'text/plain,application/octet-stream,*/*'
      });

    const resolvedVersion = this.extractGistVersion(gistResponse) || source.version || 'latest';

    return {
      content,
      resolvedVersion,
      sourceUrl: selected.rawUrl || `https://gist.github.com/${source.gistId}`
    };
  }

  private async downloadFromForums(source: PackageInstallSource): Promise<DownloadResult> {
    const threadUrl = source.url || (source.threadId ? this.buildForumsUrl(source.threadId, source.start, source.post) : undefined);
    if (!threadUrl) {
      throw new Error('Forums source is missing thread URL or thread id');
    }

    const html = await this.fetchText(threadUrl, {
      'Accept': 'text/html,application/xhtml+xml,*/*'
    }, true);

    const codeMatches = Array.from(html.matchAll(/<code\s+[^>]*>([\s\S]*?)<\/code>/gi));
    if (codeMatches.length === 0) {
      throw new Error('No code blocks were found in the forums thread');
    }

    const codeIndex = Math.max(1, source.codeBox || 1) - 1;
    if (!codeMatches[codeIndex]) {
      throw new Error(`Requested code box ${codeIndex + 1} was not found in the forums thread`);
    }

    const decodedCode = this.decodeHtmlEntities(codeMatches[codeIndex][1]);

    return {
      content: decodedCode,
      resolvedVersion: source.version || 'latest',
      sourceUrl: threadUrl
    };
  }

  private async downloadFromArchive(packageName: string, source: PackageInstallSource): Promise<DownloadResult> {
    if (!source.url) {
      throw new Error('Archive source URL is missing');
    }

    const preferredPaths = [source.main, ...(source.files || [])]
      .filter((value): value is string => Boolean(value));

    const archiveResult = await this.downloadAndExtractArchive(source.url, packageName, preferredPaths);

    return {
      content: archiveResult.content,
      resolvedVersion: source.version || 'latest',
      sourceUrl: source.url
    };
  }

  private async downloadFromGitHub(packageName: string, source: PackageInstallSource): Promise<DownloadResult> {
    if (!source.repository) {
      throw new Error('GitHub repository is missing from source metadata');
    }

    const [owner, repoName] = source.repository.split('/');
    if (!owner || !repoName) {
      throw new Error(`Invalid GitHub repository format: ${source.repository}`);
    }

    const refResolution = await this.resolveGitHubRef(owner, repoName, source);

    if (refResolution.release?.assets?.length) {
      const ahkAsset = refResolution.release.assets.find(asset => /\.(ahk|ahk2|ah2)$/i.test(asset.name));
      if (ahkAsset) {
        const content = await this.fetchText(ahkAsset.browser_download_url, this.getGitHubHeaders());
        return {
          content,
          resolvedVersion: refResolution.versionLabel,
          sourceUrl: ahkAsset.browser_download_url
        };
      }
    }

    const candidatePaths = this.buildGitHubPathCandidates(packageName, repoName, source);
    for (const candidate of candidatePaths) {
      const encodedPath = this.encodeGitHubPath(candidate);
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${encodeURIComponent(refResolution.ref)}/${encodedPath}`;
      try {
        const content = await this.fetchText(rawUrl, {
          ...this.getGitHubHeaders(),
          'Accept': 'text/plain,application/octet-stream,*/*'
        });

        if (content.trim()) {
          return {
            content,
            resolvedVersion: refResolution.versionLabel,
            sourceUrl: rawUrl
          };
        }
      } catch {
        // Try next candidate path.
      }
    }

    const archiveUrls = this.buildGitHubArchiveCandidates(owner, repoName, refResolution, source);
    for (const archiveUrl of archiveUrls) {
      try {
        const archiveResult = await this.downloadAndExtractArchive(archiveUrl, packageName, candidatePaths);
        return {
          content: archiveResult.content,
          resolvedVersion: refResolution.versionLabel,
          sourceUrl: archiveUrl
        };
      } catch {
        // Try next archive URL.
      }
    }

    throw new Error(`Unable to download package ${source.repository} using ref ${refResolution.ref}`);
  }

  private async resolveGitHubRef(owner: string, repo: string, source: PackageInstallSource): Promise<GitHubRefResolution> {
    const requestedVersion = source.version?.trim();

    if (requestedVersion && this.isCommitHash(requestedVersion)) {
      return {
        ref: requestedVersion,
        versionLabel: requestedVersion
      };
    }

    if (requestedVersion && requestedVersion.toLowerCase() !== 'latest') {
      const releases = await this.getGitHubReleases(owner, repo);
      const matchedRelease = this.findMatchingRelease(releases, requestedVersion);
      if (matchedRelease) {
        return {
          ref: matchedRelease.tag_name,
          versionLabel: matchedRelease.tag_name,
          release: matchedRelease
        };
      }

      return {
        ref: requestedVersion,
        versionLabel: requestedVersion
      };
    }

    if (source.branch) {
      return {
        ref: source.branch,
        versionLabel: source.branch
      };
    }

    const latestRelease = await this.getLatestGitHubRelease(owner, repo);
    if (latestRelease) {
      return {
        ref: latestRelease.tag_name,
        versionLabel: latestRelease.tag_name,
        release: latestRelease
      };
    }

    const defaultBranch = await this.getGitHubDefaultBranch(owner, repo);
    return {
      ref: defaultBranch,
      versionLabel: defaultBranch
    };
  }

  private buildGitHubArchiveCandidates(
    owner: string,
    repo: string,
    refResolution: GitHubRefResolution,
    source: PackageInstallSource
  ): string[] {
    const candidates = new Set<string>();

    if (refResolution.release?.zipball_url) {
      candidates.add(refResolution.release.zipball_url);
    }

    if (source.branch && !source.version) {
      candidates.add(`https://github.com/${owner}/${repo}/archive/refs/heads/${encodeURIComponent(source.branch)}.zip`);
    }

    candidates.add(`https://github.com/${owner}/${repo}/archive/${encodeURIComponent(refResolution.ref)}.zip`);
    candidates.add(`https://github.com/${owner}/${repo}/archive/refs/heads/${encodeURIComponent(refResolution.ref)}.zip`);

    return Array.from(candidates);
  }

  private buildGitHubPathCandidates(
    packageName: string,
    repoName: string,
    source: PackageInstallSource
  ): string[] {
    const normalizedPackageName = this.removeAhkSuffix(packageName);
    const normalizedRepoName = this.removeAhkSuffix(repoName);

    const candidates = new Set<string>();
    const addCandidate = (value?: string): void => {
      if (!value) {
        return;
      }
      const cleaned = value.replace(/^[./\\]+/, '').replace(/\\/g, '/').trim();
      if (cleaned) {
        candidates.add(cleaned);
      }
    };

    addCandidate(source.main);

    for (const file of source.files || []) {
      if (file.includes('*')) {
        continue;
      }
      addCandidate(file);
    }

    addCandidate(`${normalizedPackageName}.ahk`);
    addCandidate(`${normalizedRepoName}.ahk`);
    addCandidate(`Lib/${normalizedPackageName}.ahk`);
    addCandidate(`Lib/${normalizedRepoName}.ahk`);
    addCandidate(`src/${normalizedPackageName}.ahk`);
    addCandidate(`src/${normalizedRepoName}.ahk`);
    addCandidate('main.ahk');
    addCandidate('export.ahk');

    return Array.from(candidates);
  }

  private async downloadAndExtractArchive(
    archiveUrl: string,
    packageName: string,
    preferredPaths: string[]
  ): Promise<{ content: string }> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ahk-converter-archive-'));
    const extension = this.detectArchiveExtension(archiveUrl);
    const archivePath = path.join(tempDir, `package.${extension}`);
    const extractDir = path.join(tempDir, 'extract');

    try {
      const archiveBuffer = await this.fetchBuffer(archiveUrl, {
        ...this.getGitHubHeaders(),
        'Accept': 'application/octet-stream,*/*'
      });
      await fs.writeFile(archivePath, archiveBuffer);

      await fs.mkdir(extractDir, { recursive: true });
      await this.extractArchiveWith7Zip(archivePath, extractDir);
      await this.extractNestedTarArchives(extractDir);

      const allFiles = await this.listFilesRecursive(extractDir);
      const ahkFiles = allFiles.filter(file => /\.(ahk|ahk2|ah2)$/i.test(file));
      if (ahkFiles.length === 0) {
        throw new Error(`No .ahk files were found after extracting ${archiveUrl}`);
      }

      const selectedFile = this.selectPreferredAhkFile(ahkFiles, preferredPaths, packageName);
      const content = await fs.readFile(selectedFile, 'utf-8');
      return { content };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private async extractArchiveWith7Zip(archivePath: string, outputDir: string): Promise<void> {
    await this.execFileAsync(path7za, ['x', archivePath, `-o${outputDir}`, '-y'], { windowsHide: true });
  }

  private async extractNestedTarArchives(rootDir: string): Promise<void> {
    const files = await this.listFilesRecursive(rootDir);
    const nestedArchives = files.filter(file => /\.(tar|tgz|tar\.gz)$/i.test(file));

    for (const nested of nestedArchives) {
      try {
        await this.extractArchiveWith7Zip(nested, path.dirname(nested));
      } catch {
        // Ignore nested extraction failures and continue.
      }
    }
  }

  private selectPreferredAhkFile(files: string[], preferredPaths: string[], packageName: string): string {
    const normalizedFiles = files.map(file => ({
      fullPath: file,
      normalized: file.replace(/\\/g, '/').toLowerCase(),
      base: path.basename(file).toLowerCase()
    }));

    for (const preferred of preferredPaths) {
      const normalizedPreferred = preferred.replace(/\\/g, '/').replace(/^[./\\]+/, '').toLowerCase();
      const directMatch = normalizedFiles.find(file =>
        file.normalized.endsWith(`/${normalizedPreferred}`) || file.normalized.endsWith(normalizedPreferred)
      );
      if (directMatch) {
        return directMatch.fullPath;
      }
    }

    const normalizedPackage = `${this.removeAhkSuffix(packageName).toLowerCase()}.ahk`;
    const packageMatch = normalizedFiles.find(file => file.base === normalizedPackage);
    if (packageMatch) {
      return packageMatch.fullPath;
    }

    const conventional = normalizedFiles.find(file => file.base === 'main.ahk' || file.base === 'export.ahk');
    if (conventional) {
      return conventional.fullPath;
    }

    const sorted = [...normalizedFiles].sort((a, b) => a.normalized.length - b.normalized.length || a.normalized.localeCompare(b.normalized));
    return sorted[0].fullPath;
  }

  private async listFilesRecursive(rootDir: string): Promise<string[]> {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.listFilesRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  private detectArchiveExtension(url: string): string {
    const lower = url.toLowerCase();
    if (lower.includes('.tar.gz') || lower.endsWith('.tgz')) {
      return 'tar.gz';
    }
    if (lower.includes('.tar')) {
      return 'tar';
    }
    if (lower.includes('.7z')) {
      return '7z';
    }
    return 'zip';
  }

  private async getGitHubDefaultBranch(owner: string, repo: string): Promise<string> {
    try {
      const repoInfo = await this.fetchJson(
        `https://api.github.com/repos/${owner}/${repo}`,
        this.getGitHubHeaders()
      );
      if (this.isRecord(repoInfo) && typeof repoInfo.default_branch === 'string') {
        return repoInfo.default_branch;
      }
    } catch {
      // Fall back below.
    }
    return 'main';
  }

  private async getLatestGitHubRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
    try {
      const release = await this.fetchJson(
        `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
        this.getGitHubHeaders()
      );
      if (this.isGitHubRelease(release)) {
        return release;
      }
    } catch {
      // Repository may not have releases.
    }
    return null;
  }

  private async getGitHubReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
    try {
      const releases = await this.fetchJson(
        `https://api.github.com/repos/${owner}/${repo}/releases`,
        this.getGitHubHeaders()
      );

      if (!Array.isArray(releases)) {
        return [];
      }

      return releases.filter((release): release is GitHubRelease => this.isGitHubRelease(release));
    } catch {
      return [];
    }
  }

  private findMatchingRelease(releases: GitHubRelease[], target: string): GitHubRelease | undefined {
    if (releases.length === 0) {
      return undefined;
    }

    const normalizedTarget = target.trim();

    if (normalizedTarget.toLowerCase() === 'latest') {
      return releases[0];
    }

    const exact = releases.find(release =>
      release.tag_name === normalizedTarget || release.tag_name.replace(/^v/i, '') === normalizedTarget.replace(/^v/i, '')
    );
    if (exact) {
      return exact;
    }

    if (!this.isSemverRange(normalizedTarget)) {
      return undefined;
    }

    const candidates = releases
      .map(release => ({
        release,
        coerced: semver.coerce(release.tag_name)
      }))
      .filter((entry): entry is { release: GitHubRelease; coerced: semver.SemVer } => entry.coerced !== null)
      .filter(entry => semver.satisfies(entry.coerced.version, normalizedTarget, { includePrerelease: true }))
      .sort((a, b) => semver.rcompare(a.coerced.version, b.coerced.version));

    return candidates[0]?.release;
  }

  private extractGistVersion(gistResponse: unknown): string | undefined {
    if (!this.isRecord(gistResponse) || !Array.isArray(gistResponse.history) || gistResponse.history.length === 0) {
      return undefined;
    }

    const latest = gistResponse.history[0];
    if (this.isRecord(latest) && typeof latest.version === 'string') {
      return latest.version.slice(0, 7);
    }

    return undefined;
  }

  private getGitHubHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      'Accept': 'application/vnd.github+json'
    };

    const token = vscode.workspace.getConfiguration('ahkv2Toolbox').get<string>('githubToken');
    if (token && token.trim()) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    return headers;
  }

  private async fetchText(
    url: string,
    headers?: Record<string, string>,
    allowHtml: boolean = false
  ): Promise<string> {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }

    const text = await response.text();
    if (!allowHtml && this.looksLikeHtmlError(text)) {
      throw new Error(`Unexpected HTML response for ${url}`);
    }
    return text;
  }

  private async fetchBuffer(url: string, headers?: Record<string, string>): Promise<Buffer> {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }
    return response.json();
  }

  private looksLikeHtmlError(content: string): boolean {
    const lower = content.trim().toLowerCase();
    return lower.startsWith('<!doctype html') || lower.startsWith('<html');
  }

  private encodeGitHubPath(filePath: string): string {
    return filePath
      .split('/')
      .map(part => encodeURIComponent(part))
      .join('/');
  }

  private isCommitHash(value: string): boolean {
    return /^[0-9a-f]{7,40}$/i.test(value.trim());
  }

  private removeAhkSuffix(name: string): string {
    return name.replace(/\.(ahk|ahk2|ah2)$/i, '');
  }

  private isSemverRange(value: string): boolean {
    if (/^[~^><=*]/.test(value)) {
      return true;
    }
    return semver.validRange(value) !== null && semver.valid(value) === null;
  }

  private buildForumsUrl(threadId: string, start?: string, post?: string): string {
    const params = new URLSearchParams();
    params.set('t', threadId);
    if (start) {
      params.set('start', start);
    }
    if (post) {
      params.set('p', post);
    }
    return `https://www.autohotkey.com/boards/viewtopic.php?${params.toString()}`;
  }

  private decodeHtmlEntities(value: string): string {
    const namedEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' '
    };

    let decoded = value.replace(/<br\s*\/?\s*>/gi, '\n');

    for (const [entity, replacement] of Object.entries(namedEntities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
    }

    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    );
    decoded = decoded.replace(/&#(\d+);/g, (_, num: string) =>
      String.fromCodePoint(Number.parseInt(num, 10))
    );

    return decoded.replace(/\r\n/g, '\n');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isGitHubRelease(value: unknown): value is GitHubRelease {
    return this.isRecord(value) && typeof value.tag_name === 'string' && typeof value.zipball_url === 'string';
  }
}
