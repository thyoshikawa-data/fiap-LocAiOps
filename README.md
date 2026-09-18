# LocAiOps

Challenge Locaweb · FIAP 2TSCOA · Sprint 4 (entrega final) · Tema: AIOps — Previsão de
Incidentes e Tendências Operacionais.

Equipe: Silvielen Couto (RM564378) e Thales Yoshikawa (RM562897).

Dashboard que prevê volume de incidentes (D+1/D+7), estima risco de violação de SLA por
ticket e aponta causas raiz operacionais, a partir do histórico real de incidentes ITSM da
Locaweb (122.543 registros, 2023–2025).

Deploy: https://fiap-loc-ai-ops.vercel.app/

## Estrutura

```
locaiops-mvp/
├── pipeline/                    # EDA + modelos (Python), gera os JSONs consumidos pelo dashboard
│   ├── requirements.txt
│   └── generate_dashboard_data.py
├── public/data/                 # Saída agregada do pipeline (overview, forecast, risk, rootcause)
├── app/                          # Next.js (App Router)
├── components/                   # Componentes do dashboard (KPIs, gráficos, alertas)
└── lib/                           # Tipos e leitura dos dados
```

O dataset bruto da Locaweb **não faz parte deste repositório** (fica em `../asset/Material
Locaweb/LW-DATASET.xlsx`, fora do controle de versão) — apenas agregados estatísticos e
saídas de modelo são versionados em `public/data/`.

## Pipeline (Python)

```bash
cd pipeline
pip install -r requirements.txt
python generate_dashboard_data.py
```

Gera/atualiza os arquivos em `public/data/*.json`:
- **Previsão de volume** (RandomForestRegressor): features de calendário + lags (1, 2, 7 dias) e
  médias móveis; backtest de 14 dias (MAE/MAPE) e previsão recursiva D+1..D+7.
- **Risco de violação de SLA** (RandomForestClassifier, `class_weight="balanced"` dado o
  desbalanceamento ~1%): treinado sobre tickets elegíveis a KPI; reporta AUC em holdout (0,804)
  e importância de features. Os "alertas simulados" só usam tickets do holdout (nunca vistos
  no treino do modelo que gerou aquela probabilidade), de prioridade 2/3 dentro do regime
  atual — mistura os de maior risco com casos que realmente violaram o SLA, pra dar pra
  conferir se a previsão bateu ou não. Não representam incidentes em aberto agora, o dataset
  é histórico.
- **Causa raiz**: top produtos, taxa de violação por origem de abertura (Manual vs.
  Monitoramento), top códigos de fechamento e clusterização operacional (KMeans) por duração/
  horário de abertura.

## Dashboard (Next.js)

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`. Lê os JSONs de `public/data/` em build/request time (Server
Component) e renderiza KPIs, gráfico de volume real vs. previsto, lista de alertas preditivos e
análise de causa raiz.

## Deploy

Publicado no Vercel direto a partir deste repositório (sem infraestrutura adicional):
https://fiap-loc-ai-ops.vercel.app/
