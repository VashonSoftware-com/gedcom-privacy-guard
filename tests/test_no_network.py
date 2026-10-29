"""Nothing leaves your computer: checked, not just promised.

Three checks back the claim in docs/safety.md:

1. No module in the package imports anything that can reach a network or
   start another program.
2. A full scan -> rules -> redact -> editor run, with a Python audit hook
   that fails the test on any socket, DNS lookup or new process, even one
   made inside PyYAML or openpyxl.
3. The rules editor page forbids every network request in its
   Content-Security-Policy and contains no web addresses its code could
   call.
"""

import ast
import pathlib
import re
import shutil
import sys

import pytest
from conftest import SAMPLE

from gedcom_privacy_guard.cli import main

PACKAGE = pathlib.Path(__file__).parent.parent / "gedcom_privacy_guard"
EDITOR = PACKAGE / "editor"

NETWORK_MODULES = {
    "aiohttp",
    "asyncio",
    "ftplib",
    "http",
    "httpx",
    "imaplib",
    "multiprocessing",
    "poplib",
    "requests",
    "smtplib",
    "socket",
    "socketserver",
    "ssl",
    "subprocess",
    "telnetlib",
    "urllib",
    "urllib3",
    "xmlrpc",
}
# `editor` opens the bundled page (a local file) in the user's browser.
ALLOWED = {("cli.py", "webbrowser")}

AUDIT_EVENTS = {
    "socket.connect",
    "socket.bind",
    "socket.getaddrinfo",
    "socket.gethostbyname",
    "socket.sendto",
    "subprocess.Popen",
    "os.system",
    "os.exec",
    "os.posix_spawn",
    "os.spawn",
    "os.startfile",
    "urllib.Request",
}
_blocked = {"on": False, "seen": []}


def _audit(event, _args):
    if _blocked["on"] and event in AUDIT_EVENTS:
        _blocked["seen"].append(event)
        raise RuntimeError(f"network or process access attempted: {event}")


# An audit hook can't be removed, so it stays installed and only acts
# while a test switches it on.
sys.addaudithook(_audit)


@pytest.fixture
def offline():
    _blocked.update(on=True, seen=[])
    yield _blocked["seen"]
    _blocked["on"] = False


def _imports(path):
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            yield from (a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            yield node.module.split(".")[0]


def test_package_imports_nothing_that_reaches_a_network():
    found = [
        f"{py.name} imports {mod}"
        for py in sorted(PACKAGE.rglob("*.py"))
        for mod in _imports(py)
        if (mod in NETWORK_MODULES or mod == "webbrowser") and (py.name, mod) not in ALLOWED
    ]
    assert found == []


def test_hook_catches_a_connection(offline):
    """Guard against a silent no-op: the hook must block a real attempt."""
    import socket

    with pytest.raises(RuntimeError, match="socket"):
        socket.getaddrinfo("example.com", 443)
    assert offline


def test_whole_workflow_runs_offline(tmp_path, offline):
    ged = tmp_path / "tree.ged"
    shutil.copy(SAMPLE, ged)
    report, cleaned = tmp_path / "review.xlsx", tmp_path / "cleaned.ged"

    assert main(["scan", str(ged), "--out", str(report)]) == 0
    assert main(["rules", "--preset", "cautious", "--verbose"]) == 0
    assert main(["redact", str(ged), "--report", str(report), "--out", str(cleaned)]) == 0
    assert main(["editor", "--no-browser"]) in (0, None)
    assert cleaned.exists()
    assert offline == []


def test_editor_page_forbids_network_requests():
    html = (EDITOR / "rules-editor.html").read_text(encoding="utf-8")
    csp = re.search(r'Content-Security-Policy"\s+content="([^"]+)"', html).group(1)
    directives = dict(d.strip().split(" ", 1) for d in csp.split(";") if d.strip())
    assert directives["default-src"] == "'none'"  # covers fetch, XHR, WebSocket, fonts
    assert "connect-src" not in directives
    assert directives["form-action"] == "'none'"
    assert "http" not in directives["script-src"]


def test_editor_code_has_no_web_addresses():
    """Only licence banners and comments may mention a URL."""
    for path in [EDITOR / "rules-editor.html", *EDITOR.glob("*.js")]:
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "://" in line and not line.lstrip().startswith(("//", "/*", "*", "<!--")):
                pytest.fail(f"{path.name}:{n} has a web address: {line.strip()}")
