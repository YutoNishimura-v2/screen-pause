#!/usr/bin/env python3
"""Build tmp/ci-shots/index.md and .txt log copies when the screenshots workflow fails."""

from __future__ import annotations

import argparse
import base64
import os
import re
import shutil
from pathlib import Path

TAIL_LINES = 150

ERROR_PATTERN = re.compile(
    r"(?i)\berror:"
    r"|\*\* BUILD FAILED \*\*"
    r"|\*\* TEST FAILED \*\*"
    r"|Testing failed"
    r"|The following build commands failed:"
    r"|Command .+ failed with a nonzero exit code"
    r"|❌"
    r"|Spec validation error"
    r"|No spec found"
    r"|xcodegen.*\b(?:error|fail)"
    r"|No available iPhone simulator"
    r"|Expected exactly one PNG"
    r"|Invalid PNG"
    r"|^fatal:"
)


def detect_failed_step(outcomes_raw: str) -> str:
    """Return the first step name whose outcome is 'failure'."""
    for raw_line in outcomes_raw.splitlines():
        name, sep, outcome = raw_line.partition("=")
        if sep and outcome.strip() == "failure":
            return name.strip() or "不明"
    return "不明"


def build_redactor(token: str) -> list[str]:
    """Return literal secrets derived from GH_TOKEN that must never appear in logs."""
    secrets: list[str] = []
    if token:
        secrets.append(token)
        encoded = base64.b64encode(f"x-access-token:{token}".encode("utf-8")).decode("ascii")
        secrets.append(encoded)
    return secrets


def redact_text(text: str, secrets: list[str]) -> str:
    """Strip any token material or GitHub mask/header directives from log text."""
    for secret in secrets:
        text = text.replace(secret, "***")
    text = re.sub(r"(?im)^.*::add-mask::.*$", "::add-mask::***", text)
    text = re.sub(r"(?i)(AUTHORIZATION:\s*basic\s+)\S+", r"\1***", text)
    return text


def fenced_block(lines: list[str], lang: str = "text") -> list[str]:
    """Wrap lines in a Markdown fenced code block safe against embedded backticks."""
    body = "\n".join(lines)
    longest_run = max((len(m.group(0)) for m in re.finditer(r"`+", body)), default=0)
    fence = "`" * max(3, longest_run + 1)
    return [f"{fence}{lang}", *lines, fence]


def build_failure_index(
    logs_dir: Path,
    shots_dir: Path,
    *,
    output_path: Path | None = None,
    sha: str,
    run_url: str,
    failed_step: str,
    secrets: list[str],
) -> Path:
    """Write tmp/ci-shots/index.md and copy each step log as a .txt file beside it."""
    if shots_dir.exists():
        shutil.rmtree(shots_dir)
    shots_dir.mkdir(parents=True, exist_ok=True)

    log_files = sorted(logs_dir.glob("*.log")) if logs_dir.is_dir() else []
    error_lines: list[str] = []
    step_sections: list[tuple[str, str, int, list[str]]] = []

    for log_path in log_files:
        raw = log_path.read_text(encoding="utf-8", errors="replace")
        sanitized = redact_text(raw, secrets)
        txt_name = f"{log_path.stem}.txt"
        (shots_dir / txt_name).write_text(sanitized, encoding="utf-8", newline="\n")

        lines = sanitized.splitlines()
        for line_no, line in enumerate(lines, start=1):
            if ERROR_PATTERN.search(line):
                error_lines.append(f"[{txt_name}:{line_no}] {line}")

        tail = lines[-TAIL_LINES:] if lines else []
        step_sections.append((log_path.stem, txt_name, len(lines), tail))

    out: list[str] = [
        f"失敗 {sha}",
        "",
        f"- 実行URL: {run_url}",
        f"- 失敗したステップ: {failed_step}",
        f"- コミット: {sha}",
        "",
        "## エラー行",
        "",
    ]
    if error_lines:
        out.extend(fenced_block(error_lines))
    else:
        out.append("(該当するエラー行なし)")

    out.extend(["", f"## ステップ別ログ（末尾{TAIL_LINES}行）", ""])
    if not step_sections:
        out.append("(ステップのログファイルはありません)")
    else:
        for stem, txt_name, total_lines, tail in step_sections:
            out.append(f"### {stem}（全{total_lines}行中 末尾{len(tail)}行）")
            out.append("")
            out.append(f"全文: [{txt_name}]({txt_name})")
            out.append("")
            if tail:
                out.extend(fenced_block(tail))
            else:
                out.append("(空のログ)")
            out.append("")

    index_path = output_path or (shots_dir / "index.md")
    index_path.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8", newline="\n")
    return index_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--logs-dir", default=os.environ.get("CI_LOGS_DIR", "tmp/ci-logs"))
    parser.add_argument(
        "--output",
        default=os.environ.get("CI_INDEX_PATH", str(Path(os.environ.get("CI_SHOTS_DIR", "tmp/ci-shots")) / "index.md")),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logs_dir = Path(args.logs_dir)
    output_path = Path(args.output)
    shots_dir = output_path.parent
    sha = os.environ.get("GITHUB_SHA", "unknown")
    server_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com").rstrip("/")
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    run_url = (
        f"{server_url}/{repository}/actions/runs/{run_id}"
        if repository and run_id
        else os.environ.get("CI_RUN_URL", "(unavailable)")
    )
    failed_step = detect_failed_step(os.environ.get("CI_STEP_OUTCOMES", ""))
    secrets = build_redactor(os.environ.get("GH_TOKEN", ""))

    build_failure_index(
        logs_dir,
        shots_dir,
        output_path=output_path,
        sha=sha,
        run_url=run_url,
        failed_step=failed_step,
        secrets=secrets,
    )


if __name__ == "__main__":
    main()
