# Library Attribution Feature

## Overview

The Library Attribution feature automatically discovers and fills in missing metadata for AutoHotkey library files by searching GitHub and other sources. This helps maintain proper documentation headers for libraries in your `Lib/` folders.

## Features

- 🔍 **Automatic Discovery**: Searches GitHub for library information based on filename
- 📝 **Smart Metadata Extraction**: Parses file headers, README files, and repository information
- 🎯 **Intelligent Ranking**: Ranks search results by relevance, stars, and recency
- 🔒 **Non-Destructive**: Never overwrites existing metadata fields
- ⚡ **Rate Limit Handling**: Handles GitHub API rate limits gracefully
- 🔐 **Optional Authentication**: Support for GitHub Personal Access Tokens for higher rate limits

## Standard Metadata Format

The feature works with the standard JSDoc-style library header format:

```autohotkey
/************************************************************************
 * @description Brief description of what this library does
 * @file LibraryName.ahk
 * @author Author Name
 * @link https://github.com/username/repository
 * @date 2024/01/15
 * @version 1.0.0
 ***********************************************************************/
```

## Usage

### Command Palette

1. Open a library file (`.ahk` or `.ahk2`) in the `Lib/` folder
2. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run command: **"AHKv2 Toolbox: Discover Library Metadata"**
4. Wait for the search to complete
5. Choose to:
   - **Insert**: Add the metadata header to the file
   - **Copy to Clipboard**: Copy the header for manual editing
   - **Cancel**: Do nothing

### Context Menu

Right-click on a library file in the Explorer view and select **"Discover Library Metadata"** (if configured in menus).

### Quick Fix via Copilot

When the Problems panel reports `Missing library metadata fields`, use the lightbulb quick fix **Generate metadata JSON with Copilot**. The extension sends the current file to GitHub Copilot, receives a JSON object with the required fields, and inserts a block comment that starts with `/* ahkv2-library-metadata`. The diagnostic clears as soon as all fields (`description`, `file`, `author`, `link`, `date`, `version`) are present in that JSON block. You can rerun the quick fix at any time to refresh the metadata. Hovering the squiggle explains that the warning appears because the file lives inside a `Lib/` folder, links directly to the toolbox’s metadata page for that library, and offers a shortcut to the `ahkv2Toolbox.libraryAttribution.autoValidate` setting if you need to suppress the warning.

## Configuration

### Settings

Access settings through VS Code Settings (`Ctrl+,` / `Cmd+,`) and search for "AHKv2 Toolbox":

#### `ahkv2Toolbox.libraryAttribution.enabled`

- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable/disable the library attribution feature

#### `ahkv2Toolbox.githubToken`

- **Type**: String
- **Default**: `""` (empty)
- **Description**: GitHub Personal Access Token for API requests
- **Scope**: Application-level (not workspace-specific)

### Setting up GitHub Token (Optional but Recommended)

Without a token, you're limited to 60 requests per hour. With authentication, you get 5,000 requests per hour.

