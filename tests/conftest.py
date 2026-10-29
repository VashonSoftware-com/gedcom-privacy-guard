import os

import pytest

ROOT = os.path.join(os.path.dirname(__file__), "..")
SAMPLE = os.path.join(ROOT, "sample_data", "sample.ged")
FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def ged(*lines: str) -> str:
    """A minimal GEDCOM from record lines (HEAD and TRLR added)."""
    return "\n".join(["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", *lines, "0 TRLR"]) + "\n"


@pytest.fixture
def write_ged(tmp_path):
    """Write GEDCOM text (or bytes) to a temp file and return its path."""
    counter = iter(range(1000))

    def _write(content, encoding="utf-8", newline="\n") -> str:
        path = tmp_path / f"in{next(counter)}.ged"
        if isinstance(content, str):
            content = content.replace("\n", newline).encode(encoding)
        path.write_bytes(content)
        return str(path)

    return _write
