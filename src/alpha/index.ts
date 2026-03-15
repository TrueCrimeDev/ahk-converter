/**
 * Alpha Bridge Module
 *
 * Provides integration between the AutoHotkey Alpha interpreter
 * and VS Code for real-time validation and diagnostics.
 *
 * @module alpha
 */

// Type definitions
export * from './types';

// Helper classes
export { ProcessRunner, getProcessRunner } from './ProcessRunner';
export { ErrorParser, getErrorParser } from './ErrorParser';
export { DiagnosticCache, getDiagnosticCache, type CacheOptions } from './DiagnosticCache';
export { ConfigManager, getConfigManager } from './ConfigManager';
export { DiagnosticAggregator, getDiagnosticAggregator } from './DiagnosticAggregator';
