from app import create_app
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend directory so it works regardless of cwd
load_dotenv(Path(__file__).resolve().parent / '.env')

app = create_app()

if __name__ == '__main__':
    # Backend = 5001, frontend = 3000. In development use 5001 so a stray PORT doesn't flip it.
    if os.getenv('FLASK_ENV') == 'development':
        port = 5001
    else:
        port = int(os.getenv('PORT', '5001'))
    debug = os.getenv('FLASK_ENV') == 'development'
    # On Windows, the reloader can trigger WinError 10038 (socket not valid) when restarting
    use_reloader = debug and sys.platform != 'win32'
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=use_reloader)
