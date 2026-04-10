# Hackathon Template

A full-stack hackathon template featuring Next.js frontend, Flask backend, Auth0 authentication with Google sign-in, MongoDB Atlas database, and Docker containerization.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Next.js App   │ ──────> │   Flask API     │ ──────> │  MongoDB Atlas  │
│   (Frontend)    │         │   (Backend)     │         │   (Database)    │
└─────────────────┘         └─────────────────┘         └─────────────────┘
         │                           │
         └───────────────────────────┘
                    │
         ┌─────────────────┐
         │     Auth0       │
         │  (Google OAuth) │
         └─────────────────┘
```

## Features

- **Frontend**: Next.js 16 with TypeScript, Tailwind CSS, and App Router
- **Backend**: Flask RESTful API with JWT authentication
- **Authentication**: Auth0 with Google social login
- **Database**: MongoDB Atlas integration
- **Image Storage**: Cloudinary integration for profile images
- **User Profiles**: Create and manage user profiles with images
- **AI Chatbot**: OpenRouter-powered chatbot accessible from all pages
- **Containerization**: Docker and Docker Compose setup
- **CRUD Operations**: Full Create, Read, Update, Delete functionality for Items and Profiles

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- Docker and Docker Compose
- Auth0 account (free tier available)
- MongoDB Atlas account (free tier available)
- Cloudinary account (free tier available)
- OpenRouter account (free tier available) - for AI chatbot

## Setup Instructions

### 1. Clone and Navigate

```bash
cd HackathonTemplate
```

### 2. Auth0 Configuration

1. Sign up for a free Auth0 account at https://auth0.com
2. Create a new Application:
   - Go to Applications → Create Application
   - Choose "Regular Web Application"
   - Note your Domain, Client ID, and Client Secret

3. Configure Application Settings:
   - **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`

