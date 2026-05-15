export function formatarBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function mesAtualISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mes}`;
}

export function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function nomeMes(numeroMes: number): string {
  return MESES_PT[numeroMes - 1] ?? "";
}

export function rotuloMesAno(mesAno: string): string {
  const [ano, mes] = mesAno.split("-");
  const nm = nomeMes(Number(mes));
  return `${nm} / ${ano}`;
}
