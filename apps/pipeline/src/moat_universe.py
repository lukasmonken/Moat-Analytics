"""Importa composições locais e cruza os códigos com evidência cadastral da CVM."""

import csv
import hashlib
import io
import json
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from urllib.parse import urlsplit

from .moat_cvm.archives import csv_rows, read_archive, write_snapshot
from .moat_cvm.fca import (
    ORIGIN,
    TRADING_CODE,
    declaration_order,
    declarations,
    eligible_trading_codes,
    filing_key,
    section_key,
)

INDEX_CODES = ("IBOV", "SMLL", "IDIV")
NATIVE_TITLE = re.compile(
    r"(IBOV|SMLL|IDIV)\s*-\s*Carteira do Dia\s+(\d{2}/\d{2}/\d{2}(?:\d{2})?)",
    re.IGNORECASE,
)
FCA_FILENAME = re.compile(r"fca_cia_aberta_(\d{4})\.zip")


@dataclass(frozen=True)
class ListedSecurity:
    cvm_code: int
    cnpj: str
    name: str
    kind: str


@dataclass(frozen=True)
class Membership:
    index: str
    ticker: str
    cvm_code: int | None
    cnpj: str | None
    kind: str | None


@dataclass(frozen=True)
class IdentityOverride:
    identity: ListedSecurity
    source_url: str
    reason: str


