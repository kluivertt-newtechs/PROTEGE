import { Injectable } from '@angular/core';

export type CatalogComponentType = 'number' | 'text' | 'select' | 'boolean' | 'rate';
export type ProductComponentType = CatalogComponentType;
export type ProductNodeType = 'group' | 'product' | 'service';
export type CatalogStatus = 'Ativo' | 'Inativo';
export type ComponentKind = 'product' | 'price';

export interface ProductComponentOption {
  sequence: number;
  code: string;
  description: string;
  calculatedValue: number;
  costValue: number;
  default: boolean;
  selected: boolean;
  label?: string;
  value?: string;
  numericValue?: number;
}

export interface ProductComponent {
  id: string;
  code: string;
  description: string;
  type: CatalogComponentType;
  unit: string;
  group: string;
  status: CatalogStatus;
  active: boolean;
  multiple: boolean;
  options: Array<ProductComponentOption>;
  varAPV: string;
  formula: string;
}

export interface PriceComponent extends ProductComponent {}

export interface ProductNode {
  id: string;
  code: string;
  name: string;
  icon: string;
  type: ProductNodeType;
  children?: Array<ProductNode>;
}

export interface ProductComposition {
  productId: string;
  productComponentIds: Array<string>;
  priceComponentIds: Array<string>;
}

export interface ProductCatalogState {
  version: number;
  productComponents: Array<ProductComponent>;
  priceComponents: Array<PriceComponent>;
  tree: Array<ProductNode>;
  compositions: Array<ProductComposition>;
  selectedProductId: string;
}

const STATE_KEY = 'protege.productCatalog.v5';
const VERSION = 5;
const LEGACY_KEYS = [
  'protege.productCatalog.v4',
  'protege.productCatalog.v3',
  'protege.productCatalog.components',
  'protege.productCatalog.tree',
  'protege.productCatalog.compositions',
  'protege.productCatalog.selectedProduct',
];

const rt = (
  id: string,
  code: string,
  description: string,
  varAPV: string,
  formula: string,
  group: string,
  opts: Array<[number, string, string, number, boolean]>,
): ProductComponent => ({
  id,
  code,
  description,
  varAPV,
  formula,
  group,
  type: opts.length ? 'select' : 'number',
  unit: '',
  status: 'Ativo',
  active: true,
  multiple: false,
  options: opts.map(([sequence, optionCode, optionDescription, value, isDefault]) =>
    opt(sequence, optionCode, optionDescription, value, isDefault),
  ),
});

const pt = (
  id: string,
  code: string,
  description: string,
  varAPV: string,
  formula: string,
  opts: Array<[number, string, string, number, boolean]>,
): PriceComponent => ({
  ...rt(id, code, description, varAPV, formula, 'Precificacao', opts),
  type: 'rate',
});

const lib = (
  id: string,
  code: string,
  description: string,
  type: CatalogComponentType,
  unit: string,
  group: string,
  varAPV = code,
  formula = '',
): ProductComponent => ({
  id,
  code,
  description,
  type,
  unit,
  group,
  varAPV,
  formula,
  status: 'Ativo',
  active: true,
  multiple: false,
  options: [],
});

function opt(
  sequence: number,
  code: string,
  description: string,
  value: number,
  selected = false,
): ProductComponentOption {
  return {
    sequence,
    code,
    description,
    calculatedValue: value,
    costValue: value,
    default: selected,
    selected,
    label: description,
    value: code,
    numericValue: value,
  };
}

