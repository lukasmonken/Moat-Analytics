"""Cache local de originais CVM e escrita atômica dos snapshots."""

import csv
import hashlib
import io
import json
import os
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from zipfile import ZipFile

MAX_ARCHIVE_BYTES = 64 * 1024 * 1024


def archive_sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


@contextmanager
def read_archive(path: Path):
    with path.open("rb") as stream:
        metadata = os.fstat(stream.fileno())
        collected = datetime.fromtimestamp(metadata.st_mtime, UTC)
        checksum = hashlib.file_digest(stream, "sha256").hexdigest()
        stream.seek(0)
        with ZipFile(stream) as contents:
            yield contents, checksum, collected


def csv_rows(archive: ZipFile, member: str):
    with archive.open(member) as binary:
        with io.TextIOWrapper(binary, encoding="latin1", newline="") as text:
            yield from csv.DictReader(text, delimiter=";")


def acquire_archive(
    directory: Path,
    filename: str,
    url: str,
    *,
    offline: bool,
    refresh: bool,
) -> Path:
    archive = directory / filename
    if archive.is_file() and not refresh:
        return archive
    if offline:
        raise FileNotFoundError(f"ZIP necessário para a execução offline: {archive}.")

    directory.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(dir=directory, delete=False) as temporary:
            temporary_path = Path(temporary.name)

        try:
            subprocess.run(
                [
                    "curl", "--disable", "--fail", "--silent", "--show-error", "--location",
                    "--proto", "=https", "--proto-redir", "=https", "--retry", "2",
                    "--max-time", "45", "--max-filesize", str(MAX_ARCHIVE_BYTES),
                    "--output", str(temporary_path), "--", url,
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=150,
            )
        except FileNotFoundError as error:
            raise OSError("A coleta online requer curl no PATH.") from error
        except subprocess.CalledProcessError as error:
            raise OSError(f"Falha ao baixar {url}: {error.stderr.strip()}") from error
        except subprocess.TimeoutExpired as error:
            raise OSError(f"Tempo limite excedido ao baixar {url}.") from error

        if temporary_path.stat().st_size > MAX_ARCHIVE_BYTES:
            raise ValueError(f"ZIP excede o limite de {MAX_ARCHIVE_BYTES} bytes: {url}.")

        with ZipFile(temporary_path) as checked:
            if checked.testzip() is not None:
                raise ValueError(f"Falha de integridade no ZIP {url}.")

        if archive.is_file():
            previous_hash = archive_sha256(archive)
            if archive_sha256(temporary_path) == previous_hash:
                return archive
            history = directory / "historico" / previous_hash / filename
            if not history.is_file():
                history.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(archive, history)
        os.replace(temporary_path, archive)
        return archive
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def write_snapshot(path: Path, snapshot: dict, *, ignore_generated_at: bool = False) -> bool:
    """Retorna verdadeiro quando um novo snapshot foi gravado."""
    if path.is_file():
        try:
            previous = json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeError, ValueError):
            previous = None

        if ignore_generated_at and isinstance(previous, dict):
            manifest = previous.get("manifest")
            if isinstance(manifest, dict) and "generatedAt" in manifest:
                manifest["generatedAt"] = snapshot["manifest"]["generatedAt"]
        if snapshot == previous:
            return False

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=path.parent, mode="w", encoding="utf-8", delete=False
        ) as output:
            temporary_path = Path(output.name)
            json.dump(snapshot, output, indent=2, ensure_ascii=False, allow_nan=False)
            output.write("\n")
        os.replace(temporary_path, path)
        return True
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
