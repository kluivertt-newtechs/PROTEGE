import { Injectable } from '@angular/core';

export type ProductComponentType = 'number' | 'text' | 'select' | 'boolean' | 'rate';
export type ProductNodeType = 'group' | 'product' | 'service';

export interface ProductComponentOption {
  label: string;
  value: string;
  numericValue?: number;
}

export interface ProductComponent {
  id: string;
  code: string;
  description: string;
  type: ProductComponentType;
  unit: string;
  group: string;
  active: boolean;
  multiple: boolean;
  options: Array<ProductComponentOption>;
  varAPV: string;
}

export interface ProductNode {
  id: string;
  code: string;
  name: string;
  type: ProductNodeType;
  children?: Array<ProductNode>;
}

export interface ProductComposition {
  productId: string;
  productComponentIds: Array<string>;
}

export interface SalePriceSimulation {
  productId: string;
  values: Record<string, number | string | boolean | Array<string>>;
  result?: number;
  memory?: Array<unknown>;
}

const COMPONENTS_KEY = 'protege.productCatalog.components';
const PRODUCT_TREE_KEY = 'protege.productCatalog.tree';
const COMPOSITIONS_KEY = 'protege.productCatalog.compositions';
const SELECTED_PRODUCT_KEY = 'protege.productCatalog.selectedProduct';

const SEED_COMPONENTS: Array<ProductComponent> = [
  {
    id: 'comp-cost-base',
    code: 'CST_BASE',
    description: 'Custo base operacional',
    type: 'number',
    unit: 'R$',
    group: 'Custos',
    active: true,
    multiple: false,
    options: [],
    varAPV: 'costBase',
  },
  {
    id: 'comp-quantity',
    code: 'QTD_MENSAL',
    description: 'Quantidade mensal',
    type: 'number',
    unit: 'un',
    group: 'Volume',
    active: true,
    multiple: false,
    options: [],
    varAPV: 'quantity',
  },
  {
    id: 'comp-tax',
    code: 'ALIQUOTA',
    description: 'Alíquota principal',
    type: 'rate',
    unit: '%',
    group: 'Tributação',
    active: true,
    multiple: false,
    options: [],
    varAPV: 'mainTaxRate',
  },
  {
    id: 'comp-risk',
    code: 'RISCO',
    description: 'Adicional por criticidade',
    type: 'select',
    unit: 'fator',
    group: 'Comercial',
    active: true,
    multiple: false,
    options: [
      { label: 'Baixo', value: 'baixo', numericValue: 0 },
      { label: 'Médio', value: 'medio', numericValue: 0.03 },
      { label: 'Alto', value: 'alto', numericValue: 0.06 },
    ],
    varAPV: 'riskRate',
  },
  {
    id: 'comp-insurance',
    code: 'SEGURO',
    description: 'Seguro adicional',
    type: 'boolean',
    unit: 'sim/não',
    group: 'Comercial',
    active: true,
    multiple: false,
    options: [],
    varAPV: 'insuranceEnabled',
  },
];

const SEED_TREE: Array<ProductNode> = [
  {
    id: 'grp-transport',
    code: 'TV',
    name: 'Transporte de Valores',
    type: 'group',
    children: [
      { id: 'prod-coleta', code: 'TV-001', name: 'Coleta Programada', type: 'service' },
      { id: 'prod-abastecimento', code: 'TV-002', name: 'Abastecimento ATM', type: 'service' },
    ],
  },
  {
    id: 'grp-processing',
    code: 'PR',
    name: 'Processamento',
    type: 'group',
    children: [
      { id: 'prod-processamento', code: 'PR-001', name: 'Processamento de Numerário', type: 'service' },
    ],
  },
];

const SEED_COMPOSITIONS: Array<ProductComposition> = [
  {
    productId: 'prod-coleta',
    productComponentIds: ['comp-cost-base', 'comp-quantity', 'comp-tax', 'comp-risk'],
  },
  {
    productId: 'prod-abastecimento',
    productComponentIds: ['comp-cost-base', 'comp-quantity', 'comp-tax', 'comp-insurance'],
  },
  {
    productId: 'prod-processamento',
    productComponentIds: ['comp-cost-base', 'comp-quantity', 'comp-tax'],
  },
];

@Injectable({ providedIn: 'root' })
export class ProductCatalogService {
  private components = this.loadComponents();
  private tree = this.loadTree();
  private compositions = this.loadCompositions();
  private selectedProductId = this.readStorage<string>(SELECTED_PRODUCT_KEY) ?? this.getProducts()[0]?.id ?? '';

  listComponents(includeInactive = true): Array<ProductComponent> {
    return this.components
      .filter((component) => includeInactive || component.active)
      .map((component) => this.cloneComponent(component));
  }

  searchComponents(term: string, group = '', status: 'all' | 'active' | 'inactive' = 'all'): Array<ProductComponent> {
    const normalizedTerm = term.trim().toLowerCase();

    return this.listComponents(true).filter((component) => {
      const matchesTerm = !normalizedTerm
        || component.code.toLowerCase().includes(normalizedTerm)
        || component.description.toLowerCase().includes(normalizedTerm)
        || component.varAPV.toLowerCase().includes(normalizedTerm);
      const matchesGroup = !group || component.group === group;
      const matchesStatus = status === 'all'
        || (status === 'active' && component.active)
        || (status === 'inactive' && !component.active);

      return matchesTerm && matchesGroup && matchesStatus;
    });
  }