const SEED_PRODUCT_COMPONENTS: Array<ProductComponent> = [
  rt('rt01', 'TR001', 'Condicao Operacional CPE/SOP', 'CPE_SOP', 'CUSTO_EMBARQUE * QTD_ATEND', 'Tabelas de Resultado', [
    [10, 'CPE', 'CPE - Cofre Particular no Estabelecimento', 1, true],
    [20, 'SOP', 'SOP - Sem Cofre Particular', 2, false],
  ]),
  rt('rt02', 'TR002', 'Modelo de Cofre Inteligente', 'COFRE_AT', 'CUSTO_COFRE + SEGURO_COFRE', 'Tabelas de Resultado', [
    [10, 'PROTEGE1', 'Protege One - Cofre compacto', 1, true],
    [20, 'PROTEGE2', 'Protege Two - Cofre duplo', 2, false],
    [30, 'COFRE_STD', 'Cofre padrão - Sem inteligência embarcada', 3, false],
  ]),
  rt('rt03', 'TR003', 'Frequencia de Coleta', 'FREQ', 'EMBARQUES_MES * CUSTO_EMBARQUE', 'Tabelas de Resultado', [
    [10, 'DIARIA', 'Diaria - coleta todo dia util', 22, false],
    [20, 'SEMANAL', 'Semanal - 1x por semana', 4, false],
    [30, 'QUINZENAL', 'Quinzenal - 2x por mes', 2, false],
    [40, 'MENSAL', 'Mensal - 1x por mes', 1, false],
    [50, 'INTELIGENTE', 'Inteligente - sob demanda', 0, true],
  ]),
  rt('rt04', 'TR004', 'Base Operacional / Regiao', 'BASE_OP', 'HR_NORMAL * CUSTO_HR', 'Tabelas de Resultado', [
    [10, 'BASE_SP_O', 'Base Oeste - Sao Paulo/SP', 1, true],
    [20, 'BASE_SP_L', 'Base Leste - Sao Paulo/SP', 2, false],
    [30, 'BASE_RJ', 'Base Rio de Janeiro/RJ', 3, false],
    [40, 'BASE_MG', 'Base Belo Horizonte/MG', 4, false],
    [50, 'BASE_RS', 'Base Porto Alegre/RS', 5, false],
  ]),
  rt('rt05', 'TR005', 'Taxa de Antecipação D0 Bancarização', 'MARGEM_D0', 'PRECO_ROL * MARGEM_D0', 'Tabelas de Resultado', [
    [10, 'D0_015', '0,15% a.m. - Taxa Selic', 0.0015, true],
    [20, 'D0_010', '0,10% a.m. - Taxa negociada', 0.001, false],
    [30, 'D0_ZERO', 'Sem antecipacao', 0, false],
  ]),
  rt('rt06', 'TR006', 'Nivel de Servico (SLA Coleta)', 'SLA', 'SLA_HORAS * CUSTO_HR', 'Tabelas de Resultado', [
    [10, 'SLA_2H', 'SLA 2h - Coleta em ate 2 horas', 2, false],
    [20, 'SLA_4H', 'SLA 4h - Coleta em ate 4 horas', 4, false],
    [30, 'SLA_D1', 'SLA D+1 - Coleta no proximo dia util', 24, true],
    [40, 'SLA_D2', 'SLA D+2 - Coleta em ate 2 dias uteis', 48, false],
  ]),
  rt('rt07', 'TR007', 'Tipo de Custo de Processamento (NUM)', 'PROC_TP', 'QTD_MALOTES * CUSTO_PROC', 'Tabelas de Resultado', [
    [10, 'NUM_FIXO', 'Fixo por numerario (por malote)', 6.059, false],
    [20, 'NUM_PERC', 'Percentual sobre valor processado', 0.0015, true],
    [30, 'NUM_COMBO', 'Combinado - fixo + percentual', 0, false],
  ]),
  rt('rt08', 'TR008', 'Prazo de Floating (Dias)', 'FLOAT', 'MONTANTE * SELIC * FLOAT', 'Tabelas de Resultado', [
    [10, 'D0', 'D+0 - Credito no mesmo dia', 0, false],
    [20, 'D1', 'D+1 - Credito em 1 dia util', 1, false],
    [30, 'D2', 'D+2 - Credito em 2 dias uteis', 2, false],
    [40, 'D3', 'D+3 - Credito em 3 dias uteis', 3, true],
  ]),
  rt('rt09', 'TR009', 'Seguro Cofre - Modalidade', 'SEG', 'LIMITE_SEG * TAXA_SEG', 'Tabelas de Resultado', [
    [10, 'SEG_COL', 'Seguro por coleta negociada', 200000, false],
    [20, 'SEG_PAD', 'Seguro padrão', 300000, true],
    [30, 'SEG_AMP', 'Seguro ampliado', 500000, false],
  ]),
  rt('rt10', 'TR010', 'Modelo Cofre Projetado PayCash', 'COFRE_PR', 'CUSTO_COFRE + SEGURO_COFRE', 'PayCash', [
    [10, 'PROTEGE_ONE', 'Protege One (R$ 447,42/mes)', 447.42, true],
    [20, 'GRAND_GLORY', 'Grand Glory (R$ 380,00/mes)', 380, false],
    [30, 'GRAND_DIEBOLD', 'Grand Diebold / Tecnoservice', 290, false],
    [40, 'ATM_PADRAO', 'ATM / Caixa Eletronico', 520, false],
    [50, 'MID', 'MID - Cofre compacto', 260, false],
  ]),
  rt('rt11', 'TR011', 'Taxa de Advalorem sobre montante', 'ADVALOREM', 'MONTANTE * TX_ADV', 'Custodia', [
    [10, 'ADV_056', '0,056% s/ montante', 0.00056, true],
    [20, 'ADV_05', '0,50 por mil s/ montante', 0.0005, false],
    [30, 'ADV_1', '1,00 por mil s/ montante', 0.001, false],
  ]),
  rt('rt12', 'TR012', 'Taxa de Custodia sobre montante', 'CUSTODIA', 'MONTANTE_CST * TX_CTV', 'Custodia', [
    [10, 'CTV_014', '0,014% s/ montante custodiado', 0.00014, true],
    [20, 'CTV_01', '0,10 por mil s/ montante', 0.001, false],
    [30, 'CTV_NEG', 'Negociado / a definir', 0, false],
  ]),
];

