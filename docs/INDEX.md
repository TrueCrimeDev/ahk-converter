# AHKv2 Toolbox - Documentation Index

Welcome to the comprehensive documentation for the AHKv2 Toolbox extension.

## 📚 Core Documentation

### Getting Started
- [README](../README.md) - Main extension overview and quick start
- [Installation Guide](../README.md#installation) - How to install and set up
- [User Guide](USER_GUIDE.md) - Comprehensive usage guide
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

### Feature Guides
- [Auto-Add #Include Feature](AUTO_INCLUDE_FEATURE.md) ⭐ **NEW in v0.4.3**
  - Automatic #Include insertion when installing packages
  - Smart placement, duplicate detection, format preservation
  - Configuration and usage examples
- [Function Metadata Extraction](FUNCTION_METADATA_EXTRACTION.md)
  - Advanced parameter detection
  - Variable analysis
  - Type hints support
- [Library Attribution](library-attribution.md)
  - Automatic metadata discovery from GitHub
  - Header extraction and validation

## 🔧 Technical Documentation

### Implementation Details
- [Include Insertion Rules](INCLUDE_INSERTION_RULES.md) ⭐ **NEW in v0.4.3**
  - Detailed specification for #Include insertion
  - 6 core rules with examples
  - Edge case handling
- [Implementation Summary](../IMPLEMENTATION_SUMMARY.md) ⭐ **NEW in v0.4.3**
  - Auto-Add #Include technical details
  - Quality metrics and testing
- [UI Windows & Views](WINDOWS.md)
  - Map of all extension views and panels
- [Parameter Extraction Guide](PARAMETER_EXTRACTION_GUIDE.md)
  - Parameter detection algorithm
  - Default value classification
- [Dependency Tree](DEPENDENCY_TREE.md)
  - Include dependency visualization
  - Tree building logic

### Developer Guides
- [Code Review Workflows](CODE_REVIEW_WORKFLOWS.md) ⭐ **NEW**
  - Comprehensive code analysis and review with Claude Code agents
  - Multi-agent review strategies
  - Best practices and common scenarios
- [Publishing Guide](PUBLISHING.md)
  - Release process
  - Version management
  - Extension packaging
- [Testing Dependency Tree](TESTING_DEPENDENCY_TREE.md)
  - Test scenarios for dependency features

## 🎯 Planning & Roadmap

- [Roadmap](../ROADMAP.md)
  - Future features and enhancements
  - Priority roadmap
  - Success criteria
- [Release Notes v0.4.3](../RELEASE_NOTES_v0.4.3.md) ⭐ **NEW**
  - Latest release highlights
  - Breaking changes
  - Migration guide

## 📖 Specialized Topics

### Dependency Management
- [Auto-Add #Include Feature](AUTO_INCLUDE_FEATURE.md)
- [Include Insertion Rules](INCLUDE_INSERTION_RULES.md)
- [Dependency Tree](DEPENDENCY_TREE.md)
- [Dependency Tree Improvements](DEPENDENCY_TREE_IMPROVEMENTS.md)
- [Dependency Tree Active File](DEPENDENCY_TREE_ACTIVE_FILE.md)
- [Dependency Tree Pinning](DEPENDENCY_TREE_PINNING.md)

### Code Analysis
- [Function Metadata Extraction](FUNCTION_METADATA_EXTRACTION.md)
- [Parameter Extraction Guide](PARAMETER_EXTRACTION_GUIDE.md)
- [TreeView Guide](TreeView_Guide.md)

### AI Integration
- [Chat Participant Usage](chat-participant-usage-guide.md)
  - GitHub Copilot integration
  - Available commands
  - Context-aware assistance
- [Chat Participant Testing](chat-participant-integration-test.md)
  - Integration test scenarios
- [Library Attribution Participant](library-attribution-participant-plan.md)
  - AI-powered metadata extraction

### Advanced Features
- [Advanced Features Guide](ADVANCED_FEATURES.md)
  - Profile management
  - Batch processing
  - Custom validation
- [Core Improvements Phase 2](CORE_IMPROVEMENTS_PHASE2.md)
  - Planned enhancements
  - Architecture improvements

### Tools & Utilities
- [Auto-Reload Debugger](AUTO_RELOAD_DEBUGGER.md)
  - Automatic debugger reloading
- [Debugger Window Reader](DebuggerWindowReader.md)
  - Reading debugger output
- [JSDoc Generation Guide](JSDOC_GENERATION_GUIDE.md)
  - Documentation generation

## 🔍 Quick Reference

### Configuration Settings
See [README - Settings](../README.md#settings) for all available settings.

Key settings groups:
- **Core Settings** - Basic extension configuration
- **Package Manager Settings** ⭐ NEW - Include insertion, headers, library folders
- **Batch Processing** - Conversion output management
- **Validation** - Code quality checks
- **Diff View** - Comparison display options

### Commands
See [package.json](../package.json) for complete command list.

Common commands:
- `AHK: Convert v1 to v2` - Script conversion
- `AHK: Open AHKv2 Toolbox` - Open main interface
- `AHK: Manage Conversion Profiles` - Profile management
- `AHK: Extract Function Metadata` - Metadata extraction

## 📊 Documentation Statistics

- **Total Documentation Files**: 22+
- **Latest Version**: 0.4.3
- **Last Updated**: 2025-11-07
- **New**: Code Review Workflows (Claude Code agent integration)
- **New in 0.4.3**: 3 files (Auto-Add #Include Feature, Rules, Implementation Summary)

## 🤝 Contributing

Want to improve the documentation?

1. Check existing docs in `docs/` directory
2. Follow the markdown style guide
3. Add cross-references where relevant
4. Update this index when adding new files
5. Submit a pull request

## 📞 Support

- [GitHub Issues](https://github.com/TrueCrimeAudit/ahkv2-toolbox/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/TrueCrimeAudit/ahkv2-toolbox/discussions) - Questions and community help

---

**Documentation Version**: 0.4.3
**Last Updated**: 2025-10-31
**Maintained By**: AHKv2 Toolbox Contributors
