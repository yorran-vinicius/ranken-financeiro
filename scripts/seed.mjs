// Popula a base com lançamentos de exemplo dos últimos 12 meses.
// Uso: node scripts/seed.mjs   (com o dev server rodando em :3000)

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const lancamentos = [
  // ---------- RECEITAS ----------
  // Mensalidades crescentes mês a mês
  { tipo: "receita", categoria: "Mensalidades", data: "2025-06-15", valor: 3000, descricao: "Mensalidades Jun/25" },
  { tipo: "receita", categoria: "Mensalidades", data: "2025-07-15", valor: 3200, descricao: "Mensalidades Jul/25" },
  { tipo: "receita", categoria: "Mensalidades", data: "2025-08-15", valor: 3500, descricao: "Mensalidades Ago/25" },
  { tipo: "receita", categoria: "Mensalidades", data: "2025-09-15", valor: 3500, descricao: "Mensalidades Set/25" },
  { tipo: "receita", categoria: "Mensalidades", data: "2025-10-15", valor: 4000, descricao: "Mensalidades Out/25" },
  { tipo: "receita", categoria: "Mensalidades", data: "2025-11-15", valor: 4200, descricao: "Mensalidades Nov/25" },
  { tipo: "receita", categoria: "Mensalidades", data: "2025-12-15", valor: 4500, descricao: "Mensalidades Dez/25" },
  { tipo: "receita", categoria: "Mensalidades", data: "2026-01-15", valor: 4800, descricao: "Mensalidades Jan/26" },
  { tipo: "receita", categoria: "Mensalidades", data: "2026-02-15", valor: 5000, descricao: "Mensalidades Fev/26" },
  { tipo: "receita", categoria: "Mensalidades", data: "2026-03-15", valor: 5200, descricao: "Mensalidades Mar/26" },
  { tipo: "receita", categoria: "Mensalidades", data: "2026-04-15", valor: 5300, descricao: "Mensalidades Abr/26" },

  // Patrocínios pontuais
  { tipo: "receita", categoria: "Patrocínios", data: "2025-09-05", valor: 8000, descricao: "Patrocínio Acme — semestral" },
  { tipo: "receita", categoria: "Patrocínios", data: "2026-01-10", valor: 10000, descricao: "Patrocínio anual Globex" },
  { tipo: "receita", categoria: "Patrocínios", data: "2026-04-20", valor: 5000, descricao: "Patrocínio Initech" },

  // Loja
  { tipo: "receita", categoria: "Loja", data: "2025-11-28", valor: 1200, descricao: "Loja — Black Friday" },
  { tipo: "receita", categoria: "Loja", data: "2026-03-12", valor: 850, descricao: "Loja — venda de camisas" },

  // Confraternização (receita: contribuição dos sócios)
  { tipo: "receita", categoria: "Confraternização", data: "2025-12-10", valor: 1500, descricao: "Contribuição confra de fim de ano" },

  // ---------- DESPESAS ----------
  // Marketing variando
  { tipo: "despesa", categoria: "Marketing", data: "2025-06-20", valor: 800, descricao: "Anúncios Instagram" },
  { tipo: "despesa", categoria: "Marketing", data: "2025-07-22", valor: 1200, descricao: "Anúncios Instagram" },
  { tipo: "despesa", categoria: "Marketing", data: "2025-08-18", valor: 900, descricao: "Anúncios Instagram" },
  { tipo: "despesa", categoria: "Marketing", data: "2025-09-10", valor: 2500, descricao: "Campanha lançamento novo time" },
  { tipo: "despesa", categoria: "Marketing", data: "2025-10-15", valor: 1100, descricao: "Anúncios + impressos" },
  { tipo: "despesa", categoria: "Marketing", data: "2025-11-15", valor: 1800, descricao: "Push pré Black Friday" },
  { tipo: "despesa", categoria: "Marketing", data: "2025-12-15", valor: 1400, descricao: "Anúncios Dezembro" },
  { tipo: "despesa", categoria: "Marketing", data: "2026-01-15", valor: 2000, descricao: "Campanha início do ano" },
  { tipo: "despesa", categoria: "Marketing", data: "2026-02-15", valor: 1500, descricao: "Anúncios Fevereiro" },
  { tipo: "despesa", categoria: "Marketing", data: "2026-03-15", valor: 1900, descricao: "Anúncios + assessoria" },
  { tipo: "despesa", categoria: "Marketing", data: "2026-04-15", valor: 2200, descricao: "Campanha temporada" },

  // Time (salário base mensal)
  ...[
    "2025-06", "2025-07", "2025-08", "2025-09", "2025-10",
    "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
  ].map((m) => ({
    tipo: "despesa",
    categoria: "Time",
    data: `${m}-05`,
    valor: 1500,
    descricao: `Pagamento técnicos ${m}`,
  })),

  // Tecnologia
  { tipo: "despesa", categoria: "Tecnologia", data: "2025-06-25", valor: 250, descricao: "Hospedagem + domínio" },
  { tipo: "despesa", categoria: "Tecnologia", data: "2025-09-08", valor: 350, descricao: "Plano CRM" },
  { tipo: "despesa", categoria: "Tecnologia", data: "2025-12-02", valor: 300, descricao: "Renovação SaaS" },
  { tipo: "despesa", categoria: "Tecnologia", data: "2026-02-04", valor: 400, descricao: "Plano CRM + storage" },
  { tipo: "despesa", categoria: "Tecnologia", data: "2026-05-02", valor: 280, descricao: "Hospedagem" },

  // Operacional
  { tipo: "despesa", categoria: "Operacional", data: "2025-08-12", valor: 600, descricao: "Aluguel quadra" },
  { tipo: "despesa", categoria: "Operacional", data: "2026-01-12", valor: 700, descricao: "Aluguel + arbitragem" },
  { tipo: "despesa", categoria: "Operacional", data: "2026-04-08", valor: 550, descricao: "Materiais" },

  // Confraternização (despesa)
  { tipo: "despesa", categoria: "Confraternização", data: "2025-12-20", valor: 1200, descricao: "Confraternização de fim de ano" },
];

let ok = 0;
let falha = 0;

for (const l of lancamentos) {
  const resp = await fetch(`${BASE}/api/lancamentos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(l),
  });
  if (resp.ok) ok++;
  else {
    falha++;
    const t = await resp.text().catch(() => "");
    console.error("Falhou:", l.descricao, resp.status, t);
  }
}

console.log(`✓ ${ok} lançamentos inseridos · ${falha} falhas`);