def normalized_header(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", ascii_value.strip().lower()).strip("_")


def symbol_class(value: str) -> str | None:
    if not value:
        return None
    token = value.upper().split()[0]
    if token in {"UNT", "UNIT", "UNITS"}:
        return "UNIT"
    if token == "ON":
        return "ON"
    if re.fullmatch(r"PN[A-Z]?", token):
        return "PN"
    raise ValueError(f"tipo de valor mobiliário incompatível: {value}.")


def parse_cvm_code(value: str) -> int | None:
    if not value:
        return None
    if not re.fullmatch(r"\d{1,6}", value, re.ASCII) or int(value) == 0:
        raise ValueError(f"código CVM inválido: {value}.")
    return int(value)


def parse_cnpj(value: str) -> str | None:
    if not value:
        return None
    digits = re.sub(r"[./\- ]", "", value)
    if not re.fullmatch(r"\d{14}", digits, re.ASCII):
        raise ValueError(f"CNPJ inválido: {value}.")
    return digits


def find_column(headers: list[str], names: set[str]) -> int | None:
    found = [index for index, header in enumerate(headers) if header in names]
    if len(found) > 1:
        raise ValueError(f"cabeçalhos duplicados: {', '.join(headers[i] for i in found)}.")
    return found[0] if found else None


def theoretical_quantity(value: str) -> int:
    if not re.fullmatch(r"(?:\d+|\d{1,3}(?:\.\d{3})+)", value.strip(), re.ASCII):
        raise ValueError("quantidade teórica inválida no CSV da B3.")
    return int(value.replace(".", ""))


def read_composition(
    path: Path, index_hint: str | None, as_of: date
) -> tuple[list[Membership], dict]:
    raw = path.read_bytes()
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw.decode("latin1")
    if "\0" in content:
        raise ValueError(f"{path.name}: arquivo não é CSV de texto.")

    lines = content.splitlines()
    while lines and not lines[0].strip():
        lines.pop(0)
    if not lines:
        raise ValueError(f"{path.name}: CSV vazio.")

    title = NATIVE_TITLE.fullmatch(lines[0].strip())
    if title:
        file_index, day = title.groups()
        file_index = file_index.upper()
        day_format = "%d/%m/%Y" if len(day) == 10 else "%d/%m/%y"
        if index_hint != file_index or datetime.strptime(day, day_format).date() != as_of:
            raise ValueError(f"{path.name}: índice ou data-base divergente no título B3.")
        lines = lines[1:]
    if not lines:
        raise ValueError(f"{path.name}: cabeçalho de composição ausente.")
    separator = max((";", ",", "\t"), key=lines[0].count)
    reader = csv.reader(io.StringIO("\n".join(lines)), delimiter=separator, strict=True)
    headers = [normalized_header(cell) for cell in next(reader)]
    ticker_column = find_column(headers, {"ticker", "codigo", "codigo_negociacao"})
    index_column = find_column(headers, {"indice", "index"})
    cvm_column = find_column(headers, {"codigo_cvm", "cd_cvm", "cvm", "cvm_code"})
    cnpj_column = find_column(headers, {"cnpj", "cnpj_cia", "cnpj_companhia"})
    class_column = find_column(headers, {"tipo", "classe", "kind"})
    if ticker_column is None or (index_hint is None and index_column is None):
        raise ValueError(f"{path.name}: informe as colunas ticker e índice, ou um arquivo por índice.")

    quantity_column = find_column(headers, {"qtde_teorica", "quantidade_teorica"}) if title else None
    if title and quantity_column is None:
        raise ValueError(f"{path.name}: quantidade teórica ausente no cabeçalho da B3.")
    members = []
    footer = False
    recorded_total = None
    quantity_sum = 0
    for cells in reader:
        if not any(cell.strip() for cell in cells):
            continue
        summary = normalized_header(cells[0]) if title else ""
        if summary in {"quantidade_teorica_total", "redutor"}:
            footer = True
            if summary == "quantidade_teorica_total" and quantity_column is not None:
                if recorded_total is not None or len(cells) <= quantity_column:
                    raise ValueError(f"{path.name}: total da quantidade teórica inválido.")
                recorded_total = theoretical_quantity(cells[quantity_column])
            continue
        number = reader.line_num + bool(title)
        if footer or len(cells) < len(headers) or any(cell.strip() for cell in cells[len(headers) :]):
            raise ValueError(f"{path.name}, linha {number}: estrutura de linha inválida.")

        def field(column: int | None) -> str:
            return cells[column].strip() if column is not None else ""

        ticker = field(ticker_column).upper()
        index = field(index_column).upper() or index_hint
        try:
            if index not in INDEX_CODES or (index_hint and index != index_hint):
                raise ValueError(f"índice inválido ou divergente: {index or 'vazio'}.")
            if not TRADING_CODE.fullmatch(ticker):
                raise ValueError(f"ticker inválido: {ticker or 'vazio'}.")
            if quantity_column is not None:
                quantity_sum += theoretical_quantity(field(quantity_column))
            members.append(
                Membership(
                    index, ticker, parse_cvm_code(field(cvm_column)),
                    parse_cnpj(field(cnpj_column)), symbol_class(field(class_column)),
                )
            )
        except ValueError as error:
            raise ValueError(f"{path.name}, linha {number}: {error}") from error
    if not members:
        raise ValueError(f"{path.name}: nenhuma composição encontrada.")
    if title and recorded_total != quantity_sum:
        raise ValueError(f"{path.name}: quantidade teórica das linhas diverge do rodapé B3.")
    return members, {
        "indices": [code for code in INDEX_CODES if any(row.index == code for row in members)],
        "sha256": hashlib.sha256(raw).hexdigest(),
    }


def domestic_filings(archive, year: int, filings: dict) -> dict:
    eligible = {}
    codes_by_key = {filing_key(filing): code for code, filing in filings.items()}
    for row in csv_rows(archive, f"fca_cia_aberta_geral_{year}.csv"):
        code = codes_by_key.get(section_key(row))
        if code is None:
            continue
        if parse_cvm_code(row["Codigo_CVM"]) != parse_cvm_code(code):
            raise ValueError(f"CVM {code}: código divergente no formulário geral.")
        if (
            row["Pais_Origem"] == "Brasil"
            and row["Categoria_Registro_CVM"] == "Categoria A"
            and row["Situacao_Registro_CVM"] == "Ativo"
        ):
            eligible[code] = filings[code]
    return eligible


def read_security_catalogue(paths: list[Path], as_of: date) -> tuple[dict, dict, list[dict]]:
    catalogue = {}
    evidence = []

    for path in paths:
        match = FCA_FILENAME.fullmatch(path.name)
        if not match:
            raise ValueError(f"Nome de arquivo FCA inválido: {path.name}. Use fca_cia_aberta_AAAA.zip.")
        year = int(match.group(1))
        with read_archive(path) as (archive, checksum, _collected):
            filings = declarations(archive, year, as_of, company_codes=None)
            eligible = domestic_filings(archive, year, filings)
            securities = defaultdict(set)
            for code, ticker, kind in eligible_trading_codes(archive, year, eligible, as_of):
                securities[code].add((ticker, kind))

            for code, filing in filings.items():
                order = declaration_order(filing)
                cvm_code = int(code)
                current = catalogue.get(cvm_code)
                issuer = (
                    (parse_cnpj(filing["CNPJ_CIA"]), filing["DENOM_CIA"])
                    if code in eligible else None
                )
                entries = {
                    (
                        ticker,
                        ListedSecurity(
                            cvm_code, parse_cnpj(filing["CNPJ_CIA"]), filing["DENOM_CIA"], kind
                        ),
                    )
                    for ticker, kind in securities[code]
                }
                if current is None or order > current[0]:
                    catalogue[cvm_code] = (order, entries, issuer)
                elif order == current[0]:
                    current[1].update(entries)
                    catalogue[cvm_code] = (order, current[1], issuer or current[2])
        evidence.append({"year": year, "url": ORIGIN + path.name, "sha256": checksum})

    by_ticker = defaultdict(set)
    issuers = {}
    for code, (_, entries, issuer) in catalogue.items():
        if issuer:
            issuers[code] = issuer
        for ticker, identity in entries:
            by_ticker[ticker].add(identity)
    return by_ticker, issuers, sorted(evidence, key=lambda entry: (entry["year"], entry["sha256"]))


def read_overrides(
    path: Path, as_of: date, issuers: dict
) -> tuple[dict[str, IdentityOverride], str]:
    raw = path.read_bytes()
    rows = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")), strict=True)
    required = {"data_base", "ticker", "codigo_cvm", "cnpj", "companhia", "tipo", "fonte_url", "justificativa"}
    if not rows.fieldnames or len(rows.fieldnames) != len(required) or set(rows.fieldnames) != required:
        raise ValueError(f"{path.name}: cabeçalho inválido para as exceções cadastrais.")
    overrides = {}
    for row in rows:
        line = rows.line_num
        if None in row or any(not value or not value.strip() for value in row.values()):
            raise ValueError(f"{path.name}, linha {line}: exceção incompleta.")
        ticker = row["ticker"].strip().upper()
        code = parse_cvm_code(row["codigo_cvm"].strip())
        cnpj = parse_cnpj(row["cnpj"].strip())
        source_url = row["fonte_url"].strip()
        url = urlsplit(source_url)
        kind = symbol_class(row["tipo"].strip())
        issuer = issuers.get(code)
        if (
            row["data_base"].strip() != as_of.isoformat()
            or not TRADING_CODE.fullmatch(ticker)
            or ticker in overrides
            or not issuer
            or issuer[0] != cnpj
            or url.scheme != "https"
            or not url.hostname
            or url.username is not None
        ):
            raise ValueError(f"{path.name}, linha {line}: exceção cadastral inválida para {ticker}.")
        overrides[ticker] = IdentityOverride(
            ListedSecurity(code, cnpj, issuer[1], kind), source_url, row["justificativa"].strip()
        )
    if not overrides:
        raise ValueError(f"{path.name}: ainda não há exceções cadastradas.")
    return overrides, hashlib.sha256(raw).hexdigest()


def map_universe(
    members: list[Membership], catalogue: dict, overrides: dict[str, IdentityOverride]
) -> list[dict]:
    memberships = defaultdict(lambda: defaultdict(set))
    identities = {}
    identities_by_ticker = {}
    errors = set()
    for member in members:
        override = overrides.get(member.ticker)
        candidates = {override.identity} if override else catalogue.get(member.ticker, set())
        if not candidates:
            errors.add(f"{member.ticker}: sem correspondência cadastral elegível")
            continue
        matching = [
            identity
            for identity in candidates
            if (not member.cvm_code or member.cvm_code == identity.cvm_code)
            and (not member.cnpj or member.cnpj == identity.cnpj)
            and (not member.kind or member.kind == identity.kind)
        ]
        if not matching:
            errors.add(f"{member.ticker}: composição diverge do cadastro CVM")
            continue
        if len(matching) != 1:
            errors.add(f"{member.ticker}: identidade ambígua")
            continue
        identity = matching[0]
        previous = identities_by_ticker.setdefault(member.ticker, identity)
        if previous != identity:
            errors.add(f"{member.ticker}: identidades conflitantes entre os índices")
            continue
        code = identity.cvm_code
        identities[code] = identity
        memberships[code][(member.ticker, identity.kind)].add(member.index)

    if errors:
        raise ValueError("Confira a composição e os arquivos FCA de referência:\n" + "\n".join(sorted(errors)))
    companies = []
    for code, securities in sorted(memberships.items()):
        company_indices = set().union(*securities.values())
        companies.append(
            {
                "companyId": f"cvm:{code}",
                "cvmCode": code,
                "name": identities[code].name,
                "indexMemberships": [index for index in INDEX_CODES if index in company_indices],
                "securities": [
                    {
                        "ticker": ticker,
                        "kind": kind,
                        "indexMemberships": [index for index in INDEX_CODES if index in indices],
                    }
                    for (ticker, kind), indices in sorted(securities.items())
                ],
                "representativeTicker": None,
            }
        )
    return companies


def create_universe(
    inputs: dict[str | None, Path],
    archives: list[Path],
    as_of: date,
    source: dict,
    identity_overrides: Path | None = None,
) -> dict:
    members = []
    source_files = []
    for index, path in inputs.items():
        compositions, evidence = read_composition(path, index, as_of)
        members.extend(compositions)
        source_files.append(evidence)
    missing = set(INDEX_CODES) - {row.index for row in members}
    if missing:
        raise ValueError(f"Sem composição para os índices: {', '.join(sorted(missing))}.")
    catalogue, issuers, identity_archives = read_security_catalogue(archives, as_of)
    overrides, override_sha = (
        read_overrides(identity_overrides, as_of, issuers) if identity_overrides else ({}, None)
    )
    unused_overrides = overrides.keys() - {row.ticker for row in members}
    if unused_overrides:
        raise ValueError(f"Exceções fora das carteiras: {', '.join(sorted(unused_overrides))}.")
    companies = map_universe(members, catalogue, overrides)
    return {
        "schemaVersion": "1.0.0",
        "asOf": as_of.isoformat(),
        "importedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        "source": source,
        "sourceFiles": source_files,
        "identityArchives": identity_archives,
        "identityOverridesSha256": override_sha,
        "identityOverrides": [
            {
                "ticker": ticker,
                "companyId": f"cvm:{override.identity.cvm_code}",
                "kind": override.identity.kind,
                "sourceUrl": override.source_url,
                "reason": override.reason,
            }
            for ticker, override in sorted(overrides.items())
        ],
        "coverage": {
            "includedCompanies": len(companies),
            "byIndex": {
                index: sum(index in company["indexMemberships"] for company in companies)
                for index in INDEX_CODES
            },
        },
        "companies": companies,
    }


def versioned_import(payload: dict, output: Path, history_dir: Path) -> tuple[Path, bool]:
    stable_content = {key: value for key, value in payload.items() if key != "importedAt"}
    fingerprint = json.dumps(
        stable_content, ensure_ascii=False, sort_keys=True, allow_nan=False,
    ).encode()
    version = history_dir / f"{payload['asOf']}-{hashlib.sha256(fingerprint).hexdigest()}.json"
    if version.is_file():
        previous = json.loads(version.read_text(encoding="utf-8"))
        if (
            not isinstance(previous, dict)
            or not isinstance(previous.get("importedAt"), str)
            or {k: v for k, v in previous.items() if k != "importedAt"} != stable_content
        ):
            raise ValueError(f"Arquivo histórico inconsistente: {version}.")
        payload = previous

    if output.is_file():
        latest = json.loads(output.read_text(encoding="utf-8"))
        if not isinstance(latest, dict) or latest.get("schemaVersion") != "1.0.0":
            raise ValueError(f"Snapshot atual inválido: {output}.")
        has_newer_snapshot = date.fromisoformat(latest["asOf"]) > date.fromisoformat(payload["asOf"])
    else:
        has_newer_snapshot = False
    write_snapshot(version, payload)
    return version, False if has_newer_snapshot else write_snapshot(output, payload)