const SEED_PRICE_COMPONENTS: Array<PriceComponent> = [
  pt('pt01', 'TP001', 'ISS - Imposto Sobre Servicos', 'mainTaxRate', 'PRECO_BRUTO * ISS', [
    [10, 'ISS_5', 'ISS 5% (padrão municípios)', 5, true],
    [20, 'ISS_2', 'ISS 2% (municípios reduzidos)', 2, false],
    [30, 'ISS_3', 'ISS 3%', 3, false],
  ]),
  pt('pt02', 'TP002', 'PIS/COFINS - Contribuições Federais', 'pisCofinsRate', 'PRECO_BRUTO * PIS_COF', [
    [10, 'PISCOF_141', 'PIS/COFINS 14,1% (lucro presumido)', 14.1, true],
    [20, 'PISCOF_925', 'PIS/COFINS 9,25% (lucro real)', 9.25, false],
  ]),
  pt('pt03', 'TP003', 'Despesas Operacionais', 'operationalExpensesRate', 'PRECO_BRUTO * DESP_OP', [
    [10, 'DESP_14', '14% sobre preço bruto (padrão)', 14, true],
    [20, 'DESP_12', '12% sobre preço bruto', 12, false],
    [30, 'DESP_16', '16% sobre preço bruto (premium)', 16, false],
  ]),
  pt('pt04', 'TP004', 'Despesas Indiretas', 'indirectExpensesRate', 'PRECO_BRUTO * DESP_IND', [
    [10, 'IND_141', '14,1% sobre preço bruto (padrão)', 14.1, true],
    [20, 'IND_10', '10% sobre preço bruto', 10, false],
  ]),
  pt('pt05', 'TP005', 'Margem de Lucro (EBITDA)', 'targetMarginRate', '(PRECO_BRUTO - CUSTOS) / PRECO_BRUTO', [
    [10, 'MARG_15', '15% margem desejada', 15, false],
    [20, 'MARG_20', '20% margem desejada', 20, true],
    [30, 'MARG_25', '25% margem desejada', 25, false],
    [40, 'MARG_30', '30% margem desejada', 30, false],
  ]),
];

