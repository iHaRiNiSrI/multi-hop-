@echo off
echo ========================================================
echo        Starting Multi-Hop RAG System
echo ========================================================
echo.
echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Multi-Hop RAG Backend" cmd /k "cd backend && python main.py"
echo.
echo [2/2] Starting React Frontend on http://localhost:5173 ...
cd frontend
start "Multi-Hop RAG Frontend" cmd /k "npm run dev"
echo.
echo All services launched! Opening browser...
timeout /t 3 /nobreak > nul
start http://localhost:5173
