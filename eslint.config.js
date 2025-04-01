import globals from "globals";
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,                 // This adds browser APIs for Firefox and other browsers
                ...globals.webextensions,           // This adds chrome and other extension APIs
                chrome: 'readonly',       // Explicitly define Chrome API
                PromptUIManager: 'readonly',       // Explicitly define Chrome API
                InputBoxHandler: 'readonly',       // Explicitly define Chrome API
            },
            ecmaVersion: 2022,
            sourceType: "module",
        },
        rules: {
            "indent": ["error", 2],
            "linebreak-style": ["error", "unix"],   // Enforce Unix line endings
            "quotes": ["error", "single"],          // Enforce single quotes
            "semi": ["error", "always"],            // Enforce semicolons
            "no-unused-vars": "off",                // Warn on unused variables
            "no-console": "off",                    // Allow console statements for debugging
        },
        ignores: [
            "node_modules/*",
            "tests/*",
            "src/icons/*"
        ]
    }
];