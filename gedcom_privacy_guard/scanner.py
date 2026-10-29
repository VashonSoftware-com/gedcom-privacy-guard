"""
Scanners inspect text and return Findings.

To add a new scanner (e.g. an LLM-based one later), implement the same
``scan(text, location) -> list[Finding]`` method and register it in
``cli.py``. Multiple scanners can run over the same text and their
findings simply get concatenated in the report.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from .rules import BUILTIN_RULES, RuleSet, Term, load_rules

# Characters of context shown on each side of a match in the review
# spreadsheet's snippet column -- wide enough that a reviewer can
# usually tell from the snippet alone whether a hit like "depression"
# or "prison" is a real flag or a false positive (e.g. "the Great
# Depression", "WWII prison camps") without opening the source file.
SNIPPET_CONTEXT_CHARS = 100


@dataclass
class Finding:
    category: str
    severity: str
    matched_term: str
    snippet: str  # short excerpt of the text around the match
    match_at: int = -1  # where matched_term starts within snippet


def _term_body(term: Term) -> str:
    body = re.escape(term.text)
    body = re.sub(r"(?:\\ )+", r"\\s+", body)
    return body.replace("'", "['’]")


def term_regex(term: Term) -> str:
    """Case-insensitive regex source for a term. Spaces match any
    whitespace (so a phrase split across lines still matches) and a
    straight apostrophe also matches a curly one. This is the reference
    definition (the rules editor mirrors it); the scanner runs a faster
    equivalent, see ``_TermMatcher``."""
    body = _term_body(term)
    if term.mode == "substring":
        return body
    if term.mode == "prefix":
        return rf"(?<!\w){body}\w*"
    return rf"(?<!\w){body}(?!\w)"


def _is_word_char(ch: str) -> bool:
    return ch.isalnum() or ch == "_"


class _TermMatcher:
    """Matches a category's terms quickly on a large file.

    Two things make Python's regex engine slow here: a lookbehind at the
    start of each alternative (it can't skip ahead by first character),
    and IGNORECASE. So the word-start check happens in Python after a
    match, and the regex runs on lowercased text. If lowercasing changes
    the text's length (a few characters, e.g. Turkish dotted I, do), the
    case-insensitive reference regex is used instead.
    """

    def __init__(self, terms: list[Term]):
        def alternation(ts, tail):
            bodies = sorted((_term_body(t).lower() + tail(t) for t in ts), key=len, reverse=True)
            return "|".join(bodies)

        bounded = [t for t in terms if t.mode != "substring"]
        anywhere = [t for t in terms if t.mode == "substring"]
        tail = {"word": r"(?!\w)", "prefix": r"\w*"}
        self.bounded = re.compile(alternation(bounded, lambda t: tail[t.mode])) if bounded else None
        self.anywhere = re.compile(alternation(anywhere, lambda t: "")) if anywhere else None
        reference = [term_regex(t) for t in terms]
        self.slow = re.compile("|".join(reference), re.IGNORECASE) if reference else None
        self.sources = [rx.pattern for rx in (self.bounded, self.anywhere) if rx is not None]

    def finditer(self, text: str, low: str):
        if len(low) != len(text):
            yield from ((m.start(), m.end()) for m in self.slow.finditer(text))
            return
        if self.anywhere is not None:
            for m in self.anywhere.finditer(low):
                yield m.start(), m.end()
        if self.bounded is not None:
            pos = 0
            while True:
                m = self.bounded.search(low, pos)
                if m is None:
                    break
                if m.start() > 0 and _is_word_char(low[m.start() - 1]):
                    pos = m.start() + 1  # mid-word; a real match may start later
                    continue
                yield m.start(), m.end()
                pos = max(m.end(), m.start() + 1)


def _phrase_regex(phrase: str) -> re.Pattern:
    # Exceptions take the same * syntax as terms ("prison camp*").
    return re.compile(term_regex(Term.parse(phrase)), re.IGNORECASE)


def make_snippet(text: str, start: int, end: int) -> tuple[str, int]:
    lo = max(0, start - SNIPPET_CONTEXT_CHARS)
    hi = min(len(text), end + SNIPPET_CONTEXT_CHARS)
    prefix = "..." if lo > 0 else ""
    suffix = "..." if hi < len(text) else ""
    body = text[lo:hi].replace("\r", " ").replace("\n", " ")
    # strip leading whitespace without losing track of the match offset
    stripped = body.lstrip()
    offset = start - lo - (len(body) - len(stripped))
    return f"{prefix}{stripped.rstrip()}{suffix}", len(prefix) + offset


class KeywordScanner:
    def __init__(self, rules: RuleSet | str | None = None):
        if not isinstance(rules, RuleSet):
            rules = load_rules(rules) if rules is None else _rules_from_path(rules)
        self.rules = rules
        self._global_exceptions = [_phrase_regex(e) for e in rules.exceptions]
        self._compiled: list[tuple] = []
        any_terms: list[str] = []
        any_patterns: list[str] = []
        for cat in rules.enabled:
            terms = _TermMatcher(cat.terms) if cat.terms else None
            patterns = None
            if cat.patterns:
                patterns = re.compile("|".join(f"(?:{p})" for p in cat.patterns), re.IGNORECASE)
                any_patterns.append(patterns.pattern)
            if terms is not None:
                any_terms += terms.sources
            exceptions = [_phrase_regex(e) for e in cat.exceptions]
            self._compiled.append((cat, terms, patterns, exceptions))
        # Most text matches nothing; one combined pass rules it out fast.
        # (Word starts aren't checked here, so this only ever over-matches.)
        self._any_term = re.compile("|".join(any_terms)) if any_terms else None
        self._any_pattern = (
            re.compile("|".join(any_patterns), re.IGNORECASE) if any_patterns else None
        )
        self._always = [c for c in rules.enabled if c.flag_every_value]

    def _might_match(self, text: str, low: str, location: str) -> bool:
        if any(not c.locations or location in c.locations for c in self._always):
            return True
        if len(low) != len(text):
            return True
        if self._any_term is not None and self._any_term.search(low):
            return True
        return self._any_pattern is not None and self._any_pattern.search(text) is not None

    def scan(self, text: str, location: str = "note") -> list[Finding]:
        findings: list[Finding] = []
        if not text.strip():
            return findings
        low = text.lower()
        if not self._might_match(text, low, location):
            return findings
        global_spans = None
        for cat, terms, patterns, exceptions in self._compiled:
            if cat.locations and location not in cat.locations:
                continue
            if cat.flag_every_value:
                snippet, at = make_snippet(text, 0, len(text))
                findings.append(Finding(cat.name, cat.severity, text.strip(), snippet, at))
                continue
            spans: list[tuple[int, int]] = []
            if terms is not None:
                spans += terms.finditer(text, low)
            if patterns is not None:
                spans += ((m.start(), m.end()) for m in patterns.finditer(text))
            blocked = None
            seen: set[tuple[int, int]] = set()
            for start, end in sorted(spans):
                if end == start or (start, end) in seen:
                    continue
                if any(s < end and start < e for s, e in seen):
                    continue  # overlaps a match already reported in this category
                if blocked is None:  # only look for exceptions once something matched
                    if global_spans is None:
                        global_spans = _spans(self._global_exceptions, text)
                    blocked = global_spans + _spans(exceptions, text)
                if any(s < end and start < e for s, e in blocked):
                    continue
                seen.add((start, end))
                snippet, at = make_snippet(text, start, end)
                term = " ".join(text[start:end].split())
                findings.append(Finding(cat.name, cat.severity, term, snippet, at))
        return findings


def _spans(regexes: list[re.Pattern], text: str) -> list[tuple[int, int]]:
    return [(m.start(), m.end()) for rx in regexes for m in rx.finditer(text)]


def _rules_from_path(path: str) -> RuleSet:
    """``KeywordScanner("rules.yaml")``: the built-in file means the
    default preset; anything else is a user's rules file."""
    if os.path.abspath(path) == os.path.abspath(BUILTIN_RULES):
        return load_rules()
    return load_rules(path)
