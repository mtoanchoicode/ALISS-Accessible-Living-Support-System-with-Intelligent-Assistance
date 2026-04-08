---
name: aliss_core_development
description: Project-specific development guidelines for the ALISS (Accessible Living Support System) stack.
---

# ALISS Core Development Guidelines

This skill provides technical guidance for the specific stack used in the ALISS project.

## 1. Frontend Development (Next.js & TypeScript)
- **Framework**: Next.js (App Router).
- **Styling**: Vanilla CSS or Tailwind CSS (as per project structure).
- **TypeScript**: Ensure strict typing for all props and logic.
- **Components**: Follow a modular component-based architecture in the `frontend/components` directory.
- **State Management**: Use React Hooks (useState, useEffect, useContext) and custom hooks in `frontend/hooks`.
- **API Client**: Consistently use the centralized client in `frontend/services/apiClient.ts`.

## 2. Backend Development (FastAPI & Python)
- **Framework**: FastAPI for high-performance async API development.
- **Validation**: Use Pydantic models for request body and response validation.
- **Auth**: Use services in `backend/services/auth_service.py` for standard authentication.
- **Database**: Integrate with Supabase/PostgreSQL, utilizing `pgvector` for similarity searches.
- **API Design**: Follow RESTful principles; use the `backend/api` directory for route definitions.

## 3. Computer Vision & AI (YOLO & ML)
- **Object Detection**: Integrate YOLOv8 using the `ultralytics` package.
- **Embedding/REID**: Use `torchreid` and `sentence-transformers` for person identification and item labeling.
- **Vector Search**: Utilize FAISS for fast similarity search within the vision pipeline.
- **Media Handling**: Manage images and videos within the `backend/gallery` and `backend/memory_images` directories.

## 4. Deployment & Infrastructure
- **Platform**: Vercel for the frontend and API staging.
- **Environment**: Maintain environment variables in `.env` (backend) and project settings.
- **CI/CD**: Leverage GitHub Actions for automated quality checks.