const SEED_TREE: Array<ProductNode> = [
  { id: 'G01', code: 'CAPTURA', name: 'Captura (Cofre Inteligente)', icon: 'ti-safe', type: 'group', children: [
    { id: 'P01', code: 'PC-CAP-001', name: 'Cofre Inteligente - Varejo', icon: 'ti-building-store', type: 'product', children: [] },
    { id: 'P02', code: 'PC-CAP-002', name: 'Cofre Inteligente - Posto de Combustivel', icon: 'ti-gas-station', type: 'product', children: [] },
    { id: 'P03', code: 'PC-CAP-003', name: 'Cofre Inteligente - Farmacia', icon: 'ti-first-aid-kit', type: 'product', children: [] },
  ] },
  { id: 'G02', code: 'TRANSPORTE', name: 'Transporte de Valores', icon: 'ti-truck', type: 'group', children: [
    { id: 'P04', code: 'PC-TRN-001', name: 'Rota Padrao - Capital', icon: 'ti-route', type: 'product', children: [] },
    { id: 'P05', code: 'PC-TRN-002', name: 'Rota Especial - Interior/MPE', icon: 'ti-route-2', type: 'product', children: [] },
    { id: 'P06', code: 'PC-TRN-003', name: 'Embarque Avulso / Spot', icon: 'ti-package-import', type: 'product', children: [] },
  ] },
  { id: 'G03', code: 'PROCESSAMENTO', name: 'Processamento de Numerario', icon: 'ti-currency-dollar', type: 'group', children: [
    { id: 'P07', code: 'PC-NUM-001', name: 'Processamento - Cedulas', icon: 'ti-notes', type: 'product', children: [] },
    { id: 'P08', code: 'PC-NUM-002', name: 'Processamento - Moedas', icon: 'ti-coin', type: 'product', children: [] },
    { id: 'P09', code: 'PC-NUM-003', name: 'Processamento - Cheques', icon: 'ti-receipt', type: 'product', children: [] },
  ] },
  { id: 'G04', code: 'CUSTODIA', name: 'Custodia de Valores', icon: 'ti-lock', type: 'group', children: [
    { id: 'P10', code: 'PC-CTV-001', name: 'Custodia - Caixa Forte CVC', icon: 'ti-vault', type: 'product', children: [] },
    { id: 'P11', code: 'PC-CTV-002', name: 'Custodia - Malote Lacrado', icon: 'ti-archive', type: 'product', children: [] },
  ] },
  { id: 'G05', code: 'PAYCASH', name: 'PayCash - Servico Completo', icon: 'ti-credit-card-pay', type: 'group', children: [
    { id: 'P12', code: 'PC-FULL-001', name: 'PayCash - Ponto de Atendimento SP/Capital', icon: 'ti-building-bank', type: 'product', children: [] },
    { id: 'P13', code: 'PC-FULL-002', name: 'PayCash - Ponto Interior (MPE)', icon: 'ti-building', type: 'product', children: [] },
  ] },
];

const DEFAULT_PRICE_COMPONENT_IDS = ['pt01', 'pt02', 'pt03', 'pt04', 'pt05'];

const composition = (productId: string, productComponentIds: Array<string>): ProductComposition => ({
  productId,
  productComponentIds,
  priceComponentIds: DEFAULT_PRICE_COMPONENT_IDS,
});

const COFRE_INTELIGENTE_COMPONENT_IDS = [
  'rt01',
  'rt02',
  'rt03',
  'rt04',
  'rt06',
  'rt09',
];
const TRANSPORTE_COMPONENT_IDS = ['rt01', 'rt03', 'rt04', 'rt06', 'rt07', 'rt08'];
const PROCESSAMENTO_COMPONENT_IDS = ['rt04', 'rt07', 'rt08'];
const CUSTODIA_COMPONENT_IDS = ['rt04', 'rt09', 'rt11', 'rt12'];
const PAYCASH_COMPONENT_IDS = [
  'rt01',
  'rt02',
  'rt03',
  'rt04',
  'rt05',
  'rt08',
  'rt10',
  'rt11',
  'rt12',
];

const SEED_COMPOSITIONS: Array<ProductComposition> = [
  ...['P01', 'P02', 'P03'].map((productId) => composition(productId, COFRE_INTELIGENTE_COMPONENT_IDS)),
  ...['P04', 'P05', 'P06'].map((productId) => composition(productId, TRANSPORTE_COMPONENT_IDS)),
  ...['P07', 'P08', 'P09'].map((productId) => composition(productId, PROCESSAMENTO_COMPONENT_IDS)),
  ...['P10', 'P11'].map((productId) => composition(productId, CUSTODIA_COMPONENT_IDS)),
  ...['P12', 'P13'].map((productId) => composition(productId, PAYCASH_COMPONENT_IDS)),
];

@Injectable({ providedIn: 'root' })
export class ProductCatalogService {
  private state = this.loadState();

  listComponents(includeInactive = true): Array<ProductComponent> {
    return this.listByKind('product', includeInactive) as Array<ProductComponent>;
  }

  listPriceComponents(includeInactive = true): Array<PriceComponent> {
    return this.listByKind('price', includeInactive) as Array<PriceComponent>;
  }

  searchComponents(term: string, group = '', status: 'all' | 'active' | 'inactive' = 'all'): Array<ProductComponent> {
    return this.searchByKind('product', term, group, status) as Array<ProductComponent>;
  }

  searchPriceComponents(term: string, group = '', status: 'all' | 'active' | 'inactive' = 'all'): Array<PriceComponent> {
    return this.searchByKind('price', term, group, status) as Array<PriceComponent>;
  }

  saveComponent(component: ProductComponent): ProductComponent {
    return this.saveByKind('product', component) as ProductComponent;
  }

