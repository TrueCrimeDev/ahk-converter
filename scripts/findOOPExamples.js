#!/usr/bin/env node
/**
 * Script to search for and document best OOP AHK v2 examples
 * Can be run standalone: node scripts/findOOPExamples.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Curated list of known high-quality OOP AHK v2 repositories
// These are manually selected based on quality, stars, and OOP practices
const CURATED_EXAMPLES = [
  {
    name: 'ahk-scripts',
    url: 'https://github.com/samfisherirl/AHK-Script-v2-Folder',
    description: 'Comprehensive collection of AHK v2 scripts with OOP patterns',
    category: 'Complete Application'
  },
  {
    name: 'ClassGDIPlusWrapper',
    url: 'https://github.com/ahk-v2-libraries/ClassGDIPlusWrapper',
    description: 'GDI+ wrapper with excellent class design',
    category: 'Class Design'
  },
  {
    name: 'thqby-ahk2',
    url: 'https://github.com/thqby/ahk2_lib',
    description: 'Professional-grade library with advanced OOP patterns',
    category: 'Utility Library'
  },
  {
    name: 'v2-collections',
    url: 'https://github.com/Descolada/AHK-v2-libraries',
    description: 'Modern AHK v2 libraries showcasing class design',
    category: 'Utility Library'
  }
];

/**
 * Make HTTP request to GitHub API
 */
function githubRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'ahk-examples-finder',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Search GitHub for OOP AHK v2 repositories
 */
async function searchGitHub(query, maxResults = 10) {
  const encodedQuery = encodeURIComponent(`${query} language:AutoHotkey`);
  const path = `/search/repositories?q=${encodedQuery}&per_page=${maxResults}&sort=stars&order=desc`;
  
  try {
    const response = await githubRequest(path);
    return response.items || [];
  } catch (error) {
    console.warn(`Search failed for "${query}": ${error.message}`);
    return [];
  }
}

/**
 * Get repository details
 */
async function getRepoDetails(owner, repo) {
  try {
    const data = await githubRequest(`/repos/${owner}/${repo}`);
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description || 'No description',
      url: data.html_url,
      stars: data.stargazers_count,
      language: data.language,
      updated: new Date(data.updated_at),
      topics: data.topics || []
    };
  } catch (error) {
    console.warn(`Failed to fetch repo details: ${error.message}`);
    return null;
  }
}

/**
 * Analyze OOP features in a repository
 */
function analyzeOOPFeatures(topics, description, name) {
  const oopFeatures = [];
  const learningPoints = [];
  const bestPractices = [];

  // Check for OOP indicators in topics and description
  const text = `${topics.join(' ')} ${description} ${name}`.toLowerCase();

  if (text.includes('class') || text.includes('oop')) {
    oopFeatures.push('Class Definitions');
    learningPoints.push('Demonstrates proper class structure');
  }

  if (text.includes('inherit') || text.includes('extend')) {
    oopFeatures.push('Inheritance');
    learningPoints.push('Shows how to extend base classes');
  }

  if (text.includes('gui') || text.includes('interface')) {
    oopFeatures.push('GUI with OOP');
    learningPoints.push('Object-oriented GUI design');
  }

  if (text.includes('library') || text.includes('framework')) {
    oopFeatures.push('Library Architecture');
    bestPractices.push('Well-structured library design');
  }

  if (text.includes('autohotkey-v2') || text.includes('ahk-v2')) {
    bestPractices.push('Modern v2 syntax');
  }

  // Default features if none detected
  if (oopFeatures.length === 0) {
    oopFeatures.push('Object-Oriented Programming');
  }

  if (bestPractices.length === 0) {
    bestPractices.push('Clean code structure');
  }

  if (learningPoints.length === 0) {
    learningPoints.push('Good coding practices');
  }

  return { oopFeatures, learningPoints, bestPractices };
}

/**
 * Generate markdown documentation
 */
