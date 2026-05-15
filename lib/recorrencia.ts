export type Frequencia = "mensal" | "semanal" | "anual";

const LIMITE_OCORRENCIAS = 120; // teto de segurança

function adicionarMeses(data: string, n: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1 + n, d));
  if (dt.getUTCDate() !== d) dt.setUTCDate(0); // ajusta fim de mês
  return dt.toISOString().slice(0, 10);
}

function adicionarDias(data: string, n: number): string {
  const dt = new Date(data + "T12:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function adicionarAnos(data: string, n: number): string {
  const [a, m, d] = data.split("-");
  return `${Number(a) + n}-${m}-${d}`;
}

export function proxData(data: string, frequencia: Frequencia): string {
  switch (frequencia) {
    case "mensal":  return adicionarMeses(data, 1);
    case "semanal": return adicionarDias(data, 7);
    case "anual":   return adicionarAnos(data, 1);
  }
}

export function gerarDatasRecorrente(
  dataInicio: string,
  frequencia: Frequencia,
  dataFim: string | null | undefined
): string[] {
  const datas: string[] = [];
  // sem data fim: gera 36 meses a frente
  const fim = dataFim ?? adicionarMeses(dataInicio, 36);
  let cursor = dataInicio;

  while (cursor <= fim && datas.length < LIMITE_OCORRENCIAS) {
    datas.push(cursor);
    cursor = proxData(cursor, frequencia);
  }
  return datas;
}

export function gerarDatasParcelas(
  dataPrimeira: string,
  totalParcelas: number
): string[] {
  const datas: string[] = [];
  let cursor = dataPrimeira;
  for (let i = 0; i < totalParcelas; i++) {
    datas.push(cursor);
    cursor = adicionarMeses(cursor, 1);
  }
  return datas;
}

export const LABEL_FREQUENCIA: Record<Frequencia, string> = {
  mensal:  "Mensal",
  semanal: "Semanal",
  anual:   "Anual",
};
