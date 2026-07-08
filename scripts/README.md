# scripts/spc_import.py

Importador das listas de contatos SPC para o GoHighLevel.

Para cada telefone único (deduplicado entre as listas):
1. faz **upsert do contato** — nome = telefone, `source = "SPC Denúncias Orlando <primeiro grupo>"`,
   e uma **tag por grupo** em que o telefone aparece (`SPC Denúncias Orlando 1`, `... 3`, etc.);
2. cria uma **oportunidade** (nome = telefone) na pipeline **Contatos SPC**, stage **Importado - Grupo SPC**.

Deduplica por telefone (1 contato + 1 oportunidade por pessoa). É resumível: telefones concluídos
ficam no state file e são pulados em reruns, evitando oportunidades duplicadas. Faz rate-limit
(default 8 req/s) e retry com backoff em 429/5xx.

## Uso

```bash
export GHL_TOKEN="pit-..."          # token da location
export GHL_LOCATION="..."           # locationId
export GHL_PIPELINE="..."           # id da pipeline
export GHL_STAGE="..."              # id do stage
export SPC_CSV_DIR="/caminho/dos/csvs"
# opcionais: SPC_STATE, SPC_RATE, SPC_WORKERS
python3 scripts/spc_import.py
```

Os CSVs esperados têm cabeçalho `Telefone,Papel,Tipo`. O mapeamento arquivo→grupo fica em
`FILES` dentro do script.
