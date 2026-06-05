import asyncio
import logging
from typing import Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self._clients: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def add(self, ws: WebSocket):
        async with self._lock:
            self._clients.add(ws)

    async def remove(self, ws: WebSocket):
        async with self._lock:
            self._clients.discard(ws)

    async def broadcast(self, message: str):
        async with self._lock:
            if not self._clients:
                return
            disconnected = []
            for client in self._clients:
                try:
                    await client.send_text(message)
                except Exception:
                    disconnected.append(client)
            for client in disconnected:
                self._clients.discard(client)

    @property
    def count(self) -> int:
        return len(self._clients)

    async def close_all(self):
        async with self._lock:
            for client in list(self._clients):
                try:
                    await client.close(code=1001, reason="Server shutting down")
                except Exception:
                    pass
            self._clients.clear()
