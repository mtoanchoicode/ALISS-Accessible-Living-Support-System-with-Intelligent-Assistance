---
name: professional_engineering
description: Standards and practices for professional software engineering, including code review, refactoring, and documentation.
---

# Professional Engineering Standards

This skill encapsulates high-level engineering practices to ensure code quality, maintainability, and security.

## 1. Code Review Standards
When reviewing or writing code, prioritize:
- **Readability**: Ensure logic is clear and well-named.
- **Edge Cases**: Identify and handle potential boundary conditions or error states.
- **Performance**: Look for bottlenecks or inefficient algorithms.
- **Security**: Check for vulnerabilities (e.g., input sanitization, safe auth patterns).

## 2. Refactoring & Design Patterns
- **SOLID Principles**: Apply Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.
- **Clean Architecture**: Maintain clear boundaries between layers (e.g., API, Service, Data).
- **Code Smells**: Identify and refactor "God objects", deeply nested logic, and duplication.

## 3. Documentation
- **JSDoc/TSDoc**: Use for all complex TypeScript/JavaScript functions and classes.
- **Docstrings**: Use Google or NumPy style for Python code.
- **ADRs (Architectural Decision Records)**: Document significant architectural choices.
- **README Maintenance**: Keep project and directory-level READMEs up to date.

## 4. Git Workflow & Collaboration
- **Conventional Commits**: Use `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, etc.
- **Trunk-Based Development**: Favor small, frequent commits.
- **Meaningful Commit Messages**: Briefly explain the "why" behind changes.

## 5. Debugging Strategy
- Systematically diagnose runtime errors and performance bottlenecks.
- Use structured logging and profiling tools where applicable.
- Isolate issues before attempting fixes.
