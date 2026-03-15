/**
 * Metadata extracted from library files
 */
export interface LibraryMetadata {
  description?: string;
  file?: string;
  author?: string;
  link?: string;
  date?: string;
  version?: string;
}

/**
 * Utility for extracting and normalizing library metadata from various sources
 */
export class MetadataExtractor {
  public static readonly JSON_METADATA_MARKER = 'ahkv2-library-metadata';
  /**
   * Extract metadata from an AHK file header
   * Looks for JSDoc-style comments with @description, @author, etc.
   */
  public static extractFromFileContent(content: string): LibraryMetadata {
    const metadata: LibraryMetadata = {};

    // Prefer structured JSON metadata block when present
    const jsonMetadata = this.extractFromJsonBlock(content);
    if (jsonMetadata) {
      Object.assign(metadata, jsonMetadata);
    }

    // Fall back to legacy JSDoc metadata
    const headerMetadata = this.extractFromJsDocBlock(content);
    for (const [key, value] of Object.entries(headerMetadata)) {
      if (value && !metadata[key as keyof LibraryMetadata]) {
        metadata[key as keyof LibraryMetadata] = value;
      }
    }

    return metadata;
  }

  private static extractFromJsDocBlock(content: string): Partial<LibraryMetadata> {
    const metadata: Partial<LibraryMetadata> = {};

    const headerMatch = content.match(/\/\*+\s*([\s\S]*?)\*+\//);
    if (!headerMatch) {
      return metadata;
    }

    const headerContent = headerMatch[1];
    const fields = {
      description: /@description\s+(.+?)$/im,
      file: /@file\s+(.+?)$/im,
      author: /@author\s+(.+?)$/im,
      link: /@link\s+(.+?)$/im,
      date: /@date\s+(.+?)$/im,
      version: /@version\s+(.+?)$/im
    };

    for (const [key, regex] of Object.entries(fields)) {
      const match = headerContent.match(regex);
      if (match) {
        metadata[key as keyof LibraryMetadata] = match[1].trim();
      }
    }

    return metadata;
  }

  private static extractFromJsonBlock(content: string): Partial<LibraryMetadata> | null {
    const marker = MetadataExtractor.JSON_METADATA_MARKER;
    const regex = new RegExp(`/\\*+\s*${marker}[\\s\\S]*?\\*+/`, 'i');
    const match = content.match(regex);
    if (!match || match.index === undefined) {
      return null;
    }

    let block = match[0]
      .replace(/^\/\*+/, '')
      .replace(/\*+\/$/, '')
      .trim();

    if (block.toLowerCase().startsWith(marker.toLowerCase())) {
      block = block.slice(marker.length).trim();
    }

    const jsonMatch = block.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const metadata: Partial<LibraryMetadata> = {};

      for (const key of Object.keys(parsed) as (keyof LibraryMetadata)[]) {
        const value = parsed[key];
        if (typeof value === 'string' && value.trim() !== '') {
          metadata[key] = value.trim();
        }
      }

      return metadata;
    } catch (error) {
      console.warn('Failed to parse JSON metadata block:', error);
      return null;
    }
  }

  /**
   * Extract metadata from a README file
   * Looks for common patterns in README files
   */
  public static extractFromReadme(content: string): Partial<LibraryMetadata> {
    const metadata: Partial<LibraryMetadata> = {};

    // Try to extract description from first paragraph or heading
    const descriptionPatterns = [
      /^#\s+.+?\n+(.+?)(\n#{1,6}|\n\n)/s,  // First paragraph after title
      /^>\s*(.+?)$/m,                       // Blockquote description
      /^##?\s*Description\s*\n+(.+?)(\n#{1,6}|\n\n)/is,  // Description section
    ];

    for (const pattern of descriptionPatterns) {
      const match = content.match(pattern);
      if (match) {
        metadata.description = this.cleanMarkdown(match[1]).trim();
        break;
      }
    }

    // Try to extract author
    const authorPatterns = [
      /(?:Author|By|Created by):\s*\[?([^\]\n]+)\]?/i,
      /©\s*\d{4}\s+([^\n]+)/,
      /@([a-zA-Z0-9_-]+)/  // GitHub username
    ];

    for (const pattern of authorPatterns) {
      const match = content.match(pattern);
      if (match) {
        metadata.author = match[1].trim();
        break;
      }
    }