1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a descriptive name (e.g., "VS Code AHKv2 Toolbox")
4. Select scopes: **Only check `public_repo`** under "repo" (read-only public repository access)
5. Click **"Generate token"**
6. Copy the token (you won't see it again!)
7. In VS Code Settings, set `ahkv2Toolbox.githubToken` to your token

**Security Note**: The token is stored in VS Code's settings. Never share your token or commit it to version control.

## How It Works

### Search Process

1. **Filename Search**: Searches GitHub code for exact filename matches
2. **Repository Search**: If no code matches, searches for repositories with similar names
3. **Result Ranking**: Ranks results by:
   - Exact filename match (highest priority)
   - Partial filename match
   - Repository name match
   - Star count
   - Recent activity

### Metadata Extraction

For each search result, the feature attempts to extract metadata from:

1. **File Header**: Parses JSDoc-style comments in the actual library file
2. **README**: Extracts description and author from repository README
3. **Repository Info**: Uses repository description and owner
4. **Releases**: Gets version and date from latest GitHub release
5. **Commit History**: Falls back to repository update date if no releases

### Merging Strategy

- **Preserves Existing Data**: Never overwrites fields that already have values
- **Fills Missing Fields**: Only populates empty metadata fields
- **Normalizes Formats**:
  - Dates: `YYYY/MM/DD`
  - Versions: Semantic versioning (`x.y.z`)
  - URLs: Canonical GitHub HTTPS format

## Example Workflow

### Before

```autohotkey
#Requires AutoHotkey v2

class GuiEnhancerKit {
  ; Your code here
}
```

### After Discovery

```autohotkey
/************************************************************************
 * @description Elevate your AHK Gui development with extended methods and properties.
 * @file GuiEnhancerKit.ahk
 * @author Nikola Perovic
 * @link https://github.com/nperovic/GuiEnhancerKit
 * @date 2024/06/16
 * @version 1.0.0
 ***********************************************************************/

#Requires AutoHotkey v2

class GuiEnhancerKit {
  ; Your code here
}
```

## Troubleshooting

### Rate Limit Errors

**Problem**: `GitHub rate limit exceeded. Please wait XX seconds.`

**Solution**:
- Wait for the rate limit to reset (shown in error message)
- Set up a GitHub Personal Access Token (see Configuration above)

### No Results Found

**Problem**: `Could not find metadata for this library.`

**Possible Causes**:
1. Library is not hosted on GitHub
2. Library has a very different name than the filename
3. Library is in a private repository

**Solutions**:
- Manually fill in the metadata header
- Try searching GitHub directly for the library
- Contact the library author for information

### Incorrect Results

**Problem**: Found metadata is for the wrong library

**Causes**:
- Common library names can match multiple projects
- Filename collisions

**Solution**:
- Review the discovered metadata before inserting
- Manually correct any incorrect fields
- The feature preserves any existing correct fields

### API Errors

**Problem**: `GitHub API error: 401` or `403`

**Solutions**:
- Check if your GitHub token is valid
- Ensure token has `public_repo` scope
- Regenerate token if needed

## Best Practices

1. **Review Before Inserting**: Always review discovered metadata for accuracy
2. **Use Authentication**: Set up a GitHub token for better rate limits
3. **Keep Metadata Updated**: Re-run discovery after major library updates
4. **Partial Headers**: If you know some information, fill it in first - the feature won't overwrite it
5. **Report Issues**: If you find consistently wrong results, file an issue with the library name

## API Reference

### Commands

- `ahkv2Toolbox.attributeLibrary`: Discover library metadata for current or selected file

### Programmatic Usage

```typescript
import { LibraryAttributionParticipant } from './libraryAttributionParticipant';
import { MetadataExtractor } from './metadataExtractor';

// Create participant instance
const participant = new LibraryAttributionParticipant();

// Discover metadata for a file
const metadata = await participant.attributeLibrary('/path/to/LibraryName.ahk');

// Check if file needs attribution
const needsAttribution = await LibraryAttributionParticipant.needsAttribution('/path/to/file.ahk');

// Format metadata as header
const header = MetadataExtractor.formatAsHeader(metadata);
```

## Future Enhancements

Planned features for future releases:

- 📦 Support for other code hosting platforms (GitLab, Bitbucket)
- 🗂️ Local cache of discovered metadata
- 🔄 Batch processing for multiple libraries
- 📊 Metadata validation and completeness reports
- 🤖 Integration with chat participant for conversational discovery
- 🌐 Support for library registries and package managers

## Contributing

Found a bug or have a feature request? Please file an issue on the [GitHub repository](https://github.com/TrueCrimeAudit/ahk-converter/issues).

## License

This feature is part of the AHKv2 Toolbox extension and is licensed under the same terms as the main extension.
