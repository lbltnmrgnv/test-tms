import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import * as eslintPluginImport from 'eslint-plugin-import';
import eslintPluginNext from '@next/eslint-plugin-next';

export default tseslint.config(
  {
    name: 'testtcms/ignore-globally',
    ignores: ['**/node_modules/', '**/.next/', '**/docs/', '**/coverage/'],
  },
  {
    name: 'testtcms/load-plugins',
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      import: eslintPluginImport,
      react: eslintPluginReact,
      'react-hooks': eslintPluginReactHooks,
      '@next/next': eslintPluginNext,
    },
    settings: {
      react: {
        version: 'detect',
      },
      next: {
        rootDir: './*',
      },
    },
  },
  // Following settings ar on/off rules
  {
    name: 'testtcms/global-tuning',
    extends: [eslint.configs.recommended],
    rules: {
      'import/order': 'error',
      'no-unused-vars': 'error',
    },
  },
  {
    name: 'testtcms/for-typescript',
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      tseslint.configs.strict,
      eslintPluginReact.configs.flat.recommended,
      eslintPluginReact.configs.flat['jsx-runtime'],
    ],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      'react/prop-types': 'off',
      ...eslintPluginReactHooks.configs.recommended.rules,
    },
  },
  {
    name: 'testtcms/for-nextjs',
    files: ['frontend/**/*.{ts,tsx,js,jsx}'],
    rules: {
      ...eslintPluginNext.configs.recommended.rules,
      ...eslintPluginNext.configs['core-web-vitals'].rules,
    },
  },
  {
    name: 'eslint-config-prettier',
    ...eslintConfigPrettier,
  }
);
