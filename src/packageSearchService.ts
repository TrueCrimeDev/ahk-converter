import { GitHubCodeSearchClient, GitHubSearchResult } from './githubCodeSearchClient';

export type PackageSourceType = 'index' | 'github' | 'gist' | 'forums' | 'archive' | 'ahk';

export interface PackageInstallSource {
  type: Exclude<PackageSourceType, 'index'>;
  spec: string;
  repository?: string;
  branch?: string;
  version?: string;
  main?: string;
  files?: string[];
  url?: string;
  gistId?: string;
  gistFile?: string;
  threadId?: string;
  codeBox?: number;
  start?: string;
  post?: string;
  fromIndex?: boolean;
  indexPackageName?: string;
}

/**
 * Represents a package search result with rich metadata
 */
export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
  author: string;
  repositoryUrl: string;
  stars: number;
  lastUpdated: Date;
  sourceType: PackageSourceType;
  installSpec: string;
  source?: PackageInstallSource;
  category?: string;
  tags?: string[];
  downloadUrl?: string;
  rawUrl?: string;
  readmeUrl?: string;
}

/**
 * Search filters for refining package search results
 */
export interface SearchFilters {
  category?: string;
  minStars?: number;
  sortBy?: 'stars' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
}

interface NormalizedRepository {
  type: Exclude<PackageSourceType, 'index'>;
  url: string;
}

interface ArisIndexPackage {
  packageName: string;
  author: string;
  name: string;
  description: string;
  main?: string;
  files: string[];
  keywords: string[];
  repository: NormalizedRepository;
}

interface GitHubParsedSpec {
  repository: string;
  branch?: string;
  main?: string;
}

interface SplitVersionResult {
  base: string;
  version?: string;
}

/**
 * Service for searching AHK v2 packages from Aris-compatible sources
 */
export class PackageSearchService {
  private static instance: PackageSearchService | undefined;
  private githubClient: GitHubCodeSearchClient;
  private searchCache: Map<string, PackageSearchResult[]> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private lastSearchTime: Map<string, number> = new Map();

  private readonly arisIndexUrl = 'https://raw.githubusercontent.com/Descolada/Aris/main/assets/index.json';
  private readonly arisIndexCacheTimeout = 30 * 60 * 1000; // 30 minutes
  private arisIndexPackages: ArisIndexPackage[] = [];
  private arisIndexVersion = 'unknown';
  private arisIndexLastFetch = 0;

  private readonly categories = {
    'GUI': ['gui', 'window', 'interface', 'ui'],
    'Networking': ['http', 'socket', 'api', 'rest', 'web'],
    'File Operations': ['file', 'io', 'filesystem', 'directory'],
    'System': ['system', 'process', 'registry', 'wmi'],
    'Parsing': ['json', 'xml', 'csv', 'parser', 'regex'],
    'Utilities': ['util', 'helper', 'tool', 'lib'],
    'Gaming': ['game', 'gaming', 'overlay'],
    'Automation': ['automation', 'macro', 'hotkey'],
    'Testing': ['test', 'testing', 'framework', 'unit-test']
  };

  private constructor() {
    this.githubClient = GitHubCodeSearchClient.getInstance();
  }

  public static getInstance(): PackageSearchService {
    if (!PackageSearchService.instance) {
      PackageSearchService.instance = new PackageSearchService();
    }
    return PackageSearchService.instance;
  }

