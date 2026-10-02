import asyncio
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class QueueItem:
    chat_id: int
    message_id: int
    group_title: str
    sender_name: Optional[str]
    matched_keywords: list[str]
    recipients: list[str]
    raw_text: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    retry_count: int = 0


class ForwardQueueManager:
    def __init__(self, maxsize: int = 1000):
        self._queue: asyncio.Queue[QueueItem] = asyncio.Queue(maxsize=maxsize)
        self._total_enqueued = 0
        self._total_processed = 0

    async def put(self, item: QueueItem) -> bool:
        try:
            await self._queue.put(item)
            self._total_enqueued += 1
            return True
        except Exception:
            return False

    async def get(self) -> QueueItem:
        item = await self._queue.get()
        self._total_processed += 1
        return item

    def task_done(self):
        self._queue.task_done()

    def qsize(self) -> int:
        return self._queue.qsize()

    @property
    def stats(self) -> Dict[str, Any]:
        return {
            "current_queue_size": self._queue.qsize(),
            "total_enqueued": self._total_enqueued,
            "total_processed": self._total_processed
        }


queue_manager = ForwardQueueManager()
