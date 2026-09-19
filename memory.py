import os
import json
from pathlib import Path
from typing import Dict, List, Optional

def _default_memory_path():
    override = os.environ.get("CARELOOP_MEMORY_PATH")
    if override:
        return Path(override)
    if os.environ.get("VERCEL"):
        return Path("/tmp/careloop_memory.json")
    return Path(__file__).resolve().parent / "memory_store.json"


DEFAULT_PATH = _default_memory_path()


class MemoryBackend:

    def get_history(self, patient_id: str) -> List[dict]:
        raise NotImplementedError

    def append_episode(self, patient_id: str, episode: dict) -> None:
        raise NotImplementedError


class MemoryStore(MemoryBackend):

    def __init__(self, path: Optional[Path] = None):
        self.path = Path(path) if path else DEFAULT_PATH

    def _load(self) -> Dict[str, List[dict]]:
        if not self.path.exists():
            return {}
        with open(self.path) as f:
            return json.load(f)

    def _save(self, data: Dict[str, List[dict]]) -> None:
        with open(self.path, "w") as f:
            json.dump(data, f, indent=2)

    def get_history(self, patient_id: str) -> List[dict]:
        data = self._load()
        episodes = data.get(patient_id, [])
        return [e for e in episodes if not e.get("is_crisis")]

    def append_episode(self, patient_id: str, episode: dict) -> None:
        data = self._load()
        data.setdefault(patient_id, []).append(episode)
        self._save(data)

    def clear(self, patient_id: Optional[str] = None) -> None:
        if patient_id is None:
            self._save({})
            return
        data = self._load()
        data.pop(patient_id, None)
        self._save(data)


def summarize_episode(transcript: str, tier: str, action_taken: str) -> str:
    text = (transcript or "").strip()
    if len(text) > 140:
        text = text[:137] + "..."
    return f"{tier} call, action {action_taken}: {text}"
