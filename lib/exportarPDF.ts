import type { Lancamento } from "@/lib/db";
import { rotuloMesAno } from "@/lib/format";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function exportarPDF(
  lancamentos: Lancamento[],
  mes: string,
  nomeApp = "RANKEN Financeiro",
) {
  const receitas = lancamentos.filter((l) => l.tipo === "receita");
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");
  const totalReceitas = receitas.reduce((s, l) => s + l.valor, 0);
  const totalDespesas = despesas.reduce((s, l) => s + l.valor, 0);
  const saldo = totalReceitas - totalDespesas;

  // Agrupa por categoria
  const porCat: Record<string, { r: number; d: number }> = {};
  for (const l of lancamentos) {
    if (!porCat[l.categoria]) porCat[l.categoria] = { r: 0, d: 0 };
    if (l.tipo === "receita") porCat[l.categoria].r += l.valor;
    else porCat[l.categoria].d += l.valor;
  }

  const rowsCat = Object.entries(porCat)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([cat, v]) => `
      <tr>
        <td>${cat}</td>
        <td class="num receita">${v.r > 0 ? brl(v.r) : "—"}</td>
        <td class="num despesa">${v.d > 0 ? brl(v.d) : "—"}</td>
        <td class="num ${v.r - v.d >= 0 ? "receita" : "despesa"}">${brl(v.r - v.d)}</td>
      </tr>`,
    )
    .join("");

  const rowsLanc = [...lancamentos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(
      (l) => `
      <tr>
        <td>${new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
        <td>${l.descricao.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>
        <td>${l.categoria}</td>
        <td class="num ${l.tipo}">${brl(l.valor)}</td>
      </tr>`,
    )
    .join("");

  const dataGeracao = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório ${rotuloMesAno(mes)} — ${nomeApp}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;padding:44px 48px;font-size:13px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2.5px solid #1a1a1a;margin-bottom:28px}
  .logo{font-size:20px;font-weight:900;letter-spacing:-0.5px}
  .logo span{color:#888;font-weight:400}
  .header-meta{text-align:right}
  .header-meta .periodo{font-size:15px;font-weight:700}
  .header-meta .gerado{font-size:11px;color:#777;margin-top:3px}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px}
  .card{border:1px solid #e5e5e5;border-radius:10px;padding:16px 18px}
  .card-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#888;font-weight:600}
  .card-valor{font-size:24px;font-weight:800;margin-top:5px;line-height:1}
  .receita{color:#16a34a}
  .despesa{color:#dc2626}
  .neutro{color:#1a1a1a}
  .section{margin-top:24px;margin-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#777;font-weight:700}
  table{width:100%;border-collapse:collapse}
  thead th{background:#1a1a1a;color:#fff;padding:9px 13px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  thead th.num{text-align:right}
  tbody tr:nth-child(even){background:#fafafa}
  tbody td{padding:8px 13px;border-bottom:1px solid #efefef;font-size:12.5px;vertical-align:middle}
  td.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
  .saldo-row{background:#f0f9f4!important;font-weight:700}
  .saldo-row td{border-top:2px solid #d1fae5;font-size:13px}
  .footer{margin-top:36px;padding-top:14px;border-top:1px solid #e5e5e5;display:flex;justify-content:space-between;font-size:10.5px;color:#aaa}
  @media print{body{padding:0}@page{size:A4 portrait;margin:14mm 18mm}}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="logo">RANKEN <span>Financeiro</span></div>
    <div style="font-size:12px;color:#666;margin-top:5px">Relatório Financeiro Mensal</div>
  </div>
  <div class="header-meta">
    <div class="periodo">${rotuloMesAno(mes)}</div>
    <div class="gerado">Gerado em ${dataGeracao}</div>
  </div>
</div>

<div class="cards">
  <div class="card">
    <div class="card-label">Receitas</div>
    <div class="card-valor receita">${brl(totalReceitas)}</div>
  </div>
  <div class="card">
    <div class="card-label">Despesas</div>
    <div class="card-valor despesa">${brl(totalDespesas)}</div>
  </div>
  <div class="card">
    <div class="card-label">Saldo</div>
    <div class="card-valor ${saldo >= 0 ? "receita" : "despesa"}">${brl(saldo)}</div>
  </div>
</div>

<div class="section">Por Categoria</div>
<table>
  <thead>
    <tr>
      <th>Categoria</th>
      <th class="num">Receitas</th>
      <th class="num">Despesas</th>
      <th class="num">Saldo</th>
    </tr>
  </thead>
  <tbody>
    ${rowsCat}
    <tr class="saldo-row">
      <td>TOTAL</td>
      <td class="num receita">${brl(totalReceitas)}</td>
      <td class="num despesa">${brl(totalDespesas)}</td>
      <td class="num ${saldo >= 0 ? "receita" : "despesa"}">${brl(saldo)}</td>
    </tr>
  </tbody>
</table>

<div class="section">Lançamentos do Mês (${lancamentos.length})</div>
<table>
  <thead>
    <tr>
      <th>Data</th>
      <th>Descrição</th>
      <th>Categoria</th>
      <th class="num">Valor</th>
    </tr>
  </thead>
  <tbody>
    ${rowsLanc}
  </tbody>
</table>

<div class="footer">
  <span>${nomeApp} — Documento confidencial</span>
  <span>${rotuloMesAno(mes)}</span>
</div>

</body>
</html>`;

  const janela = window.open("", "_blank", "width=960,height=720");
  if (!janela) {
    alert("Permita pop-ups para exportar o PDF.");
    return;
  }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 600);
}