4. Enable Google Social Connection:
   - Go to Authentication → Social
   - Click on Google
   - Enable the connection
   - Configure Google OAuth credentials (or use Auth0's default)

5. Create an API (for backend):
   - Go to Applications → APIs → Create API
   - Name: "Hackathon API"
   - Identifier: `https://YOUR_AUTH0_DOMAIN.auth0.com/api/v2/`
   - Note the Identifier (this is your Audience)

### 3. MongoDB Atlas Configuration

1. Sign up for MongoDB Atlas at https://www.mongodb.com/cloud/atlas
2. Create a free cluster (M0)
3. Create a database user:
   - Go to Database Access → Add New Database User
   - Choose Password authentication
   - Save the username and password

4. Configure Network Access:
   - Go to Network Access → Add IP Address
   - Add `0.0.0.0/0` for development (or your specific IP)

5. Get Connection String:
   - Go to Clusters → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with your database name (e.g., `hackathon_db`)

### 4. Cloudinary Configuration

1. Sign up for a free Cloudinary account at https://cloudinary.com
2. After signing up, you'll be taken to your dashboard
3. Copy your credentials from the Dashboard:
   - **Cloud Name**: Found in the dashboard URL and settings
   - **API Key**: Available in the dashboard
   - **API Secret**: Available in the dashboard (click "Reveal" to see it)

Note: Keep your API Secret secure and never commit it to version control.

### 5. OpenRouter Configuration

1. Sign up for a free OpenRouter account at https://openrouter.ai
2. Get your API key:
   - Go to https://openrouter.ai/keys
   - Create a new API key
   - Copy the key (you'll need it for the backend environment variables)

### 6. Environment Variables

**Quick Start:** Copy the example files and fill in your values:
- Root: Copy `.env.example` to `.env`
- Frontend: Copy `frontend/.env.local.example` to `frontend/.env.local`
- Backend: Copy `backend/.env.example` to `backend/.env`

#### Frontend (.env.local)

Create `frontend/.env.local` (or copy from `frontend/.env.local.example`):

```env
AUTH0_SECRET='use [openssl rand -hex 32] to generate a 32 bytes value'
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://YOUR_AUTH0_DOMAIN.auth0.com
AUTH0_CLIENT_ID=YOUR_AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET=YOUR_AUTH0_CLIENT_SECRET
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Generate AUTH0_SECRET:**
```bash
openssl rand -hex 32
```

#### Backend (.env)

Create `backend/.env` (or copy from `backend/.env.example`):

```env
FLASK_ENV=development
FLASK_SECRET_KEY=your-secret-key-here-change-in-production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hackathon_db?retryWrites=true&w=majority
MONGODB_DB_NAME=hackathon_db
AUTH0_DOMAIN=YOUR_AUTH0_DOMAIN.auth0.com
AUTH0_AUDIENCE=https://YOUR_AUTH0_DOMAIN.auth0.com/api/v2/
CORS_ORIGINS=http://localhost:3000
CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=YOUR_CLOUDINARY_API_SECRET
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
```

#### Web search (chat pipeline)

The chat pipeline can search the web when the assistant needs current information. Two providers are supported:

- **DuckDuckGo** (default, no API key): set `WEB_SEARCH_PROVIDER=duckduckgo` or leave unset.
- **SerpAPI** (Google results, requires API key): set `WEB_SEARCH_PROVIDER=serpapi` and add your key:

```env
WEB_SEARCH_PROVIDER=serpapi
SERPAPI_API_KEY=your_serpapi_key
```

Get a SerpAPI key at [serpapi.com](https://serpapi.com/). The backend also accepts the env var `SerpAPI` for the key.

#### Zoho Mail SMTP (optional)

To send email from the backend (e.g. contact form, notifications), add to `backend/.env`:

```env
# Zoho: use smtp.zoho.com for @zoho.com; smtppro.zoho.com for custom domain
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=your-zoho-email@zoho.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-zoho-email@zoho.com
```

- Use an [Application-specific password](https://www.zoho.com/mail/help/adminconsole/two-factor-authentication.html#alink5) if you have 2FA enabled.
- API: `GET /api/email/status` (check config), `POST /api/email/send` (send), `POST /api/email/test` (send test email).

#### Root .env (for Docker Compose)

Create `.env` in the root directory (or copy from `.env.example`) with all variables from both frontend and backend:

```env
# Frontend
AUTH0_SECRET='your-generated-secret'
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://YOUR_AUTH0_DOMAIN.auth0.com
AUTH0_CLIENT_ID=YOUR_AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET=YOUR_AUTH0_CLIENT_SECRET
NEXT_PUBLIC_API_URL=http://localhost:5000

# Backend
FLASK_ENV=development
FLASK_SECRET_KEY=your-secret-key-here
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hackathon_db?retryWrites=true&w=majority
MONGODB_DB_NAME=hackathon_db
AUTH0_DOMAIN=YOUR_AUTH0_DOMAIN.auth0.com
AUTH0_AUDIENCE=https://YOUR_AUTH0_DOMAIN.auth0.com/api/v2/
CORS_ORIGINS=http://localhost:3000
CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=YOUR_CLOUDINARY_API_SECRET
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
```

### 7. Running with Docker (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Run in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### 8. Running Locally (Without Docker)

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

#### Backend

```bash
cd backend
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python run.py
```

## Project Structure

```
HackathonTemplate/
├── frontend/                 # Next.js application
│   ├── app/                  # App Router structure
│   │   ├── api/              # API routes (Auth0 callbacks)
│   │   ├── dashboard/        # Protected dashboard page
│   │   ├── items/            # Items CRUD pages
│   │   ├── profile/          # Profile pages
│   │   └── layout.tsx        # Root layout with Auth0Provider
│   ├── components/           # React components
│   │   ├── ItemForm.tsx      # Create/Edit item form
│   │   ├── ItemList.tsx      # Display items list
│   │   ├── ProfileForm.tsx   # Create/Edit profile form
│   │   ├── ProfileCard.tsx   # Display profile card
│   │   ├── Chatbot.tsx       # AI chatbot component
│   │   └── Navbar.tsx        # Navigation with auth
│   ├── lib/                  # Utilities
│   │   ├── auth0.ts          # Auth0 helpers
│   │   └── api.ts            # API client functions
│   ├── public/
│   │   └── images/           # Static images (e.g. developer-help.png)
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── package.json
├── backend/                  # Flask application
│   ├── app/
│   │   ├── static/
│   │   │   └── images/       # Static assets (e.g. developer-help.png)
│   │   ├── __init__.py       # Flask app factory
│   │   ├── routes/
│   │   │   ├── items.py      # Items CRUD endpoints
│   │   │   ├── profiles.py   # Profile CRUD endpoints
│   │   │   ├── chat.py       # OpenRouter chat endpoint
│   │   │   ├── auth.py       # Auth verification
│   │   │   └── health.py     # Health check endpoint
│   │   ├── models/
│   │   │   ├── item.py       # Item model
│   │   │   └── profile.py   # Profile model
│   │   ├── config/
│   │   │   └── cloudinary_config.py  # Cloudinary configuration
│   │   └── db/
│   │       └── mongodb.py    # MongoDB connection
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.py
├── docker-compose.yml        # Orchestration
└── README.md
```

## Shared assets

Imágenes en el repo para que todo el mundo las use al hacer push:

| Archivo | Web (Next.js) | Backend (Flask) |
|---------|----------------|-----------------|
| `developer-help.png` | `frontend/public/images/` → `/images/developer-help.png` | `backend/app/static/images/` → `/static/images/developer-help.png` |
| `AI_Tutor_Judging_Silently.png` | `frontend/public/images/` → `/images/AI_Tutor_Judging_Silently.png` | `backend/app/static/images/` → `/static/images/AI_Tutor_Judging_Silently.png` |
| `friday_in_hackathome.png` | `frontend/public/images/` → `/images/friday_in_hackathome.png` | `backend/app/static/images/` → `/static/images/friday_in_hackathome.png` |
| `Student_using_AI.png` | `frontend/public/images/` → `/images/Student_using_AI.png` | `backend/app/static/images/` → `/static/images/Student_using_AI.png` |

## API Endpoints

### Health Check

- `GET /health` - Health check endpoint (no authentication required)

### Items

All item endpoints require authentication via Bearer token in the Authorization header.

- `GET /api/items` - Get all items for authenticated user
- `GET /api/items/<id>` - Get single item
- `POST /api/items` - Create new item
  ```json
  {
    "title": "Item Title",
    "description": "Item Description"
  }
  ```
- `PUT /api/items/<id>` - Update item
- `DELETE /api/items/<id>` - Delete item

### Profiles

All profile endpoints require authentication via Bearer token in the Authorization header.

- `GET /api/profiles` - Get profile for authenticated user
- `POST /api/profiles` - Create new profile (multipart/form-data)
  - `displayName` (required): User's display name
  - `bio` (optional): User biography
  - `image` (optional): Profile image file (PNG, JPG, GIF, WEBP, max 5MB)
- `PUT /api/profiles` - Update profile (multipart/form-data)
  - Same fields as POST
- `POST /api/profiles/image` - Upload profile image only
  - `image` (required): Image file

### Chat

- `POST /api/chat` - Send chat message to AI assistant (no authentication required)
  ```json
  {
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "model": "openai/gpt-3.5-turbo"
  }
  ```
  Returns:
  ```json
  {
    "message": "Assistant response",
    "usage": {...}
  }
  ```

## Usage

1. Start the application (Docker or local)
2. Navigate to http://localhost:3000
3. Click "Login with Google"
4. After authentication, you'll be redirected to the dashboard
5. Create your profile with an image (click "Create Profile" in the dashboard)
6. Create, view, edit, and delete items
7. Edit your profile anytime from the dashboard or navigation
8. Click the chat button (bottom-right) to interact with the AI assistant

## Development

### Frontend Development

- Hot reload is enabled in development mode
- TypeScript for type safety
- Tailwind CSS for styling

### Backend Development

- Flask debug mode enabled in development
- CORS configured for local development
- JWT token verification for all protected routes

## Troubleshooting

### Auth0 Issues

- Verify callback URLs match exactly
- Check that Google social connection is enabled
- Ensure Client ID and Secret are correct

### MongoDB Connection Issues

- Verify connection string format
- Check network access (IP whitelist)
- Ensure database user credentials are correct

### Cloudinary Issues

- Verify Cloudinary credentials are correct
- Check that image file size is under 5MB
- Ensure image format is supported (PNG, JPG, GIF, WEBP)
- Check Cloudinary dashboard for upload limits on free tier

### OpenRouter/Chatbot Issues

- Verify OpenRouter API key is set in backend `.env` file
- Check that the backend is running and accessible
- Ensure the API key has sufficient credits on OpenRouter
- Check backend logs for detailed error messages

### Docker Issues

- Ensure Docker and Docker Compose are installed
- Check that ports 3000 and 5000 are not in use
- Review logs: `docker-compose logs`

## Security Notes

- Never commit `.env` files to version control
- Use strong secrets in production
- Configure proper CORS origins for production
- Use environment-specific MongoDB connection strings
- Rotate Auth0 secrets regularly

## License

This is a template project. Feel free to use and modify as needed.

## Contributing

This is a hackathon template. Feel free to fork and customize for your needs!
