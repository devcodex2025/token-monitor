import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    react: true,
    typescript: true,
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.json',
      'apps/web/legacy/**',
    ],
    rules: {
      'ts/no-explicit-any': 'error',
      'node/prefer-global/process': 'off',
      'no-console': 'off',
    },
  },
)
