# Package Size Optimization Report for rollup-plugin-sourcemaps2

## Current Package Stats
- **Unpacked size**: 60.1 kB
- **Packed size**: 10.5 kB
- **Total files**: 19

## 🐛 Bugs Identified

### 1. Test Files Included in Distribution (HIGH PRIORITY)
**Issue**: Test declaration files are being included in the published package
- File: `dist/__tests__/index.test.d.ts` (11B)
- **Root cause**: The rollup config filters out test files from input (`!file.includes('src/__tests__/')`) but TypeScript still generates declaration files for them

**Fix**: Update `tsconfig.json` to exclude test files from declaration generation:
```json
{
  "compilerOptions": {
    // existing options...
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "src/**/__tests__/**/*"]
}
```

### 2. Outdated Biome Configuration (MEDIUM PRIORITY)
**Issue**: Biome config uses outdated schema and invalid properties, preventing proper linting
- Schema version mismatch (1.8.3 vs 2.0.6)
- Invalid configuration keys (`organizeImports`, incorrect `files` section)

**Fix**: Already provided updated biome.json configuration

## 📉 Size Reduction Opportunities

### 1. Source Maps Size (35KB → Optional/Smaller)
**Current impact**: Source maps account for ~35KB (58%) of unpacked size
- 6 source map files: `*.js.map` and `*.cjs.map`
- Each ranges from 5.5KB to 6.7KB

**Optimization options**:
1. **Make source maps optional** in production builds
2. **Disable source maps for CJS builds** (most consumers use ESM)
3. **Use inline source maps** to reduce file count

**Implementation**:
```javascript
// rollup.config.js
const isProduction = process.env.NODE_ENV === 'production';

export default {
  // ... existing config
  output: [
    {
      dir: 'dist',
      format: 'es',
      sourcemap: !isProduction, // Disable in production
      entryFileNames: '[name].js',
      preserveModules: true,
    },
    {
      dir: 'dist',
      format: 'cjs',
      sourcemap: false, // Disable for CJS builds
      entryFileNames: '[name].cjs',
      preserveModules: true,
      generatedCode: { constBindings: true },
    },
  ],
};
```

### 2. Custom URI Decoder Overhead (2.6KB → Potentially smaller)
**Current impact**: `decode-uri-component.ts` adds 2.6KB per format (5.2KB total)
- Implements complex fallback logic for malformed URIs
- Could potentially be simplified or replaced

**Analysis needed**: Determine if the custom decoder is necessary or if Node.js built-in `decodeURIComponent` suffices for the plugin's use cases.

**Potential optimization**:
```typescript
// Simple fallback instead of complex custom decoder
function simpleDecodeURIComponent(encodedURI: string): string {
  try {
    return decodeURIComponent(encodedURI);
  } catch {
    // Simple fallback - return original string
    return encodedURI;
  }
}
```

### 3. Dual Format Output Optimization
**Current impact**: Dual ESM/CJS formats double the JavaScript code size
- Could optimize by making ESM the primary format
- Consider dropping CJS if most users are on modern Node.js

### 4. Dependency Optimization
**Current dependency**: `@rollup/pluginutils` (5.2.0)
- Only uses `createFilter` function
- Consider tree-shaking or implementing a minimal filter inline

## 📊 Estimated Size Reduction

| Optimization | Current Size | Potential Reduction | New Size |
|--------------|--------------|-------------------|----------|
| Remove source maps | 35KB | -35KB | 25KB |
| Simplify URI decoder | 5.2KB | -2-3KB | 22-23KB |
| Single format (ESM only) | 25KB | -12KB | 13KB |
| **Total Potential** | **60.1KB** | **~47KB** | **~13KB** |

## 🚀 Recommended Implementation Priority

1. **Fix test file inclusion** (immediate - bug fix)
2. **Make source maps optional** (high impact, low risk)
3. **Evaluate URI decoder necessity** (medium impact, medium risk)
4. **Consider format strategy** (high impact, requires user research)

## 📋 Implementation Checklist

- [ ] Update tsconfig.json to exclude test files
- [ ] Fix biome configuration
- [ ] Add environment-based source map generation
- [ ] Evaluate custom URI decoder usage
- [ ] Consider dependency tree-shaking
- [ ] Document breaking changes if removing CJS support

## 🎯 Quick Wins (Immediate Implementation)

The fastest path to size reduction with minimal risk:
1. Fix test file bug
2. Disable source maps in production
3. Remove CJS source maps

This alone would reduce unpacked size from 60.1KB to ~25KB (58% reduction).