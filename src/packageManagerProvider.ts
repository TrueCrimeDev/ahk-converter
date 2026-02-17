import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { Stats } from 'fs';
import * as semver from 'semver';
import { insertIncludeLine, previewIncludeInsertion } from './includeLineInserter';
import { PackageSearchService, PackageSearchResult, SearchFilters, PackageInstallSource } from './packageSearchService';
import { LibraryDetailPanel, LibraryDetailData, LibraryDetailPanelActions } from './libraryDetailPanel';
import { ArisPackageInstaller } from './arisPackageInstaller';

interface PackageItemMetadata {
  author?: string;
  stars?: number;
  category?: string;
  repositoryUrl?: string;
  sourceType?: string;
  installSpec?: string;
  source?: PackageInstallSource;
  includeFormat?: string;
  installLocationType?: InstallLocationType;
  managedByExtension?: boolean;
}

type InstallLocationType = 'workspace' | 'user' | 'system' | 'vendor' | 'external';

interface InstallLocation {
  label: string;
  path: string;
  description: string;
  installLocationType: InstallLocationType;
}

interface PersistedPackageRecord {
  name: string;
  version: string;
  path: string;
  description?: string;
  author?: string;
  stars?: number;
  category?: string;
  repositoryUrl?: string;
  sourceType?: string;
  installSpec?: string;
  source?: PackageInstallSource;
  includeFormat?: string;
  installLocationType?: InstallLocationType;
  managedByExtension?: boolean;
}

/**
 * Represents a package or library item in the package manager
 */
export class PackageItem extends vscode.TreeItem {
  public readonly packageDescription?: string;
  constructor(
    public readonly packageName: string,
    public readonly version: string,
    public readonly packagePath: string,
    public readonly packageType: 'installed' | 'available' | 'updates',
    public readonly description?: string,
    public readonly metadata?: PackageItemMetadata,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(packageName, collapsibleState);
    this.packageDescription = description;

    // Set the label with version
    this.label = packageName;

    // For available packages from search, show stars in description
    if (packageType === 'available' && metadata?.stars !== undefined) {
      // Use text representation for better cross-platform compatibility
      this.description = `${metadata.stars}★ • ${version}`;
    } else {
      this.description = version;
    }

    // Enhanced tooltip with metadata
    let tooltipText = `${packageName} v${version}\n${description || 'No description available'}`;
    if (metadata?.author) {
      tooltipText += `\nAuthor: ${metadata.author}`;
    }
    if (metadata?.category) {
      tooltipText += `\nCategory: ${metadata.category}`;
    }
    if (metadata?.stars !== undefined) {
      tooltipText += `\n★ Stars: ${metadata.stars}`;
    }
    if (metadata?.repositoryUrl) {
      tooltipText += `\nRepository: ${metadata.repositoryUrl}`;
    } else {
      tooltipText += `\nPath: ${packagePath}`;
    }
    this.tooltip = tooltipText;

    // Set appropriate icon based on package type
    switch (packageType) {
      case 'installed':
        this.iconPath = new vscode.ThemeIcon('package');
        this.contextValue = 'installedPackage';
        break;
      case 'available':
        this.iconPath = new vscode.ThemeIcon('cloud-download');
        this.contextValue = 'availablePackage';
        break;
      case 'updates':
        this.iconPath = new vscode.ThemeIcon('sync');
        this.contextValue = 'updatablePackage';
        break;
    }

    // Make packages clickable to view details
    if (packageType === 'installed') {
      this.command = {
        command: 'ahkPackageManager.showPackageDetails',
        title: 'Show Package Details',
        arguments: [this]
      };
    } else if (packageType === 'available' && metadata?.repositoryUrl) {
      // For search results, clicking opens the repository
      this.command = {
        command: 'ahkPackageManager.openRepository',
        title: 'Open Repository',
        arguments: [this]
      };
    }
  }
}

/**
 * Category item for grouping packages
 */
export class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly categoryName: string,
    public readonly itemCount: number = 0,
    public readonly categoryType: 'installed' | 'available' | 'updates'
  ) {
    // Auto-expand if 5 or fewer items, collapse if more
    const collapsibleState = itemCount === 0
      ? vscode.TreeItemCollapsibleState.None
      : itemCount <= 5
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;

    super(categoryName, collapsibleState);

    // Add count to description
    if (itemCount > 0) {
      this.description = `(${itemCount})`;
    }

    // Set category icons
    switch (categoryType) {
      case 'installed':
        this.iconPath = new vscode.ThemeIcon('library');
        break;
      case 'available':
        this.iconPath = new vscode.ThemeIcon('globe');
        break;
      case 'updates':
        this.iconPath = new vscode.ThemeIcon('bell-dot');
        break;
    }

    this.contextValue = 'category';
  }
}

/**
 * Package information interface
 */
interface PackageInfo {
  name: string;
  version: string;
  author?: string;
  description?: string;
  dependencies?: string[];
  path: string;
  lastModified?: Date;
  stars?: number;
  category?: string;
  repositoryUrl?: string;
  sourceType?: string;
  installSpec?: string;
  source?: PackageInstallSource;
  includeFormat?: string;
  installLocationType?: InstallLocationType;
  managedByExtension?: boolean;
}

/**
 * Provides package management functionality for AHK libraries
 */
