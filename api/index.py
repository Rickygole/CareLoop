import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app

PREFIX = "/api"


class StripPrefix:
    def __init__(self, application, prefix):
        self.application = application
        self.prefix = prefix

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            path = scope.get("path", "")
            if path.startswith(self.prefix):
                stripped = path[len(self.prefix):] or "/"
                scope = dict(scope)
                scope["path"] = stripped
                raw = scope.get("raw_path")
                if raw:
                    scope["raw_path"] = raw[len(self.prefix):] or b"/"
        await self.application(scope, receive, send)


handler = StripPrefix(app, PREFIX)
app = handler
