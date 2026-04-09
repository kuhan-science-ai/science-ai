# Physics Nexus Node.js

This is a simpler Node.js version of your website using:

- Express server
- Physics AI route that can use either OpenAI or a local Ollama model
- Crossref paper-search route
- Static frontend
- Firebase-ready Google sign-in in the browser

## Project files

- `server.js` - Node.js server and API routes
- `public/index.html` - webpage
- `public/styles.css` - styling
- `public/app.js` - frontend logic and Firebase sign-in setup
- `.env.example` - server environment variables

## Setup

1. Install Node.js 18 or newer.
2. Open this folder in PowerShell.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Choose an AI provider in `.env`.
6. Run `node server.js`.
7. Open `http://localhost:3000`.

## Local open-source model with Ollama

1. Install Ollama for Windows from [Ollama's Windows docs](https://docs.ollama.com/windows).
2. Start Ollama.
3. Pull a model in PowerShell, for example:
   `ollama pull gemma3`
4. Keep these values in `.env`:
   `AI_PROVIDER=ollama`
   `OLLAMA_BASE_URL=http://localhost:11434`
   `OLLAMA_MODEL=gemma3`
5. Start this app with `node server.js`.

## OpenAI option

If you want to keep using OpenAI instead, set:

`AI_PROVIDER=openai`

and add:

`OPENAI_API_KEY=your_openai_api_key_here`

## To make Google sign-in real

1. Create a Firebase project.
2. Enable Google Authentication.
3. Add `localhost` as an authorized domain.
4. Paste your Firebase config values into `public/app.js`.

## Important

- The Physics AI is real after you configure either Ollama or OpenAI in `.env`.
- Google sign-in is real after you configure Firebase in `public/app.js`.
- Notes and draft generation are saved in the browser only.
