export interface Overview {
  periodo_dataset: {
    inicio: string;
    fim: string;
    total_registros: number;
  };
  kpis: {
    volume_mes_atual: number;
    previsao_d1: number;
    previsao_d7_total: number;
    taxa_violacao_sla_pct: number;
    pct_aberto_monitoramento: number;
    auc_modelo_risco: number | null;
    mape_previsao_pct: number;
  };
}

export interface ForecastPoint {
  data: string;
  real?: number;
  previsto?: number;
}

export interface Forecast {
  metricas: {
    mae_14d: number;
    mape_14d_pct: number;
    janela_backtest_dias: number;
    amostras_treino: number;
  };
  historico: { data: string; real: number }[];
  backtest: { data: string; real: number; previsto: number }[];
  previsao_7d: { data: string; previsto: number }[];
  d1: number;
  d7_total: number;
}

export interface AlertaSimulado {
  ticket: string;
  prioridade: string;
  produto: string;
  grupo: string;
  aberto_por: string;
  probabilidade: number;
  severidade: "ALTO" | "MÉDIO" | "BAIXO";
  recomendacao: string;
}

export interface Risk {
  metricas: {
    auc_holdout: number | null;
    taxa_violacao_base_pct: number;
    amostras_treino: number;
    amostras_teste: number;
  };
  importancia_features: { feature: string; importancia: number }[];
  alertas_simulados: AlertaSimulado[];
  aviso: string;
}

export interface RootCause {
  top_produtos: { produto: string; volume: number }[];
  violacao_por_origem: { "Aberto por": string; taxa_violacao: number; amostras: number }[];
  top_codigos_fechamento: { codigo: string; volume: number }[];
  clusters_operacionais: {
    cluster: number;
    tamanho: number;
    duracao_media_min: number;
    hora_media_abertura: number;
    pct_manual: number;
  }[];
}

export interface DashboardData {
  overview: Overview;
  forecast: Forecast;
  risk: Risk;
  rootcause: RootCause;
}
