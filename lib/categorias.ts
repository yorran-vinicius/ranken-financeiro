export const CATEGORIAS_RECEITA = [
  "Mensalidades",
  "Patrocínios",
  "Loja",
  "Confraternização",
  "Outros",
] as const;

export const CATEGORIAS_DESPESA = [
  "Time",
  "Marketing",
  "Tecnologia",
  "Operacional",
  "Confraternização",
  "Outros",
] as const;

export type TipoLancamento = "receita" | "despesa";

export type CategoriaReceita = (typeof CATEGORIAS_RECEITA)[number];
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];
export type Categoria = CategoriaReceita | CategoriaDespesa;

export function categoriasPorTipo(tipo: TipoLancamento): readonly string[] {
  return tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
}

export function validarCategoria(tipo: TipoLancamento, categoria: string): boolean {
  return categoriasPorTipo(tipo).includes(categoria as never);
}
