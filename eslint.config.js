import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'docs/api/**',
      'public/**',
      '.devcontainer/**',
      'coverage/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ── Naming consistency (Pragmatic Programmer: DRY, consistent naming) ──
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        {
          selector: 'function',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike', // class, interface, typeAlias, enum
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['PascalCase'],
        },
        {
          selector: 'property',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'method',
          format: ['camelCase'],
        },
      ],

      // ── Cyclomatic complexity ──
      complexity: ['warn', { max: 30 }],
      'max-depth': ['warn', 5],
      'max-nested-callbacks': ['warn', 4],

      // ── Large file / function detection ──
      'max-lines': ['warn', { max: 600, skipComments: true, skipBlankLines: true }],
      'max-lines-per-function': ['warn', { max: 150, skipComments: true, skipBlankLines: true }],

      // ── Dead code / unused ──
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-unused-expressions': 'error',
      'no-unreachable': 'error',

      // ── Tech debt tracking: enforce TODO(TICKET) ──
      'no-warning-comments': ['warn', { terms: ['todo', 'fixme'], location: 'anywhere' }],

      // ── General quality ──
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'off',
      'prefer-const': 'warn',
      'no-console': 'off', // Devvit logs via console
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      // Tests are allowed to be longer and more complex
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      complexity: 'off',
      'no-warning-comments': 'off',
    },
  },
);