    return metadata;
  }

  /**
   * Extract version from repository releases or tags
   */
  public static extractVersionFromRelease(tagName: string): string {
    // Remove common prefixes like 'v', 'version-', 'release-'
    return tagName.replace(/^(?:version-|release-|v)/i, '').trim();
  }

  /**
   * Normalize a date string to YYYY/MM/DD format
   */
  public static normalizeDate(dateString: string): string {
    const isoMatch = dateString.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Return original if can't parse
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      return `${year}/${month}/${day}`;
    } catch {
      return dateString;
    }
  }

  /**
   * Normalize a version string to semantic versioning format when possible
   */
  public static normalizeVersion(version: string): string {
    // Remove any leading 'v' or whitespace
    version = version.replace(/^v\s*/i, '').trim();

    // Check if already in semver format (x.y.z)
    if (/^\d+\.\d+\.\d+/.test(version)) {
      return version;
    }

    // Try to extract version numbers
    const match = version.match(/(\d+)\.?(\d+)?\.?(\d+)?/);
    if (match) {
      const [, major, minor = '0', patch = '0'] = match;
      return `${major}.${minor}.${patch}`;
    }

    return version;
  }

  /**
   * Normalize a GitHub URL to its canonical form
   */
  public static normalizeGitHubUrl(url: string): string {
    // Remove .git suffix
    url = url.replace(/\.git$/, '');

    // Ensure it's the canonical HTML URL
    url = url.replace(/^git@github\.com:/, 'https://github.com/');
    url = url.replace(/^git:\/\/github\.com\//, 'https://github.com/');

    return url;
  }

  /**
   * Clean markdown formatting from text
   */
  private static cleanMarkdown(text: string): string {
    return text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove links
      .replace(/[*_~`]/g, '')                    // Remove formatting
      .replace(/\n+/g, ' ')                      // Collapse newlines
      .replace(/\s+/g, ' ')                      // Collapse whitespace
      .trim();
  }

  /**
   * Merge multiple metadata sources, preferring more complete information
   */
  public static mergeMetadata(...sources: Partial<LibraryMetadata>[]): LibraryMetadata {
    const merged: LibraryMetadata = {};

    for (const source of sources) {
      for (const key of Object.keys(source) as (keyof LibraryMetadata)[]) {
        if (source[key] && !merged[key]) {
          merged[key] = source[key];
        }
      }
    }

    return merged;
  }

  /**
   * Check which fields are missing from metadata
   */
  public static getMissingFields(metadata: Partial<LibraryMetadata>): (keyof LibraryMetadata)[] {
    const requiredFields: (keyof LibraryMetadata)[] = ['description', 'file', 'author', 'link', 'date', 'version'];
    return requiredFields.filter(field => !metadata[field]);
  }

  /**
   * Format metadata as a header comment block
   */
  public static formatAsHeader(metadata: LibraryMetadata): string {
    const lines: string[] = [
      '/************************************************************************'
    ];

    if (metadata.description) {
      lines.push(` * @description ${metadata.description}`);
    }
    if (metadata.file) {
      lines.push(` * @file ${metadata.file}`);
    }
    if (metadata.author) {
      lines.push(` * @author ${metadata.author}`);
    }
    if (metadata.link) {
      lines.push(` * @link ${metadata.link}`);
    }
    if (metadata.date) {
      lines.push(` * @date ${metadata.date}`);
    }
    if (metadata.version) {
      lines.push(` * @version ${metadata.version}`);
    }

    lines.push(' ***********************************************************************/');

    return lines.join('\n');
  }

  /**
   * Rank search results by relevance
   * @param filename The library filename we're searching for
   * @param results Search results from GitHub
   */
  public static rankSearchResults(filename: string, results: any[]): any[] {
    const baseFilename = filename.replace(/\.(ahk|ahk2)$/i, '').toLowerCase();

    return results
      .map(result => {
        let score = result.score || 0;
        const resultName = (result.name || '').toLowerCase();
        const repoName = (result.repository?.full_name || '').toLowerCase();

        // Boost exact filename matches
        if (resultName === filename.toLowerCase()) {
          score += 100;
        }

        // Boost partial filename matches
        if (resultName.includes(baseFilename)) {
          score += 50;
        }

        // Boost if filename is in repository name
        if (repoName.includes(baseFilename)) {
          score += 25;
        }

        // Boost by stars
        if (result.repository?.stargazers_count) {
          score += Math.min(result.repository.stargazers_count, 50);
        }

        // Boost recent updates
        if (result.repository?.updated_at) {
          const daysSinceUpdate = (Date.now() - new Date(result.repository.updated_at).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceUpdate < 365) {
            score += 10;
          }
        }

        return { ...result, computedScore: score };
      })
      .sort((a, b) => b.computedScore - a.computedScore);
  }
}
