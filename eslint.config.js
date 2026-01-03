import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist', 'node_modules', '*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+ with new JSX transform
      'react/prop-types': 'off', // We're using TypeScript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-case-declarations': 'off', // This rule conflicts with some switch statements
      'no-prototype-builtins': 'off', // This rule conflicts with some object property access patterns
      '@typescript-eslint/no-unused-expressions': 'off', // This rule conflicts with some conditional expressions
      'no-fallthrough': 'off', // This rule conflicts with intentional fallthrough in switch statements
      'react/no-unescaped-entities': 'warn', // Allow unescaped quotes in JSX
    },
    settings: {
      react: {
        version: 'detect', // React version is detected automatically
      },
    },
  },
  // Prettier must be last to override any conflicting rules
  prettier,
];
