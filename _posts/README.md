# Blog Posts for AHKv2_LLMs Site

This directory contains blog post content intended for the [AHKv2_LLMs](https://github.com/012090120901209/AHKv2_LLMs) GitHub Pages site.

## About AHKv2_LLMs

AHKv2_LLMs is a Jekyll-based blog that explores LLM performance in AutoHotkey v2 coding tasks. The site showcases:
- How AI assistants like GitHub Copilot, ChatGPT, and Claude perform with AHK v2
- Tools and workflows for AI-assisted AHK development
- Latest AutoHotkey v2 repositories from GitHub

Visit the live site: [https://012090120901209.github.io/AHKv2_LLMs](https://012090120901209.github.io/AHKv2_LLMs)

## Posts in This Directory

### 2024-12-16: AHKv2 Toolbox - AI-Powered Development
A comprehensive overview of the AHKv2 Toolbox VS Code extension, focusing on:
- GitHub Copilot Chat integration (`@ahk` participant)
- Custom instructions for AHK v2 code generation
- AI-powered library metadata discovery
- Real-world use cases for LLM-assisted AHK development
- Code analysis and workspace navigation features

This post highlights how the extension bridges the gap between generic LLM knowledge and AutoHotkey-specific expertise.

## Usage

These blog posts are written in Jekyll format with frontmatter metadata. To use them on the AHKv2_LLMs site:

1. Copy the `.md` files from this directory to the `_posts` directory in the AHKv2_LLMs repository
2. Follow Jekyll's naming convention: `YYYY-MM-DD-title-with-dashes.md`
3. Ensure frontmatter includes:
   - `layout: post`
   - `title: "Post Title"`
   - `date: YYYY-MM-DD HH:MM:SS -0000`
   - `categories: [category1, category2]`
   - `tags: [tag1, tag2, ...]`
   - `description: "Brief description"`

## File Format

Each post follows this structure:

```markdown
---
layout: post
title: "Post Title"
date: 2024-12-16 00:00:00 -0000
categories: [tools, vscode, ai]
tags: [autohotkey, ahkv2, vscode-extension]
author: Author Name
description: "Brief description"
---

# Post Title

Content goes here...
```

## Preview Locally

To preview these posts locally before publishing to AHKv2_LLMs:

1. Clone the AHKv2_LLMs repository
2. Copy posts to its `_posts` directory
3. Install Jekyll dependencies: `bundle install`
4. Serve locally: `bundle exec jekyll serve`
5. Open `http://localhost:4000` in your browser

## Contributing

When adding new posts:
- Use descriptive filenames with dates
- Include comprehensive frontmatter metadata
- Write clear, engaging content focused on LLM/AI aspects of AHK v2 development
- Add practical examples and use cases
- Link to relevant documentation and resources

## License

Content in this directory is provided for use with the AHKv2_LLMs project and follows the same MIT license as the main AHKv2 Toolbox project.
