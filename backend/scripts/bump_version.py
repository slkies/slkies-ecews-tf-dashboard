"""Cut a release: bump app/VERSION, commit it, and tag it in git.

    python bump_version.py minor      1.0 -> 1.1   (2.3.1 -> 2.4)
    python bump_version.py major      1.4 -> 2.0
    python bump_version.py patch      2.3 -> 2.3.1 (2.3.1 -> 2.3.2)
    python bump_version.py --show     what is the current version?

What the two numbers mean here, so the choice is not a matter of taste:

    MINOR   Anything the team will notice but nothing they have to relearn.
            A new panel, a fixed chart, a faster page, a new column in an
            export. Most releases are minor.

    MAJOR   The meaning of a number on the screen changed, or a workflow did.
            A new definition of an indicator, a different cohort rule, a page
            that moves or disappears, a change to what an export contains.
            If a state team's briefing note would now be wrong, it is major.

    PATCH   A fix to something just released that changes nothing anyone
            reads: a button out of reach, a dialog that does not fit. No
            figure moves and nothing new appears. The third part is dropped
            again at the next minor or major release.

The rule of thumb: minor means "look at the new thing", major means "check what
you thought you knew".

The tag is the record. `git tag` lists every release, `git show v1.2` says what
was in it, and `git log v1.1..v1.2` says what changed between two of them -
which is why the version is tagged rather than only written in a file.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

VERSION_FILE = Path(__file__).resolve().parent.parent / "app" / "VERSION"


def git(*args: str, check: bool = True) -> str:
    r = subprocess.run(("git", *args), cwd=VERSION_FILE.parent,
                       capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed:\n{r.stderr.strip()}")
    return r.stdout.strip()


def read() -> tuple[int, int, int]:
    raw = VERSION_FILE.read_text(encoding="utf-8").strip()
    parts = raw.split(".")
    try:
        if len(parts) not in (2, 3):
            raise ValueError
        major, minor, patch = (int(p) for p in (parts + ["0"])[:3])
    except ValueError:
        raise SystemExit(f"{VERSION_FILE} should hold MAJOR.MINOR or "
                         f"MAJOR.MINOR.PATCH, not {raw!r}")
    return major, minor, patch


def label(major: int, minor: int, patch: int) -> str:
    """2.3 for a minor or major release, 2.3.1 for a patch on it."""
    return f"{major}.{minor}.{patch}" if patch else f"{major}.{minor}"


def bumped(cur: tuple[int, int, int], part: str) -> tuple[int, int, int]:
    major, minor, patch = cur
    if part == "major":
        return major + 1, 0, 0
    if part == "minor":
        return major, minor + 1, 0
    return major, minor, patch + 1


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("part", nargs="?", choices=("major", "minor", "patch"))
    ap.add_argument("--show", action="store_true",
                    help="print the current version and exit")
    ap.add_argument("--dry-run", action="store_true",
                    help="say what would happen, change nothing")
    a = ap.parse_args()

    cur = read()
    if a.show or not a.part:
        print(f"  current version : {label(*cur)}")
        tag = git("describe", "--tags", "--abbrev=0", check=False)
        if tag:
            n = git("rev-list", "--count", f"{tag}..HEAD", check=False)
            print(f"  latest tag      : {tag}"
                  + (f"  ({n} commit(s) since)" if n and n != "0" else
                     "  (nothing since)"))
        else:
            print("  latest tag      : none yet")
        return 0 if a.show or a.part else 2

    # A release has to describe a committed state. Tagging a dirty tree
    # produces a version that exists on one machine and nowhere else.
    dirty = git("status", "--porcelain")
    if dirty and not a.dry_run:
        raise SystemExit(
            "the working tree has uncommitted changes. Commit or stash them "
            "first - a release tag must point at something everyone can "
            "check out.\n" + dirty)

    new = bumped(cur, a.part)
    tag = f"v{label(*new)}"
    if git("tag", "--list", tag):
        raise SystemExit(f"{tag} already exists.")

    print(f"  {label(*cur)}  ->  {label(*new)}   (tag {tag})")
    if a.dry_run:
        print("  dry run - nothing written")
        return 0

    VERSION_FILE.write_text(f"{label(*new)}\n", encoding="utf-8")
    git("add", str(VERSION_FILE))
    git("commit", "-m", f"release: {tag}")
    git("tag", "-a", tag, "-m", f"Release {tag}")
    print(f"\n  committed and tagged {tag}. To publish it:\n")
    print("    git push && git push --tags\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
