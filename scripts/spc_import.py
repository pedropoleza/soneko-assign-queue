#!/usr/bin/env python3
"""
Importador de listas SPC para o GoHighLevel.

Para cada telefone único (deduplicado entre as N listas):
  1. faz upsert do contato (nome = telefone, source = "SPC Denúncias Orlando <primeiro grupo>",
     uma tag por grupo em que o telefone aparece);
  2. cria uma oportunidade (nome = telefone) na pipeline/stage configuradas.

É resumível: telefones já concluídos ficam registrados no state file e são pulados em reruns,
evitando oportunidades duplicadas.

Configuração via variáveis de ambiente:
  GHL_TOKEN        token (pit-...) da location
  GHL_LOCATION     locationId
  GHL_PIPELINE     id da pipeline
  GHL_STAGE        id do stage
  SPC_CSV_DIR      diretório onde estão os CSVs
  SPC_STATE        (opcional) arquivo de estado; default scripts/.spc_state
  SPC_RATE         (opcional) requisições/segundo; default 8
  SPC_WORKERS      (opcional) threads; default 8
"""
import csv
import json
import os
import re
import sys
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

BASE = "https://services.leadconnectorhq.com"
VERSION = "2021-07-28"

TOKEN = os.environ["GHL_TOKEN"]
LOCATION = os.environ["GHL_LOCATION"]
PIPELINE = os.environ["GHL_PIPELINE"]
STAGE = os.environ["GHL_STAGE"]
CSV_DIR = os.environ["SPC_CSV_DIR"]
STATE_FILE = os.environ.get("SPC_STATE", os.path.join(os.path.dirname(__file__), ".spc_state"))
FAIL_FILE = STATE_FILE + ".failed"
RATE = float(os.environ.get("SPC_RATE", "8"))
WORKERS = int(os.environ.get("SPC_WORKERS", "8"))

# filename -> group number. Cada arquivo é um grupo SPC.
FILES = {
    "a51ff469-grupo_spc_den_ncias_orlando_1_contatos.csv": "1",
    "1cdd5150-grupo_spc_den_ncias_orlando_2_contatos.csv": "2",
    "7a1fcdd0-grupo_spc_den_ncias_orlando_3_contatos.csv": "3",
    "ca7b893c-grupo_spc_den_ncias_orlando_4_contatos.csv": "4",
    "ca2bf481-grupo_spc_den_ncias_orlando_5_contatos.csv": "5",
}

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Version": VERSION,
    "Content-Type": "application/json",
    "Accept": "application/json",
}

PHONE_RE = re.compile(r"^\+\d{8,15}$")


def group_label(g):
    return f"SPC Denúncias Orlando {g}"


class RateLimiter:
    """Token bucket simples: no máximo RATE requisições por segundo."""

    def __init__(self, rate):
        self.interval = 1.0 / rate
        self.lock = threading.Lock()
        self.next_time = time.monotonic()

    def wait(self):
        with self.lock:
            now = time.monotonic()
            if now < self.next_time:
                sleep = self.next_time - now
            else:
                sleep = 0
                self.next_time = now
            self.next_time += self.interval
        if sleep > 0:
            time.sleep(sleep)


limiter = RateLimiter(RATE)
_state_lock = threading.Lock()
session = requests.Session()


def api(method, path, payload):
    """Chama a API com rate-limit e retry em 429/5xx/erros de rede."""
    url = BASE + path
    backoff = 2.0
    for attempt in range(6):
        limiter.wait()
        try:
            resp = session.request(method, url, headers=HEADERS, json=payload, timeout=30)
        except requests.RequestException as e:
            if attempt == 5:
                raise
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)
            continue
        if resp.status_code in (429, 500, 502, 503, 504):
            if attempt == 5:
                raise RuntimeError(f"{resp.status_code}: {resp.text[:300]}")
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)
            continue
        if not resp.ok:
            raise RuntimeError(f"{resp.status_code}: {resp.text[:300]}")
        return resp.json()
    raise RuntimeError("esgotou retries")


def load_lists():
    phone_groups = defaultdict(list)  # phone -> [groups em ordem de aparição]
    for fname, g in FILES.items():
        path = os.path.join(CSV_DIR, fname)
        with open(path, newline="") as fh:
            for row in csv.DictReader(fh):
                p = (row.get("Telefone") or "").strip()
                if not p or not PHONE_RE.match(p):
                    continue
                if g not in phone_groups[p]:
                    phone_groups[p].append(g)
    return phone_groups


def load_done():
    if not os.path.exists(STATE_FILE):
        return set()
    with open(STATE_FILE) as fh:
        return {line.strip() for line in fh if line.strip()}


def mark_done(phone):
    with _state_lock:
        with open(STATE_FILE, "a") as fh:
            fh.write(phone + "\n")


def mark_failed(phone, err):
    with _state_lock:
        with open(FAIL_FILE, "a") as fh:
            fh.write(f"{phone}\t{err}\n")


def process(phone, groups):
    source = group_label(groups[0])
    tags = [group_label(g) for g in groups]
    contact = api("POST", "/contacts/upsert", {
        "locationId": LOCATION,
        "name": phone,
        "phone": phone,
        "source": source,
        "tags": tags,
    })
    contact_id = contact["contact"]["id"]
    api("POST", "/opportunities/", {
        "pipelineId": PIPELINE,
        "locationId": LOCATION,
        "name": phone,
        "pipelineStageId": STAGE,
        "status": "open",
        "contactId": contact_id,
    })
    return phone


def main():
    phone_groups = load_lists()
    done = load_done()
    todo = [(p, g) for p, g in phone_groups.items() if p not in done]
    total = len(phone_groups)
    print(f"Telefones únicos: {total} | já feitos: {len(done)} | a processar: {len(todo)}", flush=True)

    ok = 0
    fail = 0
    start = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(process, p, g): p for p, g in todo}
        for i, fut in enumerate(as_completed(futures), 1):
            phone = futures[fut]
            try:
                fut.result()
                mark_done(phone)
                ok += 1
            except Exception as e:  # noqa: BLE001
                mark_failed(phone, str(e).replace("\n", " "))
                fail += 1
            if i % 100 == 0 or i == len(todo):
                elapsed = time.time() - start
                rate = i / elapsed if elapsed else 0
                print(f"  {i}/{len(todo)}  ok={ok} fail={fail}  {rate:.1f}/s", flush=True)

    print(f"FIM. ok={ok} fail={fail}. Concluídos totais={len(load_done())}/{total}", flush=True)
    if fail:
        print(f"Falhas registradas em {FAIL_FILE}", flush=True)


if __name__ == "__main__":
    main()
