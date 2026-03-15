/**
 * Diagnostic Cache
 *
 * Caches validation results to avoid re-validating unchanged files.
 * Uses file modification time and content hash for invalidation.
 *
 * @module alpha/DiagnosticCache
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { CacheEntry, AlphaValidationResult } from './types';

/**
 * Cache configuration options
 */
export interface CacheOptions {
    maxSize?: number;
    ttlMs?: number;
    useContentHash?: boolean;
    useMtime?: boolean;
}

/**
 * Diagnostic Cache class for caching validation results
 */
export class DiagnosticCache {
    private cache: Map<string, CacheEntry<AlphaValidationResult>>;
    private maxSize: number;
    private ttlMs: number;
    private useContentHash: boolean;
    private useMtime: boolean;

    constructor(options: CacheOptions = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 100;
        this.ttlMs = options.ttlMs || 60000; // 1 minute default
        this.useContentHash = options.useContentHash ?? true;
        this.useMtime = options.useMtime ?? true;
    }

    /**
     * Get cached result for a file
     */
    get(filePath: string): AlphaValidationResult | undefined {
        const key = this.normalizeKey(filePath);
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return undefined;
        }

        // Check file hasn't changed
        if (!this.isValid(filePath, entry)) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.data;
    }

    /**
     * Set cached result for a file
     */
    set(filePath: string, result: AlphaValidationResult, content?: string): void {
        const key = this.normalizeKey(filePath);

        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        const entry: CacheEntry<AlphaValidationResult> = {
            data: result,
            timestamp: Date.now()
        };

        // Store file hash if using content hash
        if (this.useContentHash && content) {
            entry.fileHash = this.hashContent(content);
        } else if (this.useContentHash) {
            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                entry.fileHash = this.hashContent(fileContent);
            } catch {
                // Ignore - will use mtime only
            }
        }

        // Store mtime if using mtime
        if (this.useMtime) {
            try {
                const stats = fs.statSync(filePath);
                entry.fileMtime = stats.mtimeMs;
            } catch {
                // Ignore - will use hash only
            }
        }

        this.cache.set(key, entry);
    }

    /**
     * Check if cache entry is still valid
     */
    private isValid(filePath: string, entry: CacheEntry<AlphaValidationResult>): boolean {
        try {
            // Check mtime
            if (this.useMtime && entry.fileMtime !== undefined) {
                const stats = fs.statSync(filePath);
                if (stats.mtimeMs !== entry.fileMtime) {
                    return false;
                }
            }

            // Check content hash
            if (this.useContentHash && entry.fileHash !== undefined) {
                const content = fs.readFileSync(filePath, 'utf8');
                const currentHash = this.hashContent(content);
                if (currentHash !== entry.fileHash) {
                    return false;
                }
            }

            return true;
        } catch {
            // File doesn't exist or can't be read - invalidate
            return false;
        }
    }

    /**
     * Invalidate cache for a specific file
     */
    invalidate(filePath: string): boolean {
        const key = this.normalizeKey(filePath);
        return this.cache.delete(key);
    }

    /**
     * Invalidate cache for files matching a pattern
     */
    invalidatePattern(pattern: RegExp): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (pattern.test(key)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear all cached entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        oldestEntry: number | undefined;
        newestEntry: number | undefined;
    } {
        let oldest: number | undefined;
        let newest: number | undefined;

        for (const entry of this.cache.values()) {
            if (oldest === undefined || entry.timestamp < oldest) {
                oldest = entry.timestamp;
            }
            if (newest === undefined || entry.timestamp > newest) {
                newest = entry.timestamp;
            }
        }

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: 0, // Would need hit/miss tracking
            oldestEntry: oldest,
            newestEntry: newest
        };
    }

    /**
     * Check if a file is cached
     */
    has(filePath: string): boolean {
        return this.get(filePath) !== undefined;
    }

    /**
     * Get all cached file paths
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Evict oldest entry
     */
    private evictOldest(): void {
        let oldestKey: string | undefined;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Evict expired entries
     */
    evictExpired(): number {
        const now = Date.now();
        let count = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttlMs) {
                this.cache.delete(key);
                count++;
            }
        }

        return count;
    }

    /**
     * Normalize cache key
     */
    private normalizeKey(filePath: string): string {
        return filePath.toLowerCase().replace(/\\/g, '/');
    }

    /**
     * Hash content for comparison
     */
    private hashContent(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Update TTL setting
     */
    setTTL(ttlMs: number): void {
        this.ttlMs = ttlMs;
    }

    /**
     * Update max size setting
     */
    setMaxSize(maxSize: number): void {
        this.maxSize = maxSize;
        // Evict if over new limit
        while (this.cache.size > this.maxSize) {
            this.evictOldest();
        }
    }
}

/**
 * Singleton instance for shared use
 */
let defaultCache: DiagnosticCache | null = null;

export function getDiagnosticCache(options?: CacheOptions): DiagnosticCache {
    if (!defaultCache) {
        defaultCache = new DiagnosticCache(options);
    }
    return defaultCache;
}