  savePriceComponent(component: PriceComponent): PriceComponent {
    return this.saveByKind('price', component) as PriceComponent;
  }

  removeComponent(componentId: string): void {
    this.removeByKind('product', componentId);
  }

  removePriceComponent(componentId: string): void {
    this.removeByKind('price', componentId);
  }

  isComponentLinked(componentId: string, kind: ComponentKind): boolean {
    return this.state.compositions.some((composition) =>
      kind === 'price'
        ? composition.priceComponentIds.includes(componentId)
        : composition.productComponentIds.includes(componentId),
    );
  }

  setComponentActive(componentId: string, active: boolean): void {
    this.setActiveByKind('product', componentId, active);
  }

  setPriceComponentActive(componentId: string, active: boolean): void {
    this.setActiveByKind('price', componentId, active);
  }

  getTree(): Array<ProductNode> {
    return this.state.tree.map((node) => this.cloneNode(node));
  }

  saveTree(tree: Array<ProductNode>): void {
    this.state = { ...this.state, tree: tree.map((node) => this.normalizeNode(node)) };
    this.persist();
  }

  createGroup(group: ProductNode): ProductNode {
    const normalized = this.normalizeNode({ ...group, type: 'group', children: group.children ?? [] });
    this.state = { ...this.state, tree: [...this.state.tree, normalized] };
    this.persist();
    return this.cloneNode(normalized);
  }

  updateGroup(groupId: string, changes: Pick<ProductNode, 'code' | 'name' | 'icon'>): ProductNode | undefined {
    let updated: ProductNode | undefined;
    const tree = this.state.tree.map((group) => {
      if (group.id !== groupId) {
        return group;
      }

      updated = this.normalizeNode({ ...group, ...changes, type: 'group', children: group.children ?? [] });
      return updated;
    });

    if (!updated) {
      return undefined;
    }

    this.state = { ...this.state, tree };
    this.persist();
    return this.cloneNode(updated);
  }

  removeGroup(groupId: string): void {
    const group = this.state.tree.find((node) => node.id === groupId);
    if (!group) {
      return;
    }

    const removedProductIds = this.flattenTree(group.children ?? [])
      .filter((node) => node.type !== 'group')
      .map((node) => node.id);
    const removedProductSet = new Set(removedProductIds);
    const tree = this.state.tree.filter((node) => node.id !== groupId);
    const selectedProductId = removedProductSet.has(this.state.selectedProductId)
      ? this.firstProductId(tree)
      : this.state.selectedProductId;

    this.state = {
      ...this.state,
      tree,
      compositions: this.state.compositions.filter((composition) => !removedProductSet.has(composition.productId)),
      selectedProductId,
    };
    this.persist();
  }

  createProduct(groupId: string, product: ProductNode): ProductNode | undefined {
    let created: ProductNode | undefined;
    const tree = this.state.tree.map((group) => {
      if (group.id !== groupId) {
        return group;
      }

      created = this.normalizeNode({ ...product, type: product.type === 'service' ? 'service' : 'product', children: [] });
      return { ...group, children: [...(group.children ?? []), created] };
    });

    if (!created) {
      return undefined;
    }

    this.state = { ...this.state, tree };
    this.persist();
    return this.cloneNode(created);
  }

  updateProduct(
    productId: string,
    groupId: string,
    changes: Pick<ProductNode, 'code' | 'name' | 'icon'>,
  ): ProductNode | undefined {
    if (!this.state.tree.some((group) => group.id === groupId)) {
      return undefined;
    }

    let updated: ProductNode | undefined;
    const treeWithoutProduct = this.state.tree.map((group) => {
      const children = group.children ?? [];
      const product = children.find((child) => child.id === productId);
      if (product) {
        updated = this.normalizeNode({ ...product, ...changes, children: product.children ?? [] });
      }

      return { ...group, children: children.filter((child) => child.id !== productId) };
    });

    if (!updated) {
      return undefined;
    }

    const tree = treeWithoutProduct.map((group) =>
      group.id === groupId
        ? { ...group, children: [...(group.children ?? []), updated as ProductNode] }
        : group,
    );

    this.state = { ...this.state, tree };
    this.persist();
    return this.cloneNode(updated);
  }

  removeProduct(productId: string): void {
    const tree = this.state.tree.map((group) => ({
      ...group,
      children: (group.children ?? []).filter((product) => product.id !== productId),
    }));
    const selectedProductId = this.state.selectedProductId === productId
      ? this.firstProductId(tree)
      : this.state.selectedProductId;

    this.state = {
      ...this.state,
      tree,
      compositions: this.state.compositions.filter((composition) => composition.productId !== productId),
      selectedProductId,
    };
    this.persist();
  }