  /**
   * Search for AHK v2 packages using Aris-compatible source syntax
   */
  public async searchPackages(
    query: string,
    filters?: SearchFilters,
    maxResults: number = 30
  ): Promise<PackageSearchResult[]> {
    try {
      const normalizedQuery = query.trim();
      const cacheKey = this.getCacheKey(normalizedQuery, filters);

      if (this.isCacheValid(cacheKey)) {
        const cached = this.searchCache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const indexPackages = await this.getArisIndexPackages();
      let results: PackageSearchResult[] = [];

      if (!normalizedQuery) {
        results = this.getDefaultIndexResults(indexPackages, maxResults);
      } else {
        const resolved = await this.resolveArisStyleQuery(normalizedQuery, indexPackages, maxResults);
        if (resolved.length > 0) {
          results = resolved;
        } else {
          const indexMatches = this.searchIndexByText(normalizedQuery, indexPackages, maxResults);
          if (indexMatches.length > 0) {
            results = indexMatches;
          } else {
            results = await this.searchGitHub(normalizedQuery, maxResults);
          }
        }
      }

      if (filters) {
        results = this.applyFilters(results, filters);
      }

      const limitedResults = results.slice(0, maxResults);
      this.searchCache.set(cacheKey, limitedResults);
      this.lastSearchTime.set(cacheKey, Date.now());
      return limitedResults;
    } catch (error) {
      console.error('Package search failed:', error);
      throw new Error(`Failed to search packages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Return a default list from the Aris package index.
   */
  public async getIndexPackages(maxResults: number = 60): Promise<PackageSearchResult[]> {
    const indexPackages = await this.getArisIndexPackages();
    return this.getDefaultIndexResults(indexPackages, maxResults);
  }

  /**
   * Resolve Aris-style install query syntaxes.
   */
  private async resolveArisStyleQuery(
    query: string,
    indexPackages: ArisIndexPackage[],
    maxResults: number
  ): Promise<PackageSearchResult[]> {
    const explicitSource = this.resolveExplicitSourceQuery(query);
    if (explicitSource) {
      return [explicitSource];
    }

    const split = this.splitVersionSpecifier(query);

    if (split.base.includes('/')) {
      const segments = split.base.split('/').map(part => part.trim()).filter(Boolean);
      if (segments.length >= 2) {
        const author = segments[0];
        const name = this.removeAhkSuffix(segments[1]);
        const branch = segments.length > 2 ? segments.slice(2).join('/') : undefined;

        const indexMatch = this.findIndexPackageByAuthorAndName(indexPackages, author, name);
        if (indexMatch) {
          return [
            this.indexPackageToResult(indexMatch, {
              installSpec: query,
              version: split.version,
              branch
            })
          ];
        }

        return [this.createGitHubResultFromShorthand(author, name, branch, split.version, query)];
      }
    }

    if (!/\s/.test(split.base)) {
      const exactMatches = this.searchIndexByExactName(split.base, indexPackages);
      if (exactMatches.length > 0) {
        return exactMatches
          .slice(0, maxResults)
          .map(pkg => this.indexPackageToResult(pkg, {
            installSpec: query,
            version: split.version
          }));
      }
    }

    return [];
  }

  private resolveExplicitSourceQuery(query: string): PackageSearchResult | null {
    if (/^(github|gh):/i.test(query)) {
      const payload = query.replace(/^(github|gh):/i, '').trim();
      const split = this.splitVersionSpecifier(payload);
      const parsed = this.parseGitHubRepositorySpec(split.base);
      if (!parsed) {
        return null;
      }

      return this.createGitHubResult(
        this.removeAhkSuffix(parsed.repository.split('/')[1] || parsed.repository),
        parsed.repository.split('/')[0] || 'Unknown',
        parsed.repository,
        split.version,
        parsed.branch,
        parsed.main,
        query
      );
    }

    if (/^gist:/i.test(query)) {
      const payload = query.replace(/^gist:/i, '').trim();
      const split = this.splitVersionSpecifier(payload);
      const gistParts = split.base.split('/').map(part => part.trim()).filter(Boolean);
      if (gistParts.length === 0) {
        return null;
      }

      const gistId = gistParts[0];
      const gistFile = gistParts.length > 1 ? gistParts.slice(1).join('/') : undefined;
      const name = this.removeAhkSuffix(
        gistFile ? this.getBasenameFromPath(gistFile) : `gist-${gistId.slice(0, 7)}`
      );

      const source: PackageInstallSource = {
        type: 'gist',
        spec: query,
        gistId,
        gistFile,
        version: split.version || 'latest'
      };

      return this.createSourceResult(
        name,
        'Unknown',
        gistFile
          ? `Install ${gistFile} from gist ${gistId}`
          : `Install first file from gist ${gistId}`,
        'gist',
        source,
        split.version || 'latest',
        `https://gist.github.com/${gistId}`
      );
    }

    if (/^forums:/i.test(query)) {
      const payload = query.replace(/^forums:/i, '').trim();
      const source = this.parseForumsSource(payload, query);
      if (!source) {
        return null;
      }

      return this.createSourceResult(
        `thread-${source.threadId}`,
        'Unknown',
        `Install code box ${source.codeBox || 1} from AutoHotkey forums thread ${source.threadId}`,
        'forums',
        source,
        source.version || 'latest',
        source.url || this.buildForumsUrl(source.threadId || '', source.start, source.post)
      );
    }

    if (this.looksLikeUrl(query)) {
      return this.resolveUrlSource(query);
    }

    if (this.looksLikeArchiveUrl(query)) {
      const source: PackageInstallSource = {
        type: 'archive',
        spec: query,
        url: query
      };

      return this.createSourceResult(
        this.removeAhkSuffix(this.getBasenameFromPath(query)),
        'Unknown',
        `Install from archive ${query}`,
        'archive',
        source,
        'latest',
        query
      );
    }

    return null;
  }

  private resolveUrlSource(rawInput: string): PackageSearchResult | null {
    const normalized = rawInput.startsWith('www.') ? `https://${rawInput}` : rawInput;
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(normalized);
    } catch {
      return null;
    }

    const host = parsedUrl.hostname.toLowerCase();
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (host.includes('gist.github.com')) {
      const parts = pathname.split('/').filter(Boolean);
      const gistId = parts.find(part => /^[a-f0-9]{8,}$/i.test(part));
      if (!gistId) {
        return null;
      }
      const filePart = parts.length >= 3 ? parts[2] : undefined;
      const source: PackageInstallSource = {
        type: 'gist',
        spec: rawInput,
        gistId,
        gistFile: filePart
      };
      const name = this.removeAhkSuffix(
        filePart ? this.getBasenameFromPath(filePart) : `gist-${gistId.slice(0, 7)}`
      );
      return this.createSourceResult(
        name,
        'Unknown',
        `Install from gist ${gistId}`,
        'gist',
        source,
        'latest',
        `https://gist.github.com/${gistId}`
      );
    }

    if (host.includes('autohotkey.com') && pathname.includes('viewtopic.php')) {
      const source = this.parseForumsSource(parsedUrl.search, rawInput);
      if (!source) {
        return null;
      }
      return this.createSourceResult(
        `thread-${source.threadId}`,
        'Unknown',
        `Install code box ${source.codeBox || 1} from AutoHotkey forums thread ${source.threadId}`,
        'forums',
        source,
        'latest',
        source.url || rawInput
      );
    }

    if (host.includes('github.com')) {
      if (this.looksLikeArchiveUrl(normalized)) {
        const source: PackageInstallSource = {
          type: 'archive',
          spec: rawInput,
          url: normalized
        };
        return this.createSourceResult(
          this.removeAhkSuffix(this.getBasenameFromPath(pathname)),
          'Unknown',
          `Install from archive ${rawInput}`,
          'archive',
          source,
          'latest',
          normalized
        );
      }

      const split = this.splitVersionSpecifier(normalized);
      const parsed = this.parseGitHubRepositorySpec(split.base);
      if (!parsed) {
        return null;
      }

      const [author, repoName] = parsed.repository.split('/');
      return this.createGitHubResult(
        this.removeAhkSuffix(repoName || parsed.repository),
        author || 'Unknown',
        parsed.repository,
        split.version,
        parsed.branch,
        parsed.main,
        rawInput
      );
    }

    if (this.looksLikeArchiveUrl(normalized)) {
      const source: PackageInstallSource = {
        type: 'archive',
        spec: rawInput,
        url: normalized
      };
      return this.createSourceResult(
        this.removeAhkSuffix(this.getBasenameFromPath(pathname)),
        'Unknown',
        `Install from archive ${rawInput}`,
        'archive',
        source,
        'latest',
        normalized
      );
    }

    if (this.looksLikeAhkUrl(normalized)) {
      const source: PackageInstallSource = {
        type: 'ahk',
        spec: rawInput,
        url: normalized
      };
      return this.createSourceResult(
        this.removeAhkSuffix(this.getBasenameFromPath(pathname)),
        'Unknown',
        `Install script from ${rawInput}`,
        'ahk',
        source,
        'latest',
        normalized
      );
    }

    return null;
  }

