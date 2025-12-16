# Deployment Guide: Publishing to AHKv2_LLMs Site

This guide explains how to publish the blog post content from this repository to the [AHKv2_LLMs GitHub Pages site](https://012090120901209.github.io/AHKv2_LLMs).

## Overview

The AHKv2_LLMs repository is a Jekyll-based blog that showcases LLM performance in AutoHotkey v2 coding tasks. This directory contains a blog post about the AHKv2 Toolbox extension that can be published to that site.

## Prerequisites

1. Access to the [AHKv2_LLMs repository](https://github.com/012090120901209/AHKv2_LLMs)
2. Basic familiarity with Jekyll (optional, but helpful)
3. Git installed on your system

## Deployment Steps

### Method 1: Direct Copy (Recommended)

1. **Clone both repositories:**
   ```bash
   # Clone AHKv2_LLMs if you haven't already
   git clone https://github.com/012090120901209/AHKv2_LLMs.git
   cd AHKv2_LLMs
   ```

2. **Copy the blog post:**
   ```bash
   # From the ahk-converter repo root, copy the post file
   cp /path/to/ahk-converter/_posts/2024-12-16-ahkv2-toolbox-ai-powered-development.md \
      /path/to/AHKv2_LLMs/_posts/
   ```

3. **Commit and push:**
   ```bash
   cd /path/to/AHKv2_LLMs
   git add _posts/2024-12-16-ahkv2-toolbox-ai-powered-development.md
   git commit -m "Add blog post: AHKv2 Toolbox - AI-Powered Development"
   git push origin main
   ```

4. **Wait for GitHub Pages to rebuild:**
   - GitHub Pages automatically rebuilds the site when you push to main
   - This typically takes 1-3 minutes
   - Visit https://012090120901209.github.io/AHKv2_LLMs to see your post

### Method 2: Use GitHub Web Interface

1. Navigate to https://github.com/012090120901209/AHKv2_LLMs
2. Go to the `_posts` directory
3. Click "Add file" → "Upload files"
4. Drag and drop `2024-12-16-ahkv2-toolbox-ai-powered-development.md` from your local `_posts` folder
5. Add commit message: "Add blog post: AHKv2 Toolbox - AI-Powered Development"
6. Commit directly to main branch
7. Wait for GitHub Pages to rebuild

### Method 3: Create Pull Request

For a more controlled deployment:

1. Fork the AHKv2_LLMs repository (if you haven't already)
2. Clone your fork
3. Create a new branch:
   ```bash
   git checkout -b add-ahkv2-toolbox-post
   ```
4. Copy the blog post file to `_posts/`
5. Commit and push to your fork
6. Create a Pull Request on GitHub
7. Review and merge when ready

## Testing Locally Before Deployment

To preview the post before publishing:

1. **Set up Jekyll locally:**
   ```bash
   cd /path/to/AHKv2_LLMs
   bundle install  # First time only
   ```

2. **Serve the site locally:**
   ```bash
   bundle exec jekyll serve
   ```

3. **Open in browser:**
   - Navigate to http://localhost:4000
   - The new post should appear in the blog list
   - Click to view and verify formatting

4. **Verify content:**
   - Check that frontmatter is correct
   - Ensure all links work
   - Verify code blocks render properly
   - Check that images display (if any)

## Post-Deployment Checklist

After publishing to AHKv2_LLMs:

- [ ] Visit the live site: https://012090120901209.github.io/AHKv2_LLMs
- [ ] Verify the post appears in the blog list
- [ ] Click on the post and verify:
  - [ ] Title and metadata display correctly
  - [ ] All sections render properly
  - [ ] Code blocks have syntax highlighting
  - [ ] Links work correctly
  - [ ] Tags and categories are correct
- [ ] Check mobile responsiveness
- [ ] Share the post link on relevant platforms

## Customization Options

Before deploying, you may want to customize:

### Update the Date
Change the date in the filename and frontmatter to match the actual publish date:
```yaml
date: 2024-12-16 00:00:00 -0000  # Update this
```

### Adjust Categories and Tags
Modify to match the AHKv2_LLMs site's taxonomy:
```yaml
categories: [tools, vscode, ai]
tags: [autohotkey, ahkv2, vscode-extension, github-copilot, ai-assistant, development-tools]
```

### Update Links
If the VS Code Marketplace link changes, update line 238:
```markdown
- 📦 [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=your-publisher.ahkv2-toolbox)
```

### Add Images
To add screenshots or images:

1. Add images to `assets/images/` in the AHKv2_LLMs repo
2. Reference in the blog post:
   ```markdown
   ![Screenshot description](/assets/images/ahkv2-toolbox-screenshot.png)
   ```

## Troubleshooting

### Post doesn't appear on the site
- Check the filename follows `YYYY-MM-DD-title.md` format
- Verify the date in frontmatter isn't in the future
- Ensure the post is in the `_posts` directory
- Check GitHub Actions for build errors

### Formatting looks wrong
- Verify Jekyll frontmatter is properly formatted (YAML)
- Check for missing closing code blocks (```)
- Ensure markdown syntax is correct
- Test locally with `bundle exec jekyll serve`

### Build fails on GitHub Pages
- Check the Actions tab in the AHKv2_LLMs repo
- Review error messages in the failed build
- Common issues: invalid frontmatter, unsupported markdown syntax

## Additional Resources

- [Jekyll Documentation](https://jekyllrb.com/docs/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Markdown Guide](https://www.markdownguide.org/)
- [YAML Syntax](https://yaml.org/spec/1.2.2/)

## Support

If you encounter issues:
1. Check the [AHKv2_LLMs repository](https://github.com/012090120901209/AHKv2_LLMs) for existing issues
2. Review the [ahk-converter issues](https://github.com/012090120901209/ahk-converter/issues) for related problems
3. Create a new issue with details about the problem

---

**Last Updated:** 2024-12-16  
**Maintained by:** AHKv2 Toolbox Team