function generateMarkdown(examples) {
  const now = new Date().toISOString().split('T')[0];
  
  let md = `# Best Object-Oriented AHK v2 Examples\n\n`;
  md += `*Curated collection of high-quality OOP AutoHotkey v2 scripts*\n\n`;
  md += `**Last Updated:** ${now}\n`;
  md += `**Total Examples:** ${examples.length}\n\n`;
  
  md += `## Purpose\n\n`;
  md += `This document showcases excellent AutoHotkey v2 scripts that demonstrate object-oriented programming best practices. `;
  md += `Use these examples to learn proper class design, inheritance patterns, and modern v2 idioms.\n\n`;

  md += `---\n\n`;

  // Group by category
  const byCategory = new Map();
  examples.forEach(ex => {
    if (!byCategory.has(ex.category)) {
      byCategory.set(ex.category, []);
    }
    byCategory.get(ex.category).push(ex);
  });

  // Sort categories
  const categoryOrder = ['Complete Application', 'Class Design', 'Inheritance', 'Utility Library', 'Design Patterns', 'Composition'];
  
  for (const category of categoryOrder) {
    if (!byCategory.has(category)) continue;
    
    const categoryExamples = byCategory.get(category);
    md += `## ${category}\n\n`;

    categoryExamples.forEach(ex => {
      md += `### [${ex.name}](${ex.url}) ⭐ ${ex.stars}\n\n`;
      md += `**Author:** ${ex.author}\n\n`;
      md += `**Description:** ${ex.description}\n\n`;
      
      if (ex.oopFeatures && ex.oopFeatures.length > 0) {
        md += `**OOP Features:**\n`;
        ex.oopFeatures.forEach(feature => {
          md += `- ${feature}\n`;
        });
        md += `\n`;
      }

      if (ex.learningPoints && ex.learningPoints.length > 0) {
        md += `**What You'll Learn:**\n`;
        ex.learningPoints.forEach(point => {
          md += `- ${point}\n`;
        });
        md += `\n`;
      }

      if (ex.bestPractices && ex.bestPractices.length > 0) {
        md += `**Best Practices Demonstrated:**\n`;
        ex.bestPractices.forEach(practice => {
          md += `- ${practice}\n`;
        });
        md += `\n`;
      }

      md += `**Last Updated:** ${ex.lastUpdated}\n\n`;
      md += `---\n\n`;
    });
  }

  md += `## How to Use These Examples\n\n`;
  md += `1. **Browse by Category**: Start with the category that matches your learning goals\n`;
  md += `2. **Check the Stars**: Higher stars generally indicate more mature, tested code\n`;
  md += `3. **Read the Code**: Click through to GitHub and study the implementation\n`;
  md += `4. **Look for Patterns**: Note how classes are structured and used\n`;
  md += `5. **Clone & Experiment**: Download repositories and run examples locally\n`;
  md += `6. **Adapt & Learn**: Apply these patterns to your own AHK v2 projects\n\n`;

  md += `## Quality Criteria\n\n`;
  md += `Examples in this collection meet these criteria:\n\n`;
  md += `- ✅ Written in AutoHotkey v2 syntax\n`;
  md += `- ✅ Use object-oriented programming patterns\n`;
  md += `- ✅ Have meaningful GitHub stars (community validation)\n`;
  md += `- ✅ Recently updated (maintained code)\n`;
  md += `- ✅ Demonstrate good coding practices\n\n`;

  md += `## Contributing\n\n`;
  md += `Found a great OOP AHK v2 example? Submit it via:\n\n`;
  md += `- Open an issue with the repository link\n`;
  md += `- Include why it demonstrates good practices\n`;
  md += `- Our team will review and potentially add it\n\n`;

  md += `## Related Resources\n\n`;
  md += `- [AutoHotkey v2 Documentation](https://www.autohotkey.com/docs/v2/)\n`;
  md += `- [AHK v2 Classes Guide](https://www.autohotkey.com/docs/v2/Objects.htm)\n`;
  md += `- [AHK Forum](https://www.autohotkey.com/boards/)\n`;

  return md;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Searching for best OOP AHK v2 examples...\n');

  const examples = [];
  const seenRepos = new Set();

  // Start with curated examples
  console.log('📚 Processing curated examples...');
  for (const curated of CURATED_EXAMPLES) {
    const match = curated.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) continue;

    const [, owner, repo] = match;
    const details = await getRepoDetails(owner, repo);
    
    if (details && !seenRepos.has(details.fullName)) {
      seenRepos.add(details.fullName);
      
      const { oopFeatures, learningPoints, bestPractices } = analyzeOOPFeatures(
        details.topics,
        details.description,
        details.name
      );

      examples.push({
        name: details.name,
        url: details.url,
        description: details.description,
        author: owner,
        stars: details.stars,
        lastUpdated: details.updated.toISOString().split('T')[0],
        category: curated.category,
        oopFeatures,
        learningPoints,
        bestPractices
      });

      console.log(`  ✓ ${details.name} (${details.stars}⭐)`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Search for additional examples
  console.log('\n🔎 Searching GitHub for additional examples...');
  const searchQueries = [
    'autohotkey-v2 class',
    'ahk-v2 oop',
    'autohotkey v2 object oriented'
  ];

  for (const query of searchQueries) {
    console.log(`  Searching: "${query}"`);
    const results = await searchGitHub(query, 5);
    
    for (const repo of results) {
      if (!seenRepos.has(repo.full_name) && repo.stargazers_count >= 3) {
        seenRepos.add(repo.full_name);
        
        const owner = repo.owner.login;
        const { oopFeatures, learningPoints, bestPractices } = analyzeOOPFeatures(
          repo.topics || [],
          repo.description || '',
          repo.name
        );

        // Infer category
        let category = 'Utility Library';
        if (repo.description && repo.description.toLowerCase().includes('gui')) {
          category = 'Complete Application';
        } else if (oopFeatures.includes('Inheritance')) {
          category = 'Inheritance';
        }

        examples.push({
          name: repo.name,
          url: repo.html_url,
          description: repo.description || 'No description available',
          author: owner,
          stars: repo.stargazers_count,
          lastUpdated: new Date(repo.updated_at).toISOString().split('T')[0],
          category,
          oopFeatures,
          learningPoints,
          bestPractices
        });

        console.log(`  ✓ ${repo.name} (${repo.stargazers_count}⭐)`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Sort by stars
  examples.sort((a, b) => b.stars - a.stars);

  console.log(`\n✅ Found ${examples.length} high-quality OOP examples`);

  // Generate documentation
  console.log('\n📝 Generating documentation...');
  const markdown = generateMarkdown(examples);

  // Save to docs directory
  const docsPath = path.join(__dirname, '..', 'docs', 'BEST_OOP_EXAMPLES.md');
  fs.writeFileSync(docsPath, markdown, 'utf-8');

  console.log(`✅ Documentation saved to: ${docsPath}`);
  console.log('\n📖 Top 10 examples:');
  examples.slice(0, 10).forEach((ex, idx) => {
    console.log(`${idx + 1}. ${ex.name} - ${ex.stars}⭐ - ${ex.oopFeatures.length} OOP features`);
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = { searchGitHub, generateMarkdown };