  private parseForumsSource(payload: string, originalSpec: string): PackageInstallSource | null {
    const normalizedPayload = payload.startsWith('?') ? payload.slice(1) : payload;
    const params = new URLSearchParams(normalizedPayload);

    const threadId = params.get('t') || this.extractForumsThreadId(normalizedPayload);
    if (!threadId) {
      return null;
    }

    const codeBox = this.toPositiveInteger(params.get('codebox') || params.get('code')) || 1;
    const start = params.get('start') || undefined;
    const post = params.get('p') || undefined;

    return {
      type: 'forums',
      spec: originalSpec,
      threadId,
      codeBox,
      start,
      post,
      url: this.buildForumsUrl(threadId, start, post)
    };
  }

  private extractForumsThreadId(value: string): string | null {
    const match = value.match(/(?:^|[?&])t=(\d+)/i);
    return match ? match[1] : null;
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

  /**
   * Search GitHub for AHK packages.
   */
  private async searchGitHub(query: string, maxResults: number): Promise<PackageSearchResult[]> {
    const results: PackageSearchResult[] = [];

    try {
      const searchQuery = `${query} language:AutoHotkey topic:autohotkey-v2`;
      const githubResults = await this.githubClient.searchRepositories(searchQuery, maxResults);

      const codeQuery = `${query} extension:ahk`;
      const codeResults = await this.githubClient.searchCode(codeQuery, Math.floor(maxResults / 2));

      const allResults = [...githubResults, ...codeResults];
      const seen = new Set<string>();

      for (const result of allResults) {
        const repoFullName = result.repository.full_name;

        if (seen.has(repoFullName)) {
          continue;
        }
        seen.add(repoFullName);

        const packageResult = this.convertGitHubResult(result);
        if (packageResult) {
          results.push(packageResult);
        }

        if (results.length >= maxResults) {
          break;
        }
      }
    } catch (error) {
      console.error('GitHub search failed:', error);
    }

    return results;
  }

  /**
   * Convert GitHub search result to PackageSearchResult.
   */
  private convertGitHubResult(result: GitHubSearchResult): PackageSearchResult | null {
    try {
      const repo = result.repository;
      const [owner, repoName] = repo.full_name.split('/');
      const normalizedRepo = `${owner}/${repoName}`;
      const category = this.inferCategory(repo.description || '');

      let downloadUrl: string | undefined;
      let rawUrl: string | undefined;
      let mainPath: string | undefined;

      if (result.path) {
        downloadUrl = result.html_url;
        rawUrl = `https://raw.githubusercontent.com/${repo.full_name}/main/${result.path}`;
        mainPath = result.path;
      } else {
        downloadUrl = `${repo.html_url}/blob/main/${repoName}.ahk`;
        rawUrl = `https://raw.githubusercontent.com/${repo.full_name}/main/${repoName}.ahk`;
      }

      const source: PackageInstallSource = {
        type: 'github',
        spec: `github:${normalizedRepo}`,
        repository: normalizedRepo,
        main: mainPath,
        version: 'latest'
      };

      return {
        name: this.removeAhkSuffix(result.name || repoName),
        version: 'latest',
        description: repo.description || 'No description available',
        author: owner,
        repositoryUrl: repo.html_url,
        stars: repo.stargazers_count,
        lastUpdated: new Date(repo.updated_at),
        sourceType: 'github',
        installSpec: `github:${normalizedRepo}`,
        source,
        category,
        downloadUrl,
        rawUrl,
        readmeUrl: `${repo.html_url}#readme`
      };
    } catch (error) {
      console.error('Failed to convert GitHub result:', error);
      return null;
    }
  }

  private createGitHubResultFromShorthand(
    author: string,
    name: string,
    branch: string | undefined,
    version: string | undefined,
    installSpec: string
  ): PackageSearchResult {
    const repository = `${author}/${name}`;
    return this.createGitHubResult(
      this.removeAhkSuffix(name),
      author,
      repository,
      version,
      branch,
      undefined,
      installSpec
    );
  }

  private createGitHubResult(
    name: string,
    author: string,
    repository: string,
    version: string | undefined,
    branch: string | undefined,
    main: string | undefined,
    installSpec: string
  ): PackageSearchResult {
    const source: PackageInstallSource = {
      type: 'github',
      spec: installSpec,
      repository,
      branch,
      version: version || 'latest',
      main
    };

    const refLabel = version || branch || 'latest';
    return this.createSourceResult(
      this.removeAhkSuffix(name),
      author,
      `Install ${repository}@${refLabel} from GitHub`,
      'github',
      source,
      version || 'latest',
      `https://github.com/${repository}`
    );
  }

  private createSourceResult(
    name: string,
    author: string,
    description: string,
    sourceType: Exclude<PackageSourceType, 'index'>,
    source: PackageInstallSource,
    version: string,
    repositoryUrl: string
  ): PackageSearchResult {
    return {
      name: this.removeAhkSuffix(name),
      version: version || 'latest',
      description,
      author,
      repositoryUrl,
      stars: 0,
      lastUpdated: new Date(0),
      sourceType,
      installSpec: source.spec,
      source,
      category: this.inferCategory(description)
    };
  }

  private splitVersionSpecifier(input: string): SplitVersionResult {
    const atIndex = input.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === input.length - 1) {
      return { base: input };
    }
    return {
      base: input.slice(0, atIndex),
      version: input.slice(atIndex + 1).trim()
    };
  }

