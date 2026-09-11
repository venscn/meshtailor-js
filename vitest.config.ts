import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const packages=['mesh-core','chaining-seams','runtime','uv','model'];
export default defineConfig({
  resolve:{alias:Object.fromEntries(packages.map(name=>['@meshtailor/'+name,fileURLToPath(new URL(`./packages/${name}/src/index.ts`,import.meta.url))]))},
  test:{environment:'node',include:['packages/**/__tests__/**/*.test.ts','apps/**/__tests__/**/*.test.ts','tests/**/*.test.ts'],testTimeout:30000},
});