  saveComponent(component: ProductComponent): ProductComponent {
    const normalized = this.normalizeComponent(component);
    const exists = this.components.some((item) => item.id === normalized.id);

    this.components = exists
      ? this.components.map((item) => item.id === normalized.id ? normalized : item)
      : [...this.components, normalized];
    this.writeStorage(COMPONENTS_KEY, this.components);

    return this.cloneComponent(normalized);
  }

  setComponentActive(componentId: string, active: boolean): void {
    this.components = this.components.map((component) =>
      component.id === componentId ? { ...component, active } : component,
    );
    this.writeStorage(COMPONENTS_KEY, this.components);
  }

  getTree(): Array<ProductNode> {
    return this.tree.map((node) => this.cloneNode(node));
  }

  getProducts(): Array<ProductNode> {
    return this.flattenTree(this.tree)
      .filter((node) => node.type !== 'group')
      .map((node) => this.cloneNode(node));
  }

  getProduct(productId: string): ProductNode | undefined {
    const product = this.getProducts().find((node) => node.id === productId);
    return product ? this.cloneNode(product) : undefined;
  }

  getSelectedProductId(): string {
    return this.selectedProductId;
  }

  setSelectedProductId(productId: string): void {
    this.selectedProductId = productId;
    this.writeStorage(SELECTED_PRODUCT_KEY, productId);
  }

  getComposition(productId: string): ProductComposition {
    const composition = this.compositions.find((item) => item.productId === productId);

    return {
      productId,
      productComponentIds: [...(composition?.productComponentIds ?? [])],
    };
  }

  getCompositionComponents(productId: string): Array<ProductComponent> {
    const componentById = new Map(this.components.map((component) => [component.id, component]));

    return this.getComposition(productId).productComponentIds
      .map((componentId) => componentById.get(componentId))
      .filter((component): component is ProductComponent => Boolean(component))
      .map((component) => this.cloneComponent(component));
  }

  saveComposition(productId: string, componentIds: Array<string>): ProductComposition {
    const uniqueIds = componentIds.filter((componentId, index) => componentIds.indexOf(componentId) === index);
    const normalized = { productId, productComponentIds: uniqueIds };
    const exists = this.compositions.some((item) => item.productId === productId);

    this.compositions = exists
      ? this.compositions.map((item) => item.productId === productId ? normalized : item)
      : [...this.compositions, normalized];
    this.writeStorage(COMPOSITIONS_KEY, this.compositions);

    return { productId, productComponentIds: [...uniqueIds] };
  }

  getFormulaVariables(): Array<{ id: string; label: string }> {
    return this.listComponents(false)
      .filter((component) => Boolean(component.varAPV))
      .map((component) => ({
        id: component.varAPV,
        label: `${component.description}${component.unit ? ` (${component.unit})` : ''}`,
      }));
  }

  getGroups(): Array<string> {
    return [...new Set(this.components.map((component) => component.group).filter(Boolean))].sort();
  }

  createEmptyComponent(): ProductComponent {
    const next = this.components.length + 1;

    return {
      id: `comp-${Date.now()}`,
      code: `COMP-${String(next).padStart(3, '0')}`,
      description: '',
      type: 'number',
      unit: '',
      group: 'Geral',
      active: true,
      multiple: false,
      options: [],
      varAPV: `component${next}`,
    };
  }

  private loadComponents(): Array<ProductComponent> {
    const stored = this.readStorage<Array<ProductComponent>>(COMPONENTS_KEY);
    return (Array.isArray(stored) ? stored : SEED_COMPONENTS).map((component) => this.normalizeComponent(component));
  }

  private loadTree(): Array<ProductNode> {
    const stored = this.readStorage<Array<ProductNode>>(PRODUCT_TREE_KEY);
    return (Array.isArray(stored) ? stored : SEED_TREE).map((node) => this.cloneNode(node));
  }

  private loadCompositions(): Array<ProductComposition> {
    const stored = this.readStorage<Array<ProductComposition>>(COMPOSITIONS_KEY);
    const source = Array.isArray(stored) ? stored : SEED_COMPOSITIONS;

    return source.map((composition) => ({
      productId: String(composition.productId),
      productComponentIds: Array.isArray(composition.productComponentIds)
        ? composition.productComponentIds.map((id) => String(id))
        : [],
    }));
  }

  private normalizeComponent(component: ProductComponent): ProductComponent {
    return {
      id: String(component.id || `comp-${Date.now()}`),
      code: String(component.code ?? '').trim(),
      description: String(component.description ?? '').trim(),
      type: this.normalizeType(component.type),
      unit: String(component.unit ?? '').trim(),
      group: String(component.group ?? '').trim() || 'Geral',
      active: component.active !== false,
      multiple: component.multiple === true,
      options: Array.isArray(component.options)
        ? component.options.map((option) => ({
            label: String(option.label ?? '').trim(),
            value: String(option.value ?? '').trim(),
            numericValue: Number.isFinite(Number(option.numericValue)) ? Number(option.numericValue) : undefined,
          })).filter((option) => option.label && option.value)
        : [],
      varAPV: this.normalizeVariable(component.varAPV || component.code),
    };
  }

  private normalizeType(type: ProductComponentType): ProductComponentType {
    return ['number', 'text', 'select', 'boolean', 'rate'].includes(type) ? type : 'number';
  }

  private normalizeVariable(value: string): string {
    const normalized = String(value ?? '')
      .trim()
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/^[^A-Za-z_]+/, '');

    return normalized || `component${this.components?.length ?? 1}`;
  }

  private flattenTree(nodes: Array<ProductNode>): Array<ProductNode> {
    return nodes.flatMap((node) => [node, ...this.flattenTree(node.children ?? [])]);
  }

  private cloneComponent(component: ProductComponent): ProductComponent {
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