  private parseGitHubRepositorySpec(spec: string): GitHubParsedSpec | null {
    const cleaned = spec.trim();
    if (!cleaned) {
      return null;
    }

    const withoutPrefix = cleaned.replace(/^(github|gh):/i, '').trim();
    const maybeUrl = withoutPrefix.startsWith('www.') ? `https://${withoutPrefix}` : withoutPrefix;

    if (this.looksLikeUrl(maybeUrl) || maybeUrl.includes('github.com/')) {
      let urlObj: URL;
      try {
        urlObj = new URL(maybeUrl.includes('://') ? maybeUrl : `https://${maybeUrl}`);
      } catch {
        return null;
      }

      const parts = urlObj.pathname.split('/').map(part => decodeURIComponent(part)).filter(Boolean);
      if (parts.length < 2) {
        return null;
      }

      const owner = parts[0];
      const repo = parts[1].replace(/\.git$/i, '');
      let branch: string | undefined;
      let main: string | undefined;

      if (parts[2] === 'blob' && parts.length >= 5) {
        branch = parts[3];
        main = parts.slice(4).join('/');
      } else if (parts[2] === 'tree' && parts.length >= 4) {
        branch = parts[3];
      } else if (parts.length >= 3 && !this.isGitHubSpecialPath(parts[2])) {
        branch = parts.slice(2).join('/');
      }

      return {
        repository: `${owner}/${repo}`,
        branch,
        main
      };
    }

    const parts = withoutPrefix.split('/').map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, '');
    const branch = parts.length > 2 ? parts.slice(2).join('/') : undefined;
    return {
      repository: `${owner}/${repo}`,
      branch
    };
  }

  private isGitHubSpecialPath(segment: string): boolean {
    const specials = new Set([
      'issues', 'pull', 'releases', 'actions', 'wiki', 'blob', 'tree', 'raw', 'archive', 'commits'
    ]);
    return specials.has(segment.toLowerCase());
  }

  private async getArisIndexPackages(forceRefresh = false): Promise<ArisIndexPackage[]> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.arisIndexPackages.length > 0 &&
      now - this.arisIndexLastFetch < this.arisIndexCacheTimeout
    ) {
      return this.arisIndexPackages;
    }

    try {
      const response = await fetch(this.arisIndexUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AHK-Converter-VSCode-Extension'
        }
      });

      if (!response.ok) {
        throw new Error(`Aris index request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!this.isRecord(data)) {
        throw new Error('Aris index response was not a JSON object');
      }

      const parsedPackages = this.parseArisIndexDocument(data);
      if (parsedPackages.length === 0) {
        throw new Error('Aris index did not contain any packages');
      }

      this.arisIndexPackages = parsedPackages;
      this.arisIndexLastFetch = now;
      this.arisIndexVersion = typeof data.version === 'string' ? data.version : this.arisIndexVersion;
    } catch (error) {
      if (this.arisIndexPackages.length === 0) {
        console.warn('Failed to load Aris package index:', error);
      }
    }

    return this.arisIndexPackages;
  }

  private parseArisIndexDocument(indexData: Record<string, unknown>): ArisIndexPackage[] {
    const packageMap = new Map<string, ArisIndexPackage>();

    const addPackage = (packageName: string, packageData: unknown): void => {
      if (!this.isRecord(packageData)) {
        return;
      }
      const parsed = this.toArisIndexPackage(packageName, packageData);
      if (parsed) {
        packageMap.set(parsed.packageName.toLowerCase(), parsed);
      }
    };

    for (const [key, value] of Object.entries(indexData)) {
      if (key === 'version') {
        continue;
      }

      if (this.isVersionBucketKey(key) && this.isRecord(value)) {
        for (const [packageName, packageData] of Object.entries(value)) {
          addPackage(packageName, packageData);
        }
      } else {
        addPackage(key, value);
      }
    }

    return Array.from(packageMap.values()).sort((a, b) =>
      a.packageName.localeCompare(b.packageName, undefined, { sensitivity: 'base' })
    );
  }

  private isVersionBucketKey(key: string): boolean {
    return /^v\d+(\.\d+)*$/i.test(key);
  }

  private toArisIndexPackage(packageName: string, packageData: Record<string, unknown>): ArisIndexPackage | null {
    if (!packageName || !packageName.includes('/')) {
      return null;
    }

    const [authorFromName, rawName] = packageName.split('/', 2);
    const author = authorFromName || this.extractAuthor(packageData) || 'Unknown';
    const name = this.removeAhkSuffix(rawName || packageName);
    const description = typeof packageData.description === 'string'
      ? packageData.description
      : 'No description available';
    const main = typeof packageData.main === 'string' ? packageData.main.trim() : undefined;
    const files = this.normalizeFilesList(packageData.files, main);
    const keywords = this.normalizeKeywords(packageData.keywords);
    const repository = this.normalizeRepositoryEntry(packageData.repository ?? packageName);

    return {
      packageName: `${author}/${name}`,
      author,
      name,
      description,
      main,
      files,
      keywords,
      repository
    };
  }

  private extractAuthor(packageData: Record<string, unknown>): string {
    const authorField = packageData.author;
    if (typeof authorField === 'string') {
      return authorField;
    }
    if (this.isRecord(authorField) && typeof authorField.name === 'string') {
      return authorField.name;
    }
    return '';
  }

  private normalizeFilesList(filesField: unknown, main?: string): string[] {
    const files: string[] = [];

    if (typeof filesField === 'string' && filesField.trim()) {
      files.push(filesField.trim());
    } else if (Array.isArray(filesField)) {
      for (const entry of filesField) {
        if (typeof entry === 'string' && entry.trim()) {
          files.push(entry.trim());
        }
      }
    }

    if (main && !files.includes(main)) {
      const mainBase = this.getBasenameFromPath(main).toLowerCase();
      const mainCovered = files.some(file => {
        if (file.includes('*')) {
          return true;
        }
        return this.getBasenameFromPath(file).toLowerCase() === mainBase;
      });
      if (!mainCovered) {
        files.push(main);
      }
    }

    return files;
  }

  private normalizeKeywords(field: unknown): string[] {
    if (typeof field === 'string') {
      return field
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
    }
    if (Array.isArray(field)) {
      return field
        .filter(item => typeof item === 'string')
        .map(item => (item as string).trim())
        .filter(Boolean);
    }
    return [];
  }

  private normalizeRepositoryEntry(repositoryField: unknown): NormalizedRepository {
    if (this.isRecord(repositoryField) && typeof repositoryField.url === 'string') {
      const explicitType = typeof repositoryField.type === 'string'
        ? repositoryField.type.toLowerCase()
        : '';
      return this.normalizeRepositoryFromString(repositoryField.url, explicitType);
    }

    if (typeof repositoryField === 'string') {
      return this.normalizeRepositoryFromString(repositoryField);
    }

    return {
      type: 'github',
      url: ''
    };
  }

  private normalizeRepositoryFromString(rawValue: string, explicitType = ''): NormalizedRepository {
    let value = rawValue.trim().replace(/[\\/]+$/, '');

    const atIndex = value.lastIndexOf('@');
    if (atIndex > 0) {
      value = value.slice(0, atIndex);
    }

    if (explicitType) {
      const normalizedType = this.normalizeRepositoryType(explicitType);
      return {
        type: normalizedType,
        url: this.normalizeRepositoryUrlByType(value, normalizedType)
      };
    }

    if (this.looksLikeArchiveUrl(value)) {
      return { type: 'archive', url: value };
    }

    if (value.includes('gist.github.com') || /^gist:/i.test(value)) {
      return {
        type: 'gist',
        url: value.replace(/^gist:/i, '').trim()
      };
    }

    if (value.includes('autohotkey.com') || /^forums:/i.test(value)) {
      return {
        type: 'forums',
        url: value.replace(/^forums:/i, '').trim()
      };
    }

    if (value.includes('github.com') || /^(github|gh):/i.test(value)) {
      const parsed = this.parseGitHubRepositorySpec(value);
      return {
        type: 'github',
        url: parsed ? this.stringifyGitHubParsedSpec(parsed) : value.replace(/^(github|gh):/i, '')
      };
    }

    if (/^(https?:|ftp:|www\.)/i.test(value)) {
      if (this.looksLikeAhkUrl(value)) {
        return { type: 'ahk', url: value };
      }
      return { type: 'archive', url: value };
    }

    return {
      type: 'github',
      url: value
    };
  }

  private normalizeRepositoryType(type: string): Exclude<PackageSourceType, 'index'> {
    switch (type) {
      case 'github':
      case 'gist':
      case 'forums':
      case 'archive':
      case 'ahk':
        return type;
      default:
        return 'github';
    }
  }

  private normalizeRepositoryUrlByType(value: string, type: Exclude<PackageSourceType, 'index'>): string {
    if (type === 'github') {
      const parsed = this.parseGitHubRepositorySpec(value);
      return parsed ? this.stringifyGitHubParsedSpec(parsed) : value.replace(/^(github|gh):/i, '');
    }
    if (type === 'gist') {
      return value.replace(/^gist:/i, '').trim();
    }
    if (type === 'forums') {
      return value.replace(/^forums:/i, '').trim();
    }
    return value;
  }

  private stringifyGitHubParsedSpec(parsed: GitHubParsedSpec): string {
    return parsed.branch
      ? `${parsed.repository}/${parsed.branch}`
      : parsed.repository;
  }

  private getDefaultIndexResults(indexPackages: ArisIndexPackage[], maxResults: number): PackageSearchResult[] {
    return indexPackages
      .slice(0, maxResults)
      .map(pkg => this.indexPackageToResult(pkg));
  }

  private findIndexPackageByAuthorAndName(
    indexPackages: ArisIndexPackage[],
    author: string,
    name: string
  ): ArisIndexPackage | undefined {
    const normalizedAuthor = author.toLowerCase();
    const normalizedName = this.removeAhkSuffix(name).toLowerCase();
    return indexPackages.find(pkg =>
      pkg.author.toLowerCase() === normalizedAuthor &&
      this.removeAhkSuffix(pkg.name).toLowerCase() === normalizedName
    );
  }

  private searchIndexByExactName(name: string, indexPackages: ArisIndexPackage[]): ArisIndexPackage[] {
    const normalized = this.removeAhkSuffix(name).toLowerCase();
    const fullNormalized = normalized.includes('/') ? normalized : '';

    return indexPackages.filter(pkg => {
      const pkgName = pkg.name.toLowerCase();
      const fullName = pkg.packageName.toLowerCase();
      return pkgName === normalized || (fullNormalized && fullName === fullNormalized);
    });
  }

  private searchIndexByText(
    query: string,
    indexPackages: ArisIndexPackage[],
    maxResults: number
  ): PackageSearchResult[] {
    const normalizedQuery = query.toLowerCase();
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    const scored = indexPackages
      .map(pkg => {
        const haystack = [
          pkg.packageName,
          pkg.name,
          pkg.author,
          pkg.description,
          ...pkg.keywords
        ].join(' ').toLowerCase();

        if (!haystack.includes(normalizedQuery) && !queryTokens.every(token => haystack.includes(token))) {
          return null;
        }

        let score = 0;
        if (pkg.packageName.toLowerCase() === normalizedQuery) score += 120;
        if (pkg.name.toLowerCase() === normalizedQuery) score += 100;
        if (pkg.packageName.toLowerCase().includes(normalizedQuery)) score += 70;
        if (pkg.name.toLowerCase().includes(normalizedQuery)) score += 60;
        if (pkg.author.toLowerCase().includes(normalizedQuery)) score += 40;
        if (pkg.description.toLowerCase().includes(normalizedQuery)) score += 25;
        score += queryTokens.filter(token => haystack.includes(token)).length * 10;

        return { pkg, score };
      })
      .filter((item): item is { pkg: ArisIndexPackage; score: number } => item !== null)
      .sort((a, b) => b.score - a.score || a.pkg.packageName.localeCompare(b.pkg.packageName))
      .slice(0, maxResults);

    return scored.map(item => this.indexPackageToResult(item.pkg, { installSpec: query }));
  }

  private indexPackageToResult(
    indexPackage: ArisIndexPackage,
    options?: { installSpec?: string; version?: string; branch?: string }
  ): PackageSearchResult {
    const source = this.buildInstallSourceFromIndex(indexPackage, options);
    const repositoryUrl = this.getRepositoryUrlFromSource(source) || '';
    const version = options?.version || 'latest';

    return {
      name: indexPackage.name,
      version,
      description: indexPackage.description,
      author: indexPackage.author,
      repositoryUrl,
      stars: 0,
      lastUpdated: new Date(0),
      sourceType: 'index',
      installSpec: options?.installSpec || indexPackage.packageName,
      source,
      category: this.inferCategory(
        [indexPackage.description, ...indexPackage.keywords, indexPackage.repository.type].join(' ')
      ),
      tags: indexPackage.keywords
    };
  }

  private buildInstallSourceFromIndex(
    indexPackage: ArisIndexPackage,
    options?: { installSpec?: string; version?: string; branch?: string }
  ): PackageInstallSource {
    const installSpec = options?.installSpec || indexPackage.packageName;
    const version = options?.version;

    switch (indexPackage.repository.type) {
      case 'github': {
        const parsed = this.parseGitHubRepositorySpec(indexPackage.repository.url);
        const repository = parsed?.repository || indexPackage.repository.url;
        const branch = options?.branch || parsed?.branch;
        return {
          type: 'github',
          spec: installSpec,
          repository,
          branch,
          version,
          main: parsed?.main || indexPackage.main,
          files: indexPackage.files,
          fromIndex: true,
          indexPackageName: indexPackage.packageName
        };
      }
      case 'gist': {
        const payload = indexPackage.repository.url.replace(/^gist:/i, '').trim();
        const gistParts = payload.split('/').map(part => part.trim()).filter(Boolean);
        return {
          type: 'gist',
          spec: installSpec,
          gistId: gistParts[0],
          gistFile: gistParts.length > 1 ? gistParts.slice(1).join('/') : indexPackage.main,
          version,
          fromIndex: true,
          indexPackageName: indexPackage.packageName
        };
      }
      case 'forums': {
        const source = this.parseForumsSource(indexPackage.repository.url, installSpec) || {
          type: 'forums' as const,
          spec: installSpec,
          url: indexPackage.repository.url
        };
        return {
          ...source,
          version,
          fromIndex: true,
          indexPackageName: indexPackage.packageName
        };
      }
      case 'archive':
        return {
          type: 'archive',
          spec: installSpec,
          url: indexPackage.repository.url,
          main: indexPackage.main,
          files: indexPackage.files,
          version,
          fromIndex: true,
          indexPackageName: indexPackage.packageName
        };
      case 'ahk':
      default:
        return {
          type: 'ahk',
          spec: installSpec,
          url: indexPackage.repository.url,
          version,
          fromIndex: true,
          indexPackageName: indexPackage.packageName
        };
    }
  }

  private getRepositoryUrlFromSource(source: PackageInstallSource): string {
    switch (source.type) {
      case 'github':
        return source.repository ? `https://github.com/${source.repository}` : '';
      case 'gist':
        return source.gistId ? `https://gist.github.com/${source.gistId}` : '';
      case 'forums':
      case 'archive':
      case 'ahk':
        return source.url || '';
      default:
        return '';
    }
  }

  private looksLikeUrl(input: string): boolean {
    return /^(https?:\/\/|www\.)/i.test(input.trim());
  }

  private looksLikeArchiveUrl(input: string): boolean {
    return /\.(zip|tar|tar\.gz|tgz|7z)(\?.*)?$/i.test(input.trim());
  }

  private looksLikeAhkUrl(input: string): boolean {
    return /\.(ahk|ahk2|ah2)(\?.*)?$/i.test(input.trim());
  }

  private getBasenameFromPath(value: string): string {
    const cleaned = value.split('?')[0].split('#')[0].replace(/[\\/]+$/, '');
    const parts = cleaned.split(/[\\/]/).filter(Boolean);
    const lastPart = parts.length > 0 ? parts[parts.length - 1] : cleaned;
    return lastPart.replace(/\.(zip|tar|tar\.gz|tgz|7z|ahk|ahk2|ah2)$/i, '');
  }

  private removeAhkSuffix(name: string): string {
    return name.replace(/\.(ahk|ahk2|ah2)$/i, '').trim();
  }

  private inferCategory(text: string): string {
    const lowerText = text.toLowerCase();

    for (const [category, keywords] of Object.entries(this.categories)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return category;
      }
    }

    return 'Utilities';
  }

  private applyFilters(results: PackageSearchResult[], filters: SearchFilters): PackageSearchResult[] {
    let filtered = [...results];

    if (filters.category && filters.category !== 'All') {
      filtered = filtered.filter(r => r.category === filters.category);
    }

    if (filters.minStars !== undefined) {
      const minStars = filters.minStars;
      filtered = filtered.filter(r => r.stars >= minStars);
    }

    if (filters.sortBy) {
      filtered = this.sortResults(filtered, filters.sortBy, filters.sortOrder || 'desc');
    }

    return filtered;
  }

  private sortResults(
    results: PackageSearchResult[],
    sortBy: 'stars' | 'updated' | 'name',
    order: 'asc' | 'desc'
  ): PackageSearchResult[] {
    const sorted = [...results];
    const multiplier = order === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'stars':
          comparison = a.stars - b.stars;
          break;
        case 'updated':
          comparison = a.lastUpdated.getTime() - b.lastUpdated.getTime();
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }

      return comparison * multiplier;
    });

    return sorted;
  }

  public getCategories(): string[] {
    return ['All', ...Object.keys(this.categories)];
  }

  public clearCache(): void {
    this.searchCache.clear();
    this.lastSearchTime.clear();
  }

  private getCacheKey(query: string, filters?: SearchFilters): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `${query}:${filterStr}`;
  }

  private isCacheValid(cacheKey: string): boolean {
    const lastTime = this.lastSearchTime.get(cacheKey);
    if (!lastTime) {
      return false;
    }
    return Date.now() - lastTime < this.cacheTimeout;
  }

  private toPositiveInteger(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  public getStats() {
    return {
      cacheSize: this.searchCache.size,
      githubStats: this.githubClient.getStats(),
      arisIndex: {
        version: this.arisIndexVersion,
        packageCount: this.arisIndexPackages.length,
        lastFetch: this.arisIndexLastFetch
      }
    };
  }
}
