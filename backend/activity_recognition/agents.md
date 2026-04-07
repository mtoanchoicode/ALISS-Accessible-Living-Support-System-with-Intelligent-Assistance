# AI Agent Development Guidelines

## Project Context
Project: Accessible Living Support System with Artificial Intelligence.
Primary Focus: Update Module (integration of TorchReID for person identification and pose/object detection) and Web Backend API.

## Strict Operational Boundaries
* Read-Only Zones: You may read and analyze the Context Builder module (owned by Dan and Toan) to understand the system structure. You are strictly forbidden from modifying, refactoring, or suggesting changes to their code.
* Active Zones: You are authorized to write and modify code only for the Update Module (owned by Chien and Phat) and the Web Backend integration endpoints.

## Code Generation & Styling Standards
* Language Requirement: Every code comment, commit message, and documentation string must be written entirely in English.
* Iconography: Do not use any icons or emojis in the codebase, comments, or documentation.
* Complete Blocks: Provide complete files or functions in markdown code blocks that can be copied and pasted in one go. Avoid providing fragmented snippets that require manual stitching.
* Skip Setup: Omit all environment setup, dependency installation commands, and configuration steps when providing code solutions. Focus strictly on the code logic.
* Documentation Sync: When architectural or code changes are made in any tech stack, you must rewrite and fix the corresponding design `.md` files to maintain parity. You should also write the Chien_Phat.md to summarize all the things that you have done and how to use them.

## Communication & Output Style
* Formatting Restriction: Do not use ordered or numbered lists in your responses, explanations, or code comments. Rely exclusively on bullet points, bold text, or headers for structuring information.
* Brevity: Keep explanations short and direct. Deliver the requested code without long-winded introductions or unnecessary context.