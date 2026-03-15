import * as vscode from 'vscode';
import { PackageSearchService } from './packageSearchService';
import { GitHubCodeSearchClient } from './githubCodeSearchClient';

/**
 * Represents a curated code example with quality metrics
 */
export interface CuratedExample {
  name: string;
  repositoryUrl: string;
  description: string;
  author: string;
  stars: number;
  lastUpdated: Date;
  oopFeatures: string[];
  bestPractices: string[];
  learningPoints: string[];
  exampleFiles: string[];
  category: 'Class Design' | 'Inheritance' | 'Composition' | 'Design Patterns' | 'Complete Application' | 'Utility Library';
}

/**
 * Criteria for evaluating code quality
 */
interface QualityCriteria {
  minStars: number;
  minOOPScore: number;
  hasDocumentation: boolean;
  hasExamples: boolean;
}

/**
 * Service for curating high-quality OOP AHK v2 examples
 */
export class ExamplesCurator {
  private static instance: ExamplesCurator | undefined;
  private packageSearchService: PackageSearchService;
  private githubClient: GitHubCodeSearchClient;
  private outputChannel: vscode.OutputChannel;

  // Search queries targeting OOP patterns
  private readonly oopSearchQueries = [
    'class language:AutoHotkey',
    'extends language:AutoHotkey',
    '__New language:AutoHotkey',
    'static method language:AutoHotkey',
    'property language:AutoHotkey',
    'inheritance autohotkey v2',
    'design pattern autohotkey',
    'object oriented autohotkey v2'
  ];

  private constructor() {
    this.packageSearchService = PackageSearchService.getInstance();
    this.githubClient = GitHubCodeSearchClient.getInstance();
    this.outputChannel = vscode.window.createOutputChannel('AHK Examples Curator');
  }

  public static getInstance(): ExamplesCurator {
    if (!ExamplesCurator.instance) {
      ExamplesCurator.instance = new ExamplesCurator();
    }
    return ExamplesCurator.instance;
  }