export class PackageManagerProvider implements vscode.TreeDataProvider<PackageItem | CategoryItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PackageItem | CategoryItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly packageStateFileName = '.ahkv2-toolbox.packages.json';
  private workspaceRoot: string | null = null;
  private installedPackages: PackageInfo[] = [];
  private availablePackages: PackageInfo[] = [];
  private packagesWithUpdates: PackageInfo[] = [];
  private managedPackagesByPath = new Map<string, PackageInfo>();
  private searchService: PackageSearchService;
  private installer: ArisPackageInstaller;
  private lastSearchQuery: string = '';
  private isShowingSearchResults: boolean = false;

  constructor(private context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      this.workspaceRoot = workspaceFolders[0].uri.fsPath;
    }

    // Initialize search service
    this.searchService = PackageSearchService.getInstance();
    this.installer = new ArisPackageInstaller();

    // Initialize by scanning for packages
    void this.scanForPackages().finally(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  refresh(): void {
    void this.scanForPackages().finally(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(element: PackageItem | CategoryItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PackageItem | CategoryItem): Promise<(PackageItem | CategoryItem)[]> {
    if (!element) {
      // Root level - show categories
      return this.getCategories();
    } else if (element instanceof CategoryItem) {
      // Show packages in this category
      return this.getPackagesForCategory(element.categoryType);
    }
    // PackageItem has no children
    return [];
  }

  private async getCategories(): Promise<CategoryItem[]> {
    const categories: CategoryItem[] = [];

    // Always show these categories
    categories.push(
      new CategoryItem('Installed Libraries', this.installedPackages.length, 'installed'),
      new CategoryItem('Available Libraries', this.availablePackages.length, 'available')
    );

    // Only show updates if there are any
    if (this.packagesWithUpdates.length > 0) {
      categories.push(
        new CategoryItem('Updates Available', this.packagesWithUpdates.length, 'updates')
      );
    }

    return categories;
  }

  private async getPackagesForCategory(categoryType: 'installed' | 'available' | 'updates'): Promise<PackageItem[]> {
    let packages: PackageInfo[] = [];

    switch (categoryType) {
      case 'installed':
        packages = this.installedPackages;
        break;
      case 'available':
        packages = this.availablePackages;
        break;
      case 'updates':
        packages = this.packagesWithUpdates;
        break;
    }

    return packages.map(pkg => new PackageItem(
      pkg.name,
      pkg.version,
      pkg.path,
      categoryType,
      pkg.description,
      {
        author: pkg.author,
        stars: pkg.stars,
        category: pkg.category,
        repositoryUrl: pkg.repositoryUrl,
        sourceType: pkg.sourceType,
        installSpec: pkg.installSpec,
        source: pkg.source,
        includeFormat: pkg.includeFormat,
        installLocationType: pkg.installLocationType,
        managedByExtension: pkg.managedByExtension
      }
    ));
  }

  private getPackageStatePath(): string | null {
    if (!this.workspaceRoot) {
      return null;
    }
    return path.join(this.workspaceRoot, this.packageStateFileName);
  }

  private getPathKey(targetPath: string): string {
    const resolved = path.resolve(targetPath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }

  private mergePackageInfo(base: PackageInfo, updates: PackageInfo): PackageInfo {
    return {
      ...base,
      ...updates,
      name: updates.name || base.name,
      version: updates.version || base.version,
      path: updates.path || base.path
    };
  }

  private mergeWithManagedMetadata(info: PackageInfo): PackageInfo {
    const key = this.getPathKey(info.path);
    const managed = this.managedPackagesByPath.get(key);
    if (!managed) {
      return info;
    }

    const merged: PackageInfo = {
      ...managed,
      ...info
    };

    if (!merged.source && managed.source) {
      merged.source = managed.source;
    }
    if (!merged.installSpec && managed.installSpec) {
      merged.installSpec = managed.installSpec;
    }
    if (!merged.includeFormat && managed.includeFormat) {
      merged.includeFormat = managed.includeFormat;
    }
    if (!merged.installLocationType && managed.installLocationType) {
      merged.installLocationType = managed.installLocationType;
    }
    if (!merged.repositoryUrl && managed.repositoryUrl) {
      merged.repositoryUrl = managed.repositoryUrl;
    }

    merged.managedByExtension = managed.managedByExtension || info.managedByExtension;
    return merged;
  }

  private addOrUpdateInstalledPackage(info: PackageInfo): void {
    const merged = this.mergeWithManagedMetadata(info);
    const key = this.getPathKey(merged.path);
    const existingIndex = this.installedPackages.findIndex(pkg => this.getPathKey(pkg.path) === key);

    if (existingIndex >= 0) {
      this.installedPackages[existingIndex] = this.mergePackageInfo(this.installedPackages[existingIndex], merged);
      return;
    }

    this.installedPackages.push(merged);
  }

  private async loadManagedPackageState(): Promise<Map<string, PackageInfo>> {
    const result = new Map<string, PackageInfo>();
    const statePath = this.getPackageStatePath();
    if (!statePath) {
      return result;
    }

    try {
      const content = await fs.readFile(statePath, 'utf-8');
      const parsed = JSON.parse(content);
      const records = this.extractPersistedRecords(parsed);

      for (const record of records) {
        const info = this.persistedRecordToPackageInfo(record);
        if (!info) {
          continue;
        }
        result.set(this.getPathKey(info.path), info);
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        console.warn('Failed to read managed package state:', error);
      }
    }

    return result;
  }

  private extractPersistedRecords(parsed: unknown): PersistedPackageRecord[] {
    if (Array.isArray(parsed)) {
      return parsed as PersistedPackageRecord[];
    }

    if (typeof parsed === 'object' && parsed !== null) {
      const payload = parsed as { packages?: unknown };
      if (Array.isArray(payload.packages)) {
        return payload.packages as PersistedPackageRecord[];
      }
    }

    return [];
  }

  private persistedRecordToPackageInfo(record: PersistedPackageRecord): PackageInfo | null {
    if (!record || typeof record !== 'object') {
      return null;
    }
    if (typeof record.name !== 'string' || !record.name.trim()) {
      return null;
    }
    if (typeof record.path !== 'string' || !record.path.trim()) {
      return null;
    }

    return {
      name: record.name.trim(),
      version: typeof record.version === 'string' && record.version.trim() ? record.version.trim() : 'latest',
      path: record.path.trim(),
      description: typeof record.description === 'string' ? record.description : undefined,
      author: typeof record.author === 'string' ? record.author : undefined,
      stars: typeof record.stars === 'number' ? record.stars : undefined,
      category: typeof record.category === 'string' ? record.category : undefined,
      repositoryUrl: typeof record.repositoryUrl === 'string' ? record.repositoryUrl : undefined,
      sourceType: typeof record.sourceType === 'string' ? record.sourceType : undefined,
      installSpec: typeof record.installSpec === 'string' ? record.installSpec : undefined,
      source: record.source,
      includeFormat: typeof record.includeFormat === 'string' ? record.includeFormat : undefined,
      installLocationType: record.installLocationType,
      managedByExtension: record.managedByExtension === true
    };
  }

  private packageInfoToPersistedRecord(info: PackageInfo): PersistedPackageRecord {
    return {
      name: info.name,
      version: info.version,
      path: info.path,
      description: info.description,
      author: info.author,
      stars: info.stars,
      category: info.category,
      repositoryUrl: info.repositoryUrl,
      sourceType: info.sourceType,
      installSpec: info.installSpec,
      source: info.source,
      includeFormat: info.includeFormat,
      installLocationType: info.installLocationType,
      managedByExtension: info.managedByExtension
    };
  }

  private async saveManagedPackageState(): Promise<void> {
    const statePath = this.getPackageStatePath();
    if (!statePath) {
      return;
    }

    const records = Array.from(this.managedPackagesByPath.values())
      .map(info => this.packageInfoToPersistedRecord(info))
      .sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));

    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      packages: records
    };

    await fs.writeFile(statePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  private async upsertManagedPackage(info: PackageInfo): Promise<void> {
    if (!info.path) {
      return;
    }

    const managedInfo: PackageInfo = {
      ...info,
      managedByExtension: true
    };

    this.managedPackagesByPath.set(this.getPathKey(info.path), managedInfo);
    await this.saveManagedPackageState();
  }

  private async removeManagedPackageByPath(packagePath: string): Promise<void> {
    const key = this.getPathKey(packagePath);
    if (!this.managedPackagesByPath.delete(key)) {
      return;
    }

    await this.saveManagedPackageState();
  }

  private async addManagedPackagesOutsideWorkspace(): Promise<void> {
    const staleKeys: string[] = [];

    for (const [key, managed] of this.managedPackagesByPath.entries()) {
      const alreadyListed = this.installedPackages.some(pkg => this.getPathKey(pkg.path) === key);
      if (alreadyListed) {
        continue;
      }

      const stats = await this.tryGetFileStats(managed.path);
      if (!stats) {
        staleKeys.push(key);
        continue;
      }

      let extracted: Partial<PackageInfo> | null = null;
      if (stats.isFile() && /\.(ahk|ahk2|ah2)$/i.test(managed.path)) {
        extracted = await this.extractPackageInfo(managed.path);
      }

      this.addOrUpdateInstalledPackage({
        ...managed,
        version: extracted?.version || managed.version || 'latest',
        description: extracted?.description || managed.description || 'AHK Library',
        author: extracted?.author || managed.author,
        lastModified: stats.mtime
      });
    }

    if (staleKeys.length > 0) {
      for (const key of staleKeys) {
        this.managedPackagesByPath.delete(key);
      }
      await this.saveManagedPackageState();
    }
  }

  private isPathInsideDirectory(targetPath: string, directoryPath: string): boolean {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedDirectory = path.resolve(directoryPath);
    const relative = path.relative(resolvedDirectory, resolvedTarget);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  private async isPathSafeForManagedDeletion(targetPath: string): Promise<boolean> {
    const locations = await this.getInstallLocations();
    return locations.some(location => this.isPathInsideDirectory(targetPath, location.path));
  }

  private getConfiguredIncludeFormatForLocation(locationType: InstallLocationType): string {
    const config = vscode.workspace.getConfiguration('ahkv2Toolbox');
    if (locationType === 'user') {
      return config.get<string>('userLibraryIncludeFormat', '%A_AppData%/../../AutoHotkey/v2/Lib/{name}.ahk');
    }
    if (locationType === 'system') {
      return '<{name}>';
    }
    return config.get<string>('includeFormat', 'Lib/{name}.ahk');
  }

  private getIncludeFormatForPackage(packageName: string): string {
    const installed = this.installedPackages.find(pkg => pkg.name.toLowerCase() === packageName.toLowerCase());
    if (installed?.includeFormat) {
      return installed.includeFormat;
    }
    return this.getConfiguredIncludeFormatForLocation(installed?.installLocationType || 'workspace');
  }

  /**
   * Scan workspace for installed packages and available packages
   */
  private async scanForPackages(): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }

    this.installedPackages = [];
    this.availablePackages = [];
    this.packagesWithUpdates = [];

    try {
      this.managedPackagesByPath = await this.loadManagedPackageState();

      // Scan Lib folder for installed packages
      const libPath = path.join(this.workspaceRoot, 'Lib');
      await this.scanLibraryFolder(libPath);

      // Scan vendor folder if it exists
      const vendorPath = path.join(this.workspaceRoot, 'vendor');
      await this.scanVendorFolder(vendorPath);

      // Include managed packages installed outside workspace folders.
      await this.addManagedPackagesOutsideWorkspace();

      this.installedPackages.sort((a, b) => a.name.localeCompare(b.name));

      // Load available packages from Aris index and compatible sources
      await this.loadAvailablePackages();

      // Check if newer versions are available from current index data.
      this.checkForUpdates();
    } catch (error) {
      console.error('Error scanning for packages:', error);
    }
  }

  /**
   * Scan the Lib folder for installed libraries
   */
  private async scanLibraryFolder(libPath: string): Promise<void> {
    try {
      const files = await fs.readdir(libPath);

      for (const file of files) {
        if (file.endsWith('.ahk')) {
          const filePath = path.join(libPath, file);
          const stats = await fs.stat(filePath);

          // Try to extract package info from the file
          const packageInfo = await this.extractPackageInfo(filePath);

          this.addOrUpdateInstalledPackage({
            name: path.basename(file, '.ahk'),
            version: packageInfo?.version || '1.0.0',
            description: packageInfo?.description || 'AHK Library',
            author: packageInfo?.author,
            path: filePath,
            lastModified: stats.mtime,
            installLocationType: 'workspace'
          });
        }
      }
    } catch (error) {
      // Lib folder doesn't exist or can't be read
      console.log('Lib folder not found or inaccessible');
    }
  }

  /**
   * Scan vendor folder for third-party packages
   */
  private async scanVendorFolder(vendorPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(vendorPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const packagePath = path.join(vendorPath, entry.name);

          // Look for package.json or similar manifest
          const manifestPath = path.join(packagePath, 'package.json');
          let packageInfo: any = { name: entry.name, version: '1.0.0' };

          try {
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent);
            packageInfo = {
              name: manifest.name || entry.name,
              version: manifest.version || '1.0.0',
              description: manifest.description,
              author: manifest.author
            };
          } catch {
            // No manifest file, use directory name
          }

          this.addOrUpdateInstalledPackage({
            ...packageInfo,
            path: packagePath,
            installLocationType: 'vendor'
          });
        }
      }
    } catch (error) {
      // Vendor folder doesn't exist
      console.log('Vendor folder not found');
    }
  }

  /**
   * Extract package information from AHK file header comments
   */
  private async extractPackageInfo(filePath: string): Promise<Partial<PackageInfo> | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').slice(0, 20); // Check first 20 lines

      const info: Partial<PackageInfo> = {};

      for (const line of lines) {
        // Look for version comments
        const versionMatch = line.match(/;\s*@?version\s*[:=]?\s*([\d.]+)/i);
        if (versionMatch) {
          info.version = versionMatch[1];
        }

        // Look for description
        const descMatch = line.match(/;\s*@?description\s*[:=]?\s*(.+)/i);
        if (descMatch) {
          info.description = descMatch[1].trim();
        }

        // Look for author
        const authorMatch = line.match(/;\s*@?author\s*[:=]?\s*(.+)/i);
        if (authorMatch) {
          info.author = authorMatch[1].trim();
        }
      }

      return Object.keys(info).length > 0 ? info : null;
    } catch {
      return null;
    }
  }

  /**
   * Load available packages from Aris index
   */
  private async loadAvailablePackages(): Promise<void> {
    try {
      const results = await this.searchService.getIndexPackages(150);
      this.availablePackages = results.map(result => this.mapSearchResultToPackageInfo(result));
    } catch (error) {
      console.warn('Failed to load Aris package index:', error);
      this.availablePackages = [];
    }
  }

  private mapSearchResultToPackageInfo(result: PackageSearchResult): PackageInfo {
    return {
      name: result.name,
      version: result.version,
      description: result.description,
      author: result.author,
      path: result.rawUrl || result.downloadUrl || result.repositoryUrl || result.installSpec,
      lastModified: result.lastUpdated,
      stars: result.stars,
      category: result.category,
      repositoryUrl: result.repositoryUrl,
      sourceType: result.sourceType,
      installSpec: result.installSpec,
      source: result.source
    };
  }

  /**
   * Check for package updates (mock implementation)
   */
  private checkForUpdates(): void {
    this.packagesWithUpdates = [];

    for (const installed of this.installedPackages) {
      const available = this.availablePackages.find(pkg =>
        pkg.name.toLowerCase() === installed.name.toLowerCase()
      );
      if (available && this.isNewerVersion(available.version, installed.version)) {
        this.packagesWithUpdates.push({
          ...installed,
          version: `${installed.version} → ${available.version}`
        });
      }
    }
  }

  /**
   * Compare version strings
   */
  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const normalizedNew = (newVersion || '').trim();
    const normalizedCurrent = (currentVersion || '').trim();

    // "latest" cannot be compared deterministically.
    if (!normalizedNew || !normalizedCurrent) {
      return false;
    }
    if (normalizedNew.toLowerCase() === 'latest' || normalizedCurrent.toLowerCase() === 'latest') {
      return false;
    }

    const coercedNew = semver.coerce(normalizedNew);
    const coercedCurrent = semver.coerce(normalizedCurrent);
    if (coercedNew && coercedCurrent) {
      return semver.gt(coercedNew.version, coercedCurrent.version);
    }

    const newParts = normalizedNew.split('.').map(Number);
    const currentParts = normalizedCurrent.split('.').map(Number);
    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
      const newPart = newParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      if (newPart > currentPart) {
        return true;
      }
      if (newPart < currentPart) {
        return false;
      }
    }

    return false;
  }

  /**
   * Install a package
   */
  async installPackage(packageItem: PackageItem): Promise<void> {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    try {
      // Get available install locations
      const locations = await this.getInstallLocations();

      // Let user choose install location
      const selectedLocation = await vscode.window.showQuickPick(
        locations.map(loc => ({
          label: loc.label,
          description: loc.description,
          detail: loc.path,
          location: loc
        })),
        {
          placeHolder: `Choose install location for ${packageItem.packageName}`,
          title: 'Install Library'
        }
      );

      if (!selectedLocation) {
        return; // User cancelled
      }

      const installLocation = selectedLocation.location;
      const targetDir = installLocation.path;
      const includeFormat = this.getConfiguredIncludeFormatForLocation(installLocation.installLocationType);

      vscode.window.showInformationMessage(`Installing ${packageItem.packageName} to ${selectedLocation.label}...`);

      let installedPath: string;
      let resolvedVersion = packageItem.version;

      // Handle different package sources
      if (packageItem.metadata?.source) {
        const targetPath = path.join(targetDir, `${packageItem.packageName}.ahk`);
        const installResult = await this.installer.installPackageToPath(
          packageItem.packageName,
          packageItem.metadata.source,
          targetPath
        );
        installedPath = installResult.installedPath;
        resolvedVersion = installResult.resolvedVersion || resolvedVersion;
      } else if (packageItem.packageType === 'available') {
        // Install from available packages without explicit source metadata
        installedPath = await this.downloadPackageToLocation(
          packageItem.packageName,
          packageItem.packagePath,
          targetDir,
          packageItem.metadata?.repositoryUrl
        );
      } else if (packageItem.packagePath.startsWith('http')) {
        // Direct URL installation
        installedPath = await this.downloadPackageToLocation(
          packageItem.packageName,
          packageItem.packagePath,
          targetDir,
          packageItem.metadata?.repositoryUrl
        );
      } else {
        // Mock installation (existing package)
        installedPath = packageItem.packagePath;
        vscode.window.showInformationMessage(`${packageItem.packageName} already installed at ${installedPath}`);
      }

      if (installedPath) {
        // Add to installed packages list
        const packageInfo: PackageInfo = {
          name: packageItem.packageName,
          version: resolvedVersion,
          description: packageItem.description,
          author: packageItem.metadata?.author,
          path: installedPath,
          stars: packageItem.metadata?.stars,
          category: packageItem.metadata?.category,
          repositoryUrl: packageItem.metadata?.repositoryUrl,
          sourceType: packageItem.metadata?.sourceType,
          installSpec: packageItem.metadata?.installSpec,
          source: packageItem.metadata?.source,
          includeFormat,
          installLocationType: installLocation.installLocationType,
          managedByExtension: true
        };

        this.addOrUpdateInstalledPackage(packageInfo);
        await this.upsertManagedPackage(packageInfo);

        // Show success notification with "Open" and "Add #Include" buttons
        const action = await vscode.window.showInformationMessage(
          `${packageItem.packageName} installed successfully!`,
          'Add #Include',
          'Open',
          'Dismiss'
        );

        // Handle user action
        if (action === 'Add #Include') {
          await this.addIncludeToActiveFile(packageItem.packageName, includeFormat);
        } else if (action === 'Open') {
          try {
            // Try to open the installed file
            if (installedPath.endsWith('.ahk')) {
              const doc = await vscode.workspace.openTextDocument(installedPath);
              await vscode.window.showTextDocument(doc);
            } else {
              vscode.window.showInformationMessage(`Package installed at: ${installedPath}`);
            }
          } catch (error) {
            vscode.window.showWarningMessage(`Could not open ${packageItem.packageName}. File may not exist.`);
          }
        }

        // Trigger symbol index refresh so the new library is immediately available
        // for imports and IntelliSense
        try {
          await vscode.commands.executeCommand('ahk.reindexWorkspace');
        } catch {
          // Command may not be registered if import manager isn't initialized
          console.log('Symbol reindex skipped - import manager not available');
        }

        this.refresh();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to install ${packageItem.packageName}: ${errorMessage}`);
    }
  }

  /**
   * Download package to a specific location
   * Supports GitHub repositories, raw URLs, and constructs proper AHK v2 modules
   */
  private async downloadPackageToLocation(packageName: string, packageUrl: string, targetDir: string, repositoryUrl?: string): Promise<string> {
    const targetPath = path.join(targetDir, `${packageName}.ahk`);
    return this.downloadPackageFromUrlToPath(packageName, packageUrl, targetPath, repositoryUrl);
  }

  /**
   * Download package from URL (legacy - uses workspace Lib)
   * Supports GitHub repositories, raw URLs, and constructs proper AHK v2 modules
   */
  private async downloadPackageFromUrl(packageName: string, packageUrl: string, repositoryUrl?: string): Promise<string> {
    if (!this.workspaceRoot) {
      throw new Error('No workspace folder open');
    }

    const targetPath = path.join(this.workspaceRoot, 'Lib', `${packageName}.ahk`);
    return this.downloadPackageFromUrlToPath(packageName, packageUrl, targetPath, repositoryUrl);
  }

  /**
   * Core download logic - downloads package to a specific path
   */
  private async downloadPackageFromUrlToPath(packageName: string, packageUrl: string, targetPath: string, repositoryUrl?: string): Promise<string> {

    try {
      // Construct download URL based on the source
      let downloadUrl = packageUrl;
      const downloadUrls: string[] = [];

      // If it's a GitHub repository URL, try multiple file locations
      if (repositoryUrl && repositoryUrl.includes('github.com')) {
        const repoMatch = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
        if (repoMatch) {
          const [, owner, repo] = repoMatch;
          const cleanRepo = repo.replace(/\.git$/, '');

          // Try common file locations in order of likelihood
          downloadUrls.push(
            // Main branch, root file with package name
            `https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/${packageName}.ahk`,
            // Main branch, Lib folder
            `https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/Lib/${packageName}.ahk`,
            // Main branch, src folder
            `https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/src/${packageName}.ahk`,
            // Master branch variants
            `https://raw.githubusercontent.com/${owner}/${cleanRepo}/master/${packageName}.ahk`,
            `https://raw.githubusercontent.com/${owner}/${cleanRepo}/master/Lib/${packageName}.ahk`,
            // v2 branch variants (common for AHK libraries)
            `https://raw.githubusercontent.com/${owner}/${cleanRepo}/v2/${packageName}.ahk`,
            `https://raw.githubusercontent.com/${owner}/${cleanRepo}/v2/Lib/${packageName}.ahk`,
            // Alpha branch variants (for pre-release libraries like winrt.ahk)
            `https://raw.githubusercontent.com/${owner}/${cleanRepo}/alpha/${packageName}.ahk`,
            `https://raw.githubusercontent.com/${owner}/${cleanRepo}/alpha/Lib/${packageName}.ahk`
          );
        }
      }

      // Also try the direct URL if it looks like a raw URL
      if (packageUrl.includes('raw.githubusercontent.com') || packageUrl.endsWith('.ahk')) {
        downloadUrls.unshift(packageUrl);
      }

      // Try each URL until one succeeds
      let content: string | null = null;
      let lastError: Error | null = null;

      for (const url of downloadUrls) {
        try {
          const response = await fetch(url, {
            headers: {
              'Accept': 'text/plain, application/octet-stream, */*',
              'User-Agent': 'AHK-Converter-VSCode-Extension'
            }
          });

          if (response.ok) {
            content = await response.text();

            // Validate it looks like AHK code (not a GitHub 404 page)
            if (content && !content.includes('<!DOCTYPE html>') && !content.includes('<html')) {
              break;
            }
            content = null;
          }
        } catch (urlError) {
          lastError = urlError instanceof Error ? urlError : new Error(String(urlError));
        }
      }

      if (content) {
        // Ensure Lib directory exists
        const libDir = path.dirname(targetPath);
        await fs.mkdir(libDir, { recursive: true });

        // Write the downloaded content to file
        await fs.writeFile(targetPath, content, 'utf-8');
        return targetPath;
      }

      throw lastError || new Error('No valid download URL found');
    } catch (error) {
      // If download fails, create a proper AHK v2 module placeholder
      const placeholderContent = this.generateModulePlaceholder(packageName, packageUrl, repositoryUrl);

      const libDir = path.dirname(targetPath);
      await fs.mkdir(libDir, { recursive: true });
      await fs.writeFile(targetPath, placeholderContent, 'utf-8');

      throw new Error(`Failed to download package. Created placeholder file at: ${targetPath}`);
    }
  }

  /**
   * Generate a proper AHK v2 module placeholder with correct syntax
   * Supports both #Include and native import methods
   */
  private generateModulePlaceholder(packageName: string, packageUrl: string, repositoryUrl?: string): string {
    const date = new Date().toISOString().split('T')[0];

    // Generate a module that works with BOTH #Include and import statements
    return `/************************************************************************
 * @file: ${packageName}.ahk
 * @description: Placeholder module - download manually from repository
 * @author: Auto-generated
 * @version: 0.0.0
 * @date: ${date}
 * @repository: ${repositoryUrl || packageUrl}
 * @ahk-version: v2.0+
 * @module: ${packageName}
 * @exports: ${packageName}
 ***********************************************************************/

#Requires AutoHotkey v2.0

; ============================================================================
; PLACEHOLDER MODULE - MANUAL DOWNLOAD REQUIRED
; ============================================================================
; This file was auto-generated because the package could not be downloaded.
;
; To get the actual library:
;   1. Visit: ${repositoryUrl || packageUrl}
;   2. Download the ${packageName}.ahk file
;   3. Replace this placeholder with the downloaded file
;
; Usage with #Include (AHK v2.0+):
;   #Include <${packageName}>
;   #Include Lib/${packageName}.ahk
;
; Usage with import (AHK v2.1-alpha.11+):
;   import ${packageName}
;   import {${packageName}} from ${packageName}
; ============================================================================

; Module declaration for native import support (v2.1-alpha+)
; Uncomment the next line if using native imports:
; #Module ${packageName}

/**
 * Placeholder class for ${packageName}
 * Replace this entire file with the actual library implementation
 */
class ${packageName} {
    /**
     * Constructor - placeholder
     */
    __New() {
        throw Error("${packageName} is a placeholder. Download the actual library from:\`n${repositoryUrl || packageUrl}")
    }

    /**
     * Static placeholder method
     */
    static Placeholder() {
        MsgBox("${packageName} needs to be downloaded manually.\`n\`nVisit: ${repositoryUrl || packageUrl}", "${packageName} - Placeholder", "Icon!")
    }
}

; Export for native import support (uncomment if using #Module above)
; export ${packageName}
`;
  }

  /**
   * Get available install locations
   */
  private async getInstallLocations(): Promise<InstallLocation[]> {
    const locations: InstallLocation[] = [];

    // Workspace Lib folder (default)
    if (this.workspaceRoot) {
      locations.push({
        label: 'Workspace Lib',
        path: path.join(this.workspaceRoot, 'Lib'),
        description: 'Project-specific library folder',
        installLocationType: 'workspace'
      });
    }

    // User Documents AutoHotkey Lib
    const userDocuments = process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, 'Documents', 'AutoHotkey', 'Lib')
      : null;

    if (userDocuments) {
      locations.push({
        label: 'User Library',
        path: userDocuments,
        description: '%A_MyDocuments%/AutoHotkey/Lib - Available to all scripts',
        installLocationType: 'user'
      });
    }

    // AHK v2 installation Lib (if found)
    const ahkV2Lib = this.findAhkV2LibPath();
    if (ahkV2Lib) {
      locations.push({
        label: 'System Library',
        path: ahkV2Lib,
        description: 'AHK v2 installation Lib folder - Available globally',
        installLocationType: 'system'
      });
    }

    return locations;
  }

  /**
   * Find AHK v2 installation Lib path
   */
  private findAhkV2LibPath(): string | null {
    const possiblePaths = [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'AutoHotkey', 'v2', 'Lib'),
      'C:\\Program Files\\AutoHotkey\\v2\\Lib',
      '/mnt/c/Program Files/AutoHotkey/v2/Lib'
    ];

    for (const libPath of possiblePaths) {
      try {
        if (require('fs').existsSync(libPath)) {
          return libPath;
        }
      } catch {
        // Path doesn't exist
      }
    }
    return null;
  }

  /**
   * Uninstall a package
   */
  async uninstallPackage(packageItem: PackageItem): Promise<void> {
    const answer = await vscode.window.showWarningMessage(
      `Are you sure you want to uninstall ${packageItem.packageName}?`,
      'Yes',
      'No'
    );

    if (answer !== 'Yes') {
      return;
    }

    try {
      let packageIndex = this.installedPackages.findIndex(pkg =>
        pkg.name === packageItem.packageName &&
        this.getPathKey(pkg.path) === this.getPathKey(packageItem.packagePath)
      );

      if (packageIndex < 0) {
        packageIndex = this.installedPackages.findIndex(pkg => pkg.name === packageItem.packageName);
      }

      if (packageIndex < 0) {
        vscode.window.showWarningMessage(`${packageItem.packageName} is no longer tracked in installed packages.`);
        return;
      }

      const packageToRemove = this.installedPackages[packageIndex];
      const canDeleteFile = packageToRemove.managedByExtension === true &&
        await this.isPathSafeForManagedDeletion(packageToRemove.path);

      if (canDeleteFile) {
        try {
          const stats = await fs.stat(packageToRemove.path);
          if (stats.isDirectory()) {
            await fs.rm(packageToRemove.path, { recursive: true, force: true });
          } else {
            await fs.unlink(packageToRemove.path);
          }
          vscode.window.showInformationMessage(`Removed ${packageItem.packageName} from ${packageToRemove.path}`);
        } catch (fileError) {
          console.warn(`Could not remove file ${packageToRemove.path}:`, fileError);
          vscode.window.showInformationMessage(`${packageItem.packageName} removed from package list (file may be protected)`);
        }
      } else {
        vscode.window.showInformationMessage(
          `${packageItem.packageName} removed from package list. File was not deleted because it was not manager-owned.`
        );
      }

      this.installedPackages.splice(packageIndex, 1);
      await this.removeManagedPackageByPath(packageToRemove.path);
      this.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to uninstall ${packageItem.packageName}: ${errorMessage}`);
    }
  }

  /**
   * Update a package
   */
  async updatePackage(packageItem: PackageItem): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Updating ${packageItem.packageName}...`);

      // Find the installed package to update
      const installedPackage = this.installedPackages.find(pkg =>
        pkg.name.toLowerCase() === packageItem.packageName.toLowerCase() &&
        this.getPathKey(pkg.path) === this.getPathKey(packageItem.packagePath)
      ) || this.installedPackages.find(pkg => pkg.name.toLowerCase() === packageItem.packageName.toLowerCase());
      if (!installedPackage) {
        throw new Error(`Package ${packageItem.packageName} not found in installed packages`);
      }

      let newVersion = packageItem.version;
      const downloadUrl = packageItem.packagePath;
      const repositoryUrl = packageItem.metadata?.repositoryUrl;
      const installSource = packageItem.metadata?.source || installedPackage.source;
      const previousPath = installedPackage.path;

      // If it's an update from the updates list, extract new version
      if (packageItem.packageType === 'updates') {
        const [, maybeNewVersion] = packageItem.version.split('→').map(part => part.trim());
        if (maybeNewVersion) {
          newVersion = maybeNewVersion;
        }
      }

      // Create backup of current version
      const backupPath = `${installedPackage.path}.backup`;
      try {
        await fs.copyFile(installedPackage.path, backupPath);
      } catch (backupError) {
        console.warn(`Could not create backup:`, backupError);
      }

      // Download new version if we have source metadata, repository URL, or direct URL
      if (installSource) {
        try {
          const targetPath = installedPackage.path.endsWith('.ahk')
            ? installedPackage.path
            : path.join(path.dirname(installedPackage.path), `${packageItem.packageName}.ahk`);

          const updatedResult = await this.installer.installPackageToPath(
            packageItem.packageName,
            installSource,
            targetPath
          );

          installedPackage.path = updatedResult.installedPath;
          newVersion = updatedResult.resolvedVersion || newVersion;
          installedPackage.version = newVersion;
          installedPackage.source = installSource;
          installedPackage.repositoryUrl = repositoryUrl || installedPackage.repositoryUrl;
          installedPackage.managedByExtension = true;

          vscode.window.showInformationMessage(`${packageItem.packageName} updated to version ${newVersion}`);
        } catch (downloadError) {
          const errorMessage = downloadError instanceof Error ? downloadError.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to download updated version: ${errorMessage}`);
          return;
        }
      } else if (repositoryUrl || downloadUrl.startsWith('http')) {
        try {
          // Use the same download logic as install, but keep current install location.
          const targetPath = installedPackage.path.endsWith('.ahk')
            ? installedPackage.path
            : path.join(path.dirname(installedPackage.path), `${packageItem.packageName}.ahk`);
          const updatedPath = await this.downloadPackageFromUrlToPath(
            packageItem.packageName,
            downloadUrl,
            targetPath,
            repositoryUrl
          );

          // Update the package info
          installedPackage.path = updatedPath;
          installedPackage.version = newVersion;
          installedPackage.repositoryUrl = repositoryUrl || installedPackage.repositoryUrl;
          installedPackage.managedByExtension = true;

          vscode.window.showInformationMessage(`${packageItem.packageName} updated to version ${newVersion}`);
        } catch (downloadError) {
          const errorMessage = downloadError instanceof Error ? downloadError.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to download updated version: ${errorMessage}`);
          return;
        }
      } else {
        // For packages without update sources, just update version info
        installedPackage.version = newVersion;
        vscode.window.showInformationMessage(`${packageItem.packageName} version updated to ${newVersion}`);
      }

      installedPackage.lastModified = new Date();

      // Keep managed package state in sync with path/version/source changes.
      if (this.getPathKey(previousPath) !== this.getPathKey(installedPackage.path)) {
        this.managedPackagesByPath.delete(this.getPathKey(previousPath));
      }
      if (installedPackage.managedByExtension || installedPackage.source || installedPackage.installSpec) {
        await this.upsertManagedPackage(installedPackage);
      }

      // Show success notification with "Open" button
      const action = await vscode.window.showInformationMessage(
        `${packageItem.packageName} updated successfully!`,
        'Open',
        'Dismiss'
      );

      // If user clicks "Open", open the updated file
      if (action === 'Open') {
        try {
          if (installedPackage.path.endsWith('.ahk')) {
            const doc = await vscode.workspace.openTextDocument(installedPackage.path);
            await vscode.window.showTextDocument(doc);
          } else {
            vscode.window.showInformationMessage(`Package location: ${installedPackage.path}`);
          }
        } catch (error) {
          vscode.window.showWarningMessage(`Could not open ${packageItem.packageName}.`);
        }
      }

      this.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to update ${packageItem.packageName}: ${errorMessage}`);
    }
  }

  /**
   * Add #Include line to active file or prompt user to select a file
   */
  private async addIncludeToActiveFile(packageName: string, includeFormat?: string): Promise<void> {
    try {
      // Try to get the active text editor
      let targetDocument = vscode.window.activeTextEditor?.document;

      // Check if active document is an AHK file
      if (targetDocument && !this.isAhkFile(targetDocument)) {
        targetDocument = undefined;
      }

      // If no active AHK file, prompt user to select one
      if (!targetDocument) {
        const ahkFiles = await this.findWorkspaceAhkFiles();

        if (ahkFiles.length === 0) {
          vscode.window.showWarningMessage('No .ahk files found in workspace');
          return;
        }

        // Prompt user to select a file
        const selected = await vscode.window.showQuickPick(
          ahkFiles.map(uri => ({
            label: path.basename(uri.fsPath),
            description: vscode.workspace.asRelativePath(uri),
            uri
          })),
          {
            placeHolder: `Select an .ahk file to add #Include for ${packageName}`
          }
        );

        if (!selected) {
          return; // User cancelled
        }

        targetDocument = await vscode.workspace.openTextDocument(selected.uri);
      }

      // Now insert the #Include line
      const result = await insertIncludeLine(targetDocument, {
        packageName,
        includeFormat: includeFormat || this.getIncludeFormatForPackage(packageName)
      });

      // Show result to user
      switch (result.status) {
        case 'inserted':
          vscode.window.showInformationMessage(
            `✓ Added #Include for ${packageName} at line ${result.lineNumber}`
          );
          break;
        case 'headers_added':
          vscode.window.showInformationMessage(
            `✓ Added headers and #Include for ${packageName}`
          );
          break;
        case 'already_included':
          vscode.window.showInformationMessage(
            `${packageName} is already included in this file (line ${result.lineNumber})`
          );
          break;
        case 'error':
          vscode.window.showErrorMessage(
            `Failed to add #Include: ${result.message}`
          );
          break;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error adding #Include: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if a document is an AutoHotkey file
   */
  private isAhkFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'ahk' ||
           document.languageId === 'ahk2' ||
           document.fileName.endsWith('.ahk') ||
           document.fileName.endsWith('.ahk2');
  }

  /**
   * Find all .ahk files in the workspace
   */
  private async findWorkspaceAhkFiles(): Promise<vscode.Uri[]> {
    // Search for .ahk and .ahk2 files in workspace
    const ahkFiles = await vscode.workspace.findFiles('**/*.ahk', '**/node_modules/**');
    const ahk2Files = await vscode.workspace.findFiles('**/*.ahk2', '**/node_modules/**');

    // Combine and filter out files in Lib/ and vendor/ folders (the libraries themselves)
    const allFiles = [...ahkFiles, ...ahk2Files];

    return allFiles.filter(uri => {
      const relativePath = vscode.workspace.asRelativePath(uri);
      return !relativePath.startsWith('Lib/') && !relativePath.startsWith('vendor/');
    });
  }

  private async tryGetFileStats(targetPath: string): Promise<Stats | null> {
    try {
      return await fs.stat(targetPath);
    } catch {
      return null;
    }
  }

  private getRelativePathLabel(targetPath: string): string {
    const relative = vscode.workspace.asRelativePath(targetPath, false);
    return relative.replace(/\\/g, '/');
  }

  private getIncludePreview(packageName: string): string {
    const includeFormat = this.getIncludeFormatForPackage(packageName);
    return `#Include ${includeFormat.replace('{name}', packageName)}`;
  }

  private formatFileSize(size: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = size;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    const formatted = unitIndex === 0 ? value.toString() : value.toFixed(value >= 10 ? 0 : 1);
    return `${formatted} ${units[unitIndex]}`;
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  private async openPackageFile(filePath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document, { preview: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showWarningMessage(`Unable to open file: ${message}`);
    }
  }

  private async revealInExplorer(targetPath: string): Promise<void> {
    try {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(targetPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showWarningMessage(`Unable to reveal item: ${message}`);
    }
  }

  /**
   * Show package details
   */
  async showPackageDetails(packageItem: PackageItem): Promise<void> {
    try {
      const installedInfo = this.installedPackages.find(pkg => pkg.name === packageItem.packageName);
      const absolutePath = installedInfo?.path || packageItem.packagePath;
      const stats = absolutePath ? await this.tryGetFileStats(absolutePath) : null;
      const relativePath = absolutePath ? this.getRelativePathLabel(absolutePath) : undefined;
      const includePreview = this.getIncludePreview(packageItem.packageName);
      const repositoryUrl = packageItem.metadata?.repositoryUrl || installedInfo?.repositoryUrl;

      const detailData: LibraryDetailData = {
        name: packageItem.packageName,
        version: packageItem.version,
        description: installedInfo?.description || packageItem.packageDescription,
        packageType: packageItem.packageType,
        absolutePath,
        relativePath,
        includePreview,
        author: packageItem.metadata?.author || installedInfo?.author,
        category: packageItem.metadata?.category || installedInfo?.category,
        stars: packageItem.metadata?.stars ?? installedInfo?.stars,
        repositoryUrl,
        lastModifiedLabel: stats?.mtime
          ? this.formatDate(stats.mtime)
          : installedInfo?.lastModified
            ? this.formatDate(installedInfo.lastModified)
            : undefined,
        sizeLabel: stats?.isFile() ? this.formatFileSize(stats.size) : undefined
      };

      const actions: LibraryDetailPanelActions = {};

      if (packageItem.packageType === 'installed') {
        actions.onAddInclude = async () => {
          await this.addIncludeToActiveFile(
            packageItem.packageName,
            installedInfo?.includeFormat || packageItem.metadata?.includeFormat
          );
        };
      }

      if (absolutePath && stats?.isFile()) {
        actions.onOpenFile = async () => {
          await this.openPackageFile(absolutePath);
        };
      }

      if (absolutePath && stats) {
        actions.onRevealInExplorer = async () => {
          await this.revealInExplorer(absolutePath);
        };
      }

      if (absolutePath) {
        actions.onCopyPath = async () => {
          await vscode.env.clipboard.writeText(absolutePath);
          vscode.window.showInformationMessage('Library path copied to clipboard.');
        };
      }

      if (repositoryUrl) {
        actions.onOpenRepository = async () => {
          await vscode.env.openExternal(vscode.Uri.parse(repositoryUrl));
        };
      }

      LibraryDetailPanel.show(this.context, detailData, actions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Unable to load library details: ${errorMessage}`);
    }
  }

  /**
   * Search for packages from various sources
   */
  async searchPackages(): Promise<void> {
    try {
      // Show input box with search options
      const searchQuery = await vscode.window.showInputBox({
        prompt: 'Search for AHK v2 packages',
        placeHolder: 'Name, Author/Name, github:Author/Repo, gist:hash, forums:t=123, or archive URL',
        value: this.lastSearchQuery
      });

      // User cancelled
      if (searchQuery === undefined) {
        return;
      }

      // Show progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Searching for packages...',
          cancellable: false
        },
        async (progress) => {
          try {
            // Store the query for next time
            this.lastSearchQuery = searchQuery;

            // Optionally ask for filters
            const sortOptions = await vscode.window.showQuickPick(
              [
                { label: 'Most Popular (Stars)', value: 'stars' },
                { label: 'Recently Updated', value: 'updated' },
                { label: 'Alphabetical', value: 'name' }
              ],
              {
                placeHolder: 'Sort results by...',
                ignoreFocusOut: true
              }
            );

            const filters: SearchFilters = {
              sortBy: (sortOptions?.value as 'stars' | 'updated' | 'name') || 'stars',
              sortOrder: 'desc'
            };

            // Optionally filter by category
            const categories = this.searchService.getCategories();
            const categoryOption = await vscode.window.showQuickPick(
              categories.map(cat => ({ label: cat, value: cat })),
              {
                placeHolder: 'Filter by category (optional)',
                ignoreFocusOut: true
              }
            );

            if (categoryOption && categoryOption.value !== 'All') {
              filters.category = categoryOption.value;
            }

            progress.report({ increment: 30, message: 'Resolving packages from Aris sources...' });

            // Perform the search
            const results = await this.searchService.searchPackages(
              searchQuery,
              filters,
              30 // Max results
            );

            progress.report({ increment: 60, message: 'Processing results...' });

            // Convert search results to available packages
            this.availablePackages = results.map(result => this.mapSearchResultToPackageInfo(result));

            // Mark that we're showing search results
            this.isShowingSearchResults = true;

            // Refresh the tree view
            this._onDidChangeTreeData.fire();

            // Show result count
            vscode.window.showInformationMessage(
              `Found ${results.length} package${results.length !== 1 ? 's' : ''} for "${searchQuery || 'popular packages'}"`
            );

            progress.report({ increment: 100, message: 'Complete!' });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Search failed: ${errorMessage}`);

            // If rate limited, provide helpful message
            if (errorMessage.includes('rate limit')) {
              vscode.window.showWarningMessage(
                'GitHub API rate limit exceeded. Consider adding a GitHub token in settings for higher limits.',
                'Open Settings'
              ).then(selection => {
                if (selection === 'Open Settings') {
                  vscode.commands.executeCommand('workbench.action.openSettings', 'ahkv2Toolbox.githubToken');
                }
              });
            }
          }
        }
      );
    } catch (error) {
      console.error('Search packages error:', error);
      vscode.window.showErrorMessage('Failed to search packages');
    }
  }

  /**
   * Clear search results and return to default view
   */
  clearSearch(): void {
    this.isShowingSearchResults = false;
    this.lastSearchQuery = '';
    void this.loadAvailablePackages().finally(() => {
      this._onDidChangeTreeData.fire();
    });
    vscode.window.showInformationMessage('Search results cleared');
  }

  /**
   * Open repository URL in browser
   */
  async openRepository(packageItem: PackageItem): Promise<void> {
    const source = packageItem.metadata?.source;
    const repoUrl = packageItem.metadata?.repositoryUrl
      || (source?.type === 'github' && source.repository ? `https://github.com/${source.repository}` : undefined)
      || source?.url;
    if (repoUrl) {
      vscode.env.openExternal(vscode.Uri.parse(repoUrl));
    } else {
      vscode.window.showWarningMessage(`No repository URL available for ${packageItem.packageName}`);
    }
  }
}