  resetTree(): Array<ProductNode> {
    this.state = { ...this.state, tree: SEED_TREE.map((node) => this.cloneNode(node)) };
    this.persist();
    return this.getTree();
  }

  getProducts(): Array<ProductNode> {
    return this.flattenTree(this.state.tree)
      .filter((node) => node.type !== 'group')
      .map((node) => this.cloneNode(node));
  }

  getProduct(productId: string): ProductNode | undefined {
    const product = this.getProducts().find((node) => node.id === productId);
    return product ? this.cloneNode(product) : undefined;
  }

  getSelectedProductId(): string {
    return this.state.selectedProductId || this.getProducts()[0]?.id || '';
  }

  setSelectedProductId(productId: string): void {
    this.state = { ...this.state, selectedProductId: productId };
    this.persist();
  }

  getComposition(productId: string): ProductComposition {
    const composition = this.state.compositions.find((item) => item.productId === productId);
    return {
      productId,
      productComponentIds: [...(composition?.productComponentIds ?? [])],
      priceComponentIds: [...(composition?.priceComponentIds ?? [])],
    };
  }

  getCompositionComponents(productId: string): Array<ProductComponent> {
    const componentById = new Map(this.state.productComponents.map((component) => [component.id, component]));
    return this.getComposition(productId).productComponentIds
      .map((componentId) => componentById.get(componentId))
      .filter((component): component is ProductComponent => Boolean(component))
      .map((component) => this.cloneComponent(component));
  }

  getCompositionPriceComponents(productId: string): Array<PriceComponent> {
    const componentById = new Map(this.state.priceComponents.map((component) => [component.id, component]));
    return this.getComposition(productId).priceComponentIds
      .map((componentId) => componentById.get(componentId))
      .filter((component): component is PriceComponent => Boolean(component))
      .map((component) => this.cloneComponent(component));
  }

  saveComposition(
    productId: string,
    productComponentIds: Array<string>,
    priceComponentIds: Array<string> = this.getComposition(productId).priceComponentIds,
  ): ProductComposition {
    const uniqueProductIds = this.uniqueIds(productComponentIds);
    const uniquePriceIds = this.uniqueIds(priceComponentIds);
    const normalized = { productId, productComponentIds: uniqueProductIds, priceComponentIds: uniquePriceIds };
    const exists = this.state.compositions.some((item) => item.productId === productId);
    const compositions = exists
      ? this.state.compositions.map((item) => item.productId === productId ? normalized : item)
      : [...this.state.compositions, normalized];

    this.state = { ...this.state, compositions };
    this.persist();
    return {
      productId,
      productComponentIds: [...uniqueProductIds],
      priceComponentIds: [...uniquePriceIds],
    };
  }

  clearComposition(productId: string): ProductComposition {
    return this.saveComposition(productId, [], []);
  }

  getFormulaVariables(): Array<{ id: string; label: string }> {
    return [...this.listComponents(false), ...this.listPriceComponents(false)]
      .filter((component) => Boolean(component.varAPV))
      .map((component) => ({
        id: component.varAPV,
        label: `${component.description}${component.unit ? ` (${component.unit})` : ''}`,
      }));
  }

  getGroups(kind: ComponentKind = 'product'): Array<string> {
    return [...new Set(this.collection(kind).map((component) => component.group).filter(Boolean))].sort();
  }

  createEmptyComponent(kind: ComponentKind = 'product'): ProductComponent {
    const next = this.collection(kind).length + 1;
    return {
      id: `${kind === 'price' ? 'pt' : 'pc'}-${Date.now()}`,
      code: `${kind === 'price' ? 'TP' : 'CP'}-${String(next).padStart(3, '0')}`,
      description: '',
      type: kind === 'price' ? 'rate' : 'number',
      unit: kind === 'price' ? '%' : '',
      group: kind === 'price' ? 'Precificacao' : 'Geral',
      status: 'Ativo',
      active: true,
      multiple: false,
      options: [],
      varAPV: `component${next}`,
      formula: '',
    };
  }