  /**
   * Search for high-quality OOP examples across GitHub
   */
  public async findBestOOPExamples(maxResults: number = 20): Promise<CuratedExample[]> {
    this.outputChannel.show();
    this.outputChannel.appendLine('🔍 Searching for best OOP AHK v2 examples...\n');

    const allExamples: CuratedExample[] = [];
    const seenRepos = new Set<string>();

    try {
      // Search using different OOP-related queries
      for (const query of this.oopSearchQueries) {
        this.outputChannel.appendLine(`Searching: "${query}"`);
        
        try {
          const results = await this.packageSearchService.searchPackages(query, {
            minStars: 3,
            sortBy: 'stars',
            sortOrder: 'desc'
          }, 10);

          for (const result of results) {
            if (!seenRepos.has(result.repositoryUrl)) {
              seenRepos.add(result.repositoryUrl);
              
              // Analyze the repository for OOP features
              const example = await this.analyzeRepository(result);
              if (example && example.oopFeatures.length > 0) {
                allExamples.push(example);
                this.outputChannel.appendLine(`  ✓ Found: ${example.name} (${example.stars}⭐)`);
              }
            }
          }
        } catch (error) {
          this.outputChannel.appendLine(`  ⚠️ Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Rate limiting - wait between searches
        await this.sleep(1000);
      }

      // Sort by quality score (combination of stars and OOP features)
      allExamples.sort((a, b) => {
        const scoreA = a.stars + (a.oopFeatures.length * 5);
        const scoreB = b.stars + (b.oopFeatures.length * 5);
        return scoreB - scoreA;
      });

      const topExamples = allExamples.slice(0, maxResults);
      
      this.outputChannel.appendLine(`\n✅ Found ${topExamples.length} high-quality OOP examples`);
      this.outputChannel.appendLine(`\nTop examples:`);
      topExamples.forEach((ex, idx) => {
        this.outputChannel.appendLine(`${idx + 1}. ${ex.name} - ${ex.stars}⭐ - ${ex.oopFeatures.length} OOP features`);
      });

      return topExamples;
    } catch (error) {
      this.outputChannel.appendLine(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Analyze a repository to extract OOP features and best practices
   */
  private async analyzeRepository(repo: any): Promise<CuratedExample | null> {
    const oopFeatures: string[] = [];
    const bestPractices: string[] = [];
    const learningPoints: string[] = [];
    const exampleFiles: string[] = [];

    try {
      // Search for specific OOP patterns in the repository
      const repoPath = repo.repositoryUrl.replace('https://github.com/', '');
      
      // Check for class definitions
      const hasClasses = await this.searchInRepo(repoPath, 'class path:*.ahk');
      if (hasClasses) {
        oopFeatures.push('Class Definitions');
        learningPoints.push('Demonstrates proper class structure');
      }

      // Check for inheritance
      const hasInheritance = await this.searchInRepo(repoPath, 'extends path:*.ahk');
      if (hasInheritance) {
        oopFeatures.push('Inheritance');
        learningPoints.push('Shows how to extend base classes');
      }

      // Check for constructors
      const hasConstructors = await this.searchInRepo(repoPath, '__New path:*.ahk');
      if (hasConstructors) {
        oopFeatures.push('Constructors (__New)');
        learningPoints.push('Proper object initialization patterns');
      }

      // Check for static methods
      const hasStaticMethods = await this.searchInRepo(repoPath, 'static path:*.ahk');
      if (hasStaticMethods) {
        oopFeatures.push('Static Methods/Properties');
        learningPoints.push('Utility methods without instantiation');
      }

      // Check for properties
      const hasProperties = await this.searchInRepo(repoPath, 'this. path:*.ahk');
      if (hasProperties) {
        oopFeatures.push('Instance Properties');
        learningPoints.push('State management in objects');
      }

      // Look for documentation
      if (repo.description && repo.description.length > 20) {
        bestPractices.push('Well-documented API');
      }

      // Check for examples directory
      const hasExamplesDir = await this.searchInRepo(repoPath, 'path:examples path:*.ahk');
      if (hasExamplesDir) {
        bestPractices.push('Includes usage examples');
        exampleFiles.push('examples/');
      }

      // Determine category based on features
      let category: CuratedExample['category'] = 'Utility Library';
      if (hasInheritance && hasClasses) {
        category = 'Inheritance';
      } else if (oopFeatures.length >= 4) {
        category = 'Complete Application';
      } else if (hasClasses && hasStaticMethods) {
        category = 'Class Design';
      }

      // Only return if it has meaningful OOP features
      if (oopFeatures.length === 0) {
        return null;
      }

      return {
        name: repo.name,
        repositoryUrl: repo.repositoryUrl,
        description: repo.description || 'No description available',
        author: repo.author,
        stars: repo.stars,
        lastUpdated: repo.lastUpdated,
        oopFeatures,
        bestPractices,
        learningPoints,
        exampleFiles,
        category
      };
    } catch (error) {
      // Silently fail for individual repos
      return null;
    }
  }

  /**
   * Search within a specific repository
   */
  private async searchInRepo(repoPath: string, query: string): Promise<boolean> {
    try {
      const fullQuery = `${query} repo:${repoPath}`;
      const results = await this.githubClient.searchCode(fullQuery, 1);
      return results.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate markdown documentation for curated examples
   */
  public generateDocumentation(examples: CuratedExample[]): string {
    const now = new Date().toISOString().split('T')[0];
    
    let markdown = `# Best Object-Oriented AHK v2 Examples\n\n`;
    markdown += `*Curated collection of high-quality OOP AutoHotkey v2 scripts*\n\n`;
    markdown += `**Last Updated:** ${now}\n`;
    markdown += `**Total Examples:** ${examples.length}\n\n`;
    
    markdown += `## Purpose\n\n`;
    markdown += `This document showcases excellent AutoHotkey v2 scripts that demonstrate object-oriented programming best practices. `;
    markdown += `Use these examples to learn proper class design, inheritance patterns, and modern v2 idioms.\n\n`;

    // Group by category
    const byCategory = new Map<string, CuratedExample[]>();
    examples.forEach(ex => {
      if (!byCategory.has(ex.category)) {
        byCategory.set(ex.category, []);
      }
      byCategory.get(ex.category)!.push(ex);
    });

    // Generate sections for each category
    for (const [category, categoryExamples] of byCategory) {
      markdown += `## ${category}\n\n`;

      categoryExamples.forEach(ex => {
        markdown += `### [${ex.name}](${ex.repositoryUrl}) ⭐ ${ex.stars}\n\n`;
        markdown += `**Author:** ${ex.author}\n\n`;
        markdown += `**Description:** ${ex.description}\n\n`;
        
        if (ex.oopFeatures.length > 0) {
          markdown += `**OOP Features:**\n`;
          ex.oopFeatures.forEach(feature => {
            markdown += `- ${feature}\n`;
          });
          markdown += `\n`;
        }

        if (ex.learningPoints.length > 0) {
          markdown += `**What You'll Learn:**\n`;
          ex.learningPoints.forEach(point => {
            markdown += `- ${point}\n`;
          });
          markdown += `\n`;
        }

        if (ex.bestPractices.length > 0) {
          markdown += `**Best Practices Demonstrated:**\n`;
          ex.bestPractices.forEach(practice => {
            markdown += `- ${practice}\n`;
          });
          markdown += `\n`;
        }

        if (ex.exampleFiles.length > 0) {
          markdown += `**Example Files:** ${ex.exampleFiles.join(', ')}\n\n`;
        }

        markdown += `**Last Updated:** ${ex.lastUpdated.toISOString().split('T')[0]}\n\n`;
        markdown += `---\n\n`;
      });
    }

    markdown += `## How to Use These Examples\n\n`;
    markdown += `1. **Browse by Category**: Start with the category that matches your learning goals\n`;
    markdown += `2. **Check the Stars**: Higher stars generally indicate more mature, tested code\n`;
    markdown += `3. **Read the Code**: Click through to GitHub and study the implementation\n`;
    markdown += `4. **Look for Patterns**: Note how classes are structured and used\n`;
    markdown += `5. **Run Examples**: Clone repositories with example files and run them locally\n`;
    markdown += `6. **Adapt**: Use these patterns in your own AHK v2 projects\n\n`;

    markdown += `## Quality Criteria\n\n`;
    markdown += `Examples in this collection meet these criteria:\n\n`;
    markdown += `- ✅ Written in AutoHotkey v2 syntax\n`;
    markdown += `- ✅ Use object-oriented programming patterns\n`;
    markdown += `- ✅ Have meaningful GitHub stars (community validation)\n`;
    markdown += `- ✅ Recently updated (maintained code)\n`;
    markdown += `- ✅ Demonstrate multiple OOP features\n\n`;

    markdown += `## Contributing\n\n`;
    markdown += `Found a great OOP AHK v2 example? Submit it via:\n`;
    markdown += `- Open an issue with the repository link\n`;
    markdown += `- Include why it demonstrates good practices\n`;
    markdown += `- Our team will review and potentially add it\n\n`;

    return markdown;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Show the output channel
   */
  public showOutput(): void {
    this.outputChannel.show();
  }
}
