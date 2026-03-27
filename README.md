# ALISS — Accessible Living Support System with Intelligent Assistance

ALISS is an AI-powered assistive living platform designed to support individuals with accessibility needs. It combines computer vision, natural language understanding, and retrieval-augmented generation to provide real-time, context-aware assistance across web, mobile, and smart home environments.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Running the Application](#running-the-application)
- [Docker Setup](#docker-setup)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Contact & Support](#contact--support)

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | TypeScript, Next.js, Flutter |
| **Backend** | Python, FastAPI / Django |
| **Database** | PostgreSQL 13+ with pgvector, Supabase |
| **AI / ML** | YOLO, Moondream, GPT-4V, Graph Transformer |
| **Vector Search** | pgvector (semantic search via RAG) |
| **APIs** | Retrieval-Augmented Generation (RAG) |

---

## Prerequisites

Ensure the following are installed before running the project:

- **Python 3.8+** — backend runtime
- **Node.js 16+** — Next.js frontend
- **npm** or **yarn** — Node.js package manager
- **Flutter SDK 3.0+** — mobile app (optional)
- **PostgreSQL 13+** — primary database
- **Docker** — optional, for containerised setup

---

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/aliss_db

# API Keys
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Backend Configuration
BACKEND_PORT=8000
BACKEND_HOST=0.0.0.0

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> **Note:** Never commit `.env` files to version control. A `.env.example` template is provided in each service directory.

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/mtoanchoicode/ALISS-Accessible-Living-Support-System-with-Intelligent-Assistance.git
cd ALISS-Accessible-Living-Support-System-with-Intelligent-Assistance
```

### 2. Backend Setup (Python)

```bash
# Navigate to backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv

# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env

# Run database migrations (if applicable)
python manage.py migrate

# Start the backend server
python manage.py runserver
# or with uvicorn (FastAPI):
uvicorn main:app --reload
```

The backend will be available at `http://localhost:8000`.

### 3. Frontend Setup (Next.js)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
# or
yarn install

# Copy and configure environment variables
cp .env.local.example .env.local

# Start the development server
npm run dev
# or
yarn dev
```

The frontend will be available at `http://localhost:3000`.

### 4. Database Setup (PostgreSQL)

```bash
# Create the database
createdb aliss_db

# Initialise the schema
psql -U postgres -d aliss_db -f backend/schema.sql
```

Enable the pgvector extension inside your PostgreSQL instance:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

For Supabase integration, follow the [official Supabase documentation](https://supabase.com/docs).

### 5. Mobile App Setup (Flutter — Optional)

```bash
# Navigate to the Flutter app directory
cd frontend/flutter_app

# Fetch dependencies
flutter pub get

# Run on an emulator or connected device
flutter run
```

---

## Running the Application

### Development Mode

Open two terminal sessions:

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate   # macOS/Linux
python manage.py runserver
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:3000` in your browser.

### Production Mode

**Backend:**
```bash
cd backend
gunicorn wsgi:app --workers 4
```

**Frontend:**
```bash
cd frontend
npm run build
npm run start
```

---

## Docker Setup

```bash
# Build all images
docker-compose build

# Start all services
docker-compose up
```

Once running:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

---

## Testing

**Backend:**
```bash
cd backend
pytest
```

**Frontend:**
```bash
cd frontend
npm run test
```

---

## API Documentation

With the backend running, interactive API docs are available at:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## Configuration

### Camera Setup

Configure your cameras in the application settings:

- **Wearable camera** — egocentric (first-person) view
- **Indoor CCTV cameras** — whole-home coverage

### AI Model Configuration

Adjust model parameters in `backend/config/models.py`:

- YOLO object detection threshold
- Confidence levels for AI responses
- Vector embedding dimensions

### Database

Configure database connection strings in your `.env` file. Ensure the `pgvector` extension is installed for semantic search to function correctly.

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request

---

## Troubleshooting

**Backend won't start**
- Ensure PostgreSQL is running
- Verify the `DATABASE_URL` in your `.env` file
- Confirm all Python dependencies are installed: `pip install -r requirements.txt`

**Frontend won't load**
- Clear the npm cache: `npm cache clean --force`
- Reinstall dependencies: `npm install`
- Verify the backend is running at the URL specified in `NEXT_PUBLIC_API_URL`

**Database connection issues**
- Check that the PostgreSQL service is active
- Verify credentials in your `.env` file
- Ensure the pgvector extension is installed:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Contact & Support

For questions, issues, or feature requests:

- Open an issue on [GitHub](https://github.com/mtoanchoicode/ALISS-Accessible-Living-Support-System-with-Intelligent-Assistance/issues)
- Contact the development team directly

---

## Acknowledgements

- Built with support from AI and assistive technology communities
- Thanks to all contributors, testers, and accessibility advocates who shaped this project