  updateOptionSelection(kind: ComponentKind, componentId: string, optionCode: string, selected: boolean): void {
    const components = this.collection(kind).map((component) => {
      if (component.id !== componentId) {
        return component;
      }

      const options = component.options.map((option) => {
        const shouldSelect = option.code === optionCode ? (component.multiple ? selected : true) : component.multiple ? option.selected : false;
        return this.normalizeOption({ ...option, selected: shouldSelect });
      });

      return this.normalizeComponent({ ...component, options });
    });

    this.replaceCollection(kind, components);
  }

  getSelectedComponentValue(component: ProductComponent): number {
    const selected = component.options.filter((option) => option.selected);
    if (!selected.length) {
      return 0;
    }

    return selected.reduce((sum, option) => sum + this.safeNumber(option.calculatedValue), 0);
  }

  private listByKind(kind: ComponentKind, includeInactive = true): Array<ProductComponent> {
    return this.collection(kind)
      .filter((component) => includeInactive || component.active)
      .map((component) => this.cloneComponent(component));
  }

  private searchByKind(kind: ComponentKind, term: string, group = '', status: 'all' | 'active' | 'inactive' = 'all'): Array<ProductComponent> {
    const normalizedTerm = term.trim().toLowerCase();
    return this.listByKind(kind, true).filter((component) => {
      const matchesTerm = !normalizedTerm
        || component.code.toLowerCase().includes(normalizedTerm)
        || component.description.toLowerCase().includes(normalizedTerm)
        || component.varAPV.toLowerCase().includes(normalizedTerm)
        || component.formula.toLowerCase().includes(normalizedTerm);
      const matchesGroup = !group || component.group === group;
      const matchesStatus = status === 'all'
        || (status === 'active' && component.active)
        || (status === 'inactive' && !component.active);

      return matchesTerm && matchesGroup && matchesStatus;
    });
  }

  private saveByKind(kind: ComponentKind, component: ProductComponent): ProductComponent {
    const normalized = this.normalizeComponent(component);
    const source = this.collection(kind);
    const exists = source.some((item) => item.id === normalized.id);
    const components = exists
      ? source.map((item) => item.id === normalized.id ? normalized : item)
      : [...source, normalized];

    this.replaceCollection(kind, components);
    return this.cloneComponent(normalized);
  }

  private setActiveByKind(kind: ComponentKind, componentId: string, active: boolean): void {
    const components = this.collection(kind).map((component) =>
      component.id === componentId ? this.normalizeComponent({ ...component, active, status: active ? 'Ativo' : 'Inativo' }) : component,
    );
    this.replaceCollection(kind, components);
  }

  private removeByKind(kind: ComponentKind, componentId: string): void {
    const components = this.collection(kind).filter((component) => component.id !== componentId);
    const compositions = this.state.compositions.map((composition) => kind === 'price'
      ? {
          ...composition,
          priceComponentIds: composition.priceComponentIds.filter((id) => id !== componentId),
        }
      : {
          ...composition,
          productComponentIds: composition.productComponentIds.filter((id) => id !== componentId),
        });

    this.state = { ...this.state, compositions };
    this.replaceCollection(kind, components);
  }

  private collection(kind: ComponentKind): Array<ProductComponent> {
    return kind === 'price' ? this.state.priceComponents : this.state.productComponents;
  }

  private replaceCollection(kind: ComponentKind, components: Array<ProductComponent>): void {
    this.state = kind === 'price'
      ? { ...this.state, priceComponents: components.map((component) => this.normalizeComponent(component)) }
      : { ...this.state, productComponents: components.map((component) => this.normalizeComponent(component)) };
    this.persist();
  }

  private loadState(): ProductCatalogState {
    const stored = this.readStorage<ProductCatalogState>(STATE_KEY);
    if (stored?.version === VERSION && Array.isArray(stored.productComponents) && Array.isArray(stored.priceComponents)) {
      return this.normalizeState(stored);
    }

    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key);
    }

    const state = this.seedState();
    this.writeStorage(STATE_KEY, state);
    return state;
  }

  private seedState(): ProductCatalogState {
    return this.normalizeState({
      version: VERSION,
      productComponents: SEED_PRODUCT_COMPONENTS,
      priceComponents: SEED_PRICE_COMPONENTS,
      tree: SEED_TREE,
      compositions: SEED_COMPOSITIONS,
      selectedProductId: 'P12',
    });
  }

  private normalizeState(state: ProductCatalogState): ProductCatalogState {
    const tree = Array.isArray(state.tree) ? state.tree.map((node) => this.normalizeNode(node)) : SEED_TREE;
    const selectedProductId = state.selectedProductId || this.flattenTree(tree).find((node) => node.type !== 'group')?.id || '';
    return {
      version: VERSION,
      productComponents: (state.productComponents ?? []).map((component) => this.normalizeComponent(component)),
      priceComponents: (state.priceComponents ?? []).map((component) => this.normalizeComponent(component)),
      tree,
      compositions: (state.compositions ?? []).map((composition) => ({
        productId: String(composition.productId),
        productComponentIds: Array.isArray(composition.productComponentIds)
          ? composition.productComponentIds.map((id) => String(id))
          : [],
        priceComponentIds: Array.isArray(composition.priceComponentIds)
          ? composition.priceComponentIds.map((id) => String(id))
          : [],
      })),
      selectedProductId,
    };
  }

  private uniqueIds(ids: Array<string>): Array<string> {
    return ids
      .map((id) => String(id))
      .filter((componentId, index, source) => componentId && source.indexOf(componentId) === index);
  }

  private normalizeComponent(component: ProductComponent): ProductComponent {
    const status = component.status === 'Inativo' || component.active === false ? 'Inativo' : 'Ativo';
    return {
      id: String(component.id || `comp-${Date.now()}`),
      code: String(component.code ?? '').trim(),
      description: String(component.description ?? '').trim(),
      type: this.normalizeType(component.type),
      unit: String(component.unit ?? '').trim(),
      group: String(component.group ?? '').trim() || 'Geral',
      status,
      active: status === 'Ativo',
      multiple: component.multiple === true,
      options: Array.isArray(component.options) ? component.options.map((option, index) => this.normalizeOption(option, index)) : [],
      varAPV: this.normalizeVariable(component.varAPV || component.code),
      formula: String(component.formula ?? '').trim(),
    };
  }

  private normalizeOption(option: ProductComponentOption, index = 0): ProductComponentOption {
    const code = String(option.code ?? option.value ?? `OPT${(index + 1) * 10}`).trim();
    const description = String(option.description ?? option.label ?? code).trim();
    const calculatedValue = this.safeNumber(option.calculatedValue ?? option.numericValue);
    const hasSelectedState = Object.prototype.hasOwnProperty.call(option, 'selected');
    return {
      sequence: this.safeNumber(option.sequence) || (index + 1) * 10,
      code,
      description,
      calculatedValue,
      costValue: this.safeNumber(option.costValue ?? calculatedValue),
      default: option.default === true,
      selected: option.selected === true || (!hasSelectedState && option.default === true),
      label: description,
      value: code,
      numericValue: calculatedValue,
    };
  }

  private normalizeNode(node: ProductNode): ProductNode {
    return {
      id: String(node.id || `node-${Date.now()}`),
      code: String(node.code ?? '').trim(),
      name: String(node.name ?? '').trim(),
      icon: String(node.icon ?? '').trim(),
      type: node.type === 'group' ? 'group' : 'product',
      children: Array.isArray(node.children) ? node.children.map((child) => this.normalizeNode(child)) : [],
    };
  }

  private normalizeType(type: CatalogComponentType): CatalogComponentType {
    return ['number', 'text', 'select', 'boolean', 'rate'].includes(type) ? type : 'number';
  }

  private normalizeVariable(value: string): string {
    const normalized = String(value ?? '')
      .trim()
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/^[^A-Za-z_]+/, '');

    return normalized || 'component';
  }

  private flattenTree(nodes: Array<ProductNode>): Array<ProductNode> {
    return nodes.flatMap((node) => [node, ...this.flattenTree(node.children ?? [])]);
  }

  private firstProductId(tree: Array<ProductNode>): string {
    return this.flattenTree(tree).find((node) => node.type !== 'group')?.id || '';
  }

  private cloneComponent<T extends ProductComponent>(component: T): T {
    return {
      ...component,
      options: component.options.map((option) => ({ ...option })),
    };
  }

  private cloneNode(node: ProductNode): ProductNode {
    return {
      ...node,
      children: node.children?.map((child) => this.cloneNode(child)),
    };
  }

  private safeNumber(value: unknown): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  private persist(): void {
    this.writeStorage(STATE_KEY, this.state);
  }

  private readStorage<T>(key: string): T | undefined {
    if (typeof localStorage === 'undefined') {
      return undefined;
    }

    const value = localStorage.getItem(key);
    if (!value) {
      return undefined;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      localStorage.removeItem(key);
      return undefined;
    }
  }

  private writeStorage<T>(key: string, value: T): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  }
}
