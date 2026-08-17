import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import {
  PoLookupColumn,
  PoLookupComponent,
  PoLookupFilter,
  PoLookupFilteredItemsParams,
  PoLookupResponseApi,
  PoPageAction,
  PoSelectOption,
} from '@po-ui/ng-components';
import { Observable, of } from 'rxjs';
import { FormulaExecutionStep } from 'src/app/core/mock';
import {
  PriceComponent,
  ProductCatalogService,
  ProductComponent,
  ProductComponentOption,
  ProductNode,
} from 'src/app/core/product-catalog.service';
import { PricingFormulaService, executePricingFormulas } from 'src/app/core/pricing-formula.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

interface ComponentGroup {
  name: string;
  components: Array<ProductComponent>;
}

interface ResultMetric {
  label: string;
  value: string;
  featured?: boolean;
  muted?: boolean;
}

interface ProductLookupItem {
  id: string;
  code: string;
  name: string;
  label: string;
  type: string;
}

class ProductLookupService implements PoLookupFilter {
  constructor(private readonly getProducts: () => Array<ProductNode>) {}

  getFilteredItems(params: PoLookupFilteredItemsParams): Observable<PoLookupResponseApi> {
    const filter = normalizeText(params.filter ?? '').toLowerCase();
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const filtered = this.items().filter((item) =>
      !filter
        || item.id.toLowerCase().includes(filter)
        || item.code.toLowerCase().includes(filter)
        || item.name.toLowerCase().includes(filter)
        || item.label.toLowerCase().includes(filter),
    );
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    return of({ items: pageItems, hasNext: start + pageSize < filtered.length });
  }

  getObjectByValue(value: string | Array<any>): Observable<ProductLookupItem | Array<ProductLookupItem> | undefined> {
    const items = this.items();

    if (Array.isArray(value)) {
      return of(items.filter((item) => value.includes(item.id)));
    }

    return of(items.find((item) => item.id === value));
  }

  private items(): Array<ProductLookupItem> {
    return this.getProducts().map((product) => {
      const code = normalizeText(product.code);
      const name = normalizeText(product.name);

      return {
        id: product.id,
        code,
        name,
        label: `${code} - ${name}`,
        type: product.type === 'service' ? 'Serviço' : 'Produto',
      };
    });
  }
}

function normalizeText(value: string): string {
  const text = String(value ?? '');

  if (!/[\u00c3\u00c2\u0080-\u009f\ufffd]/.test(text)) {
    return text;
  }

  try {
    const bytes = new Uint8Array([...text].map((char) => char.charCodeAt(0) & 255));
    return new TextDecoder('utf-8').decode(bytes).replace(/\uFFFD/g, '');
  } catch {
    return text
      .replace(/\u00c3\u00a7/g, 'ç')
      .replace(/\u00c3\u00a3/g, 'ã')
      .replace(/\u00c3\u00a1/g, 'á')
      .replace(/\u00c3\u00a9/g, 'é')
      .replace(/\u00c3\u00ad/g, 'í')
      .replace(/\u00c3\u00b3/g, 'ó')
      .replace(/\u00c3\u00ba/g, 'ú')
      .replace(/\u00c3\u00aa/g, 'ê')
      .replace(/\u00c3\u0087/g, 'Ç')
      .replace(/\u00c3\u0081/g, 'Á');
  }
}

@Component({
  selector: 'app-sale-price',
  templateUrl: './sale-price.component.html',
  styleUrls: ['./sale-price.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class SalePriceComponent {
  @ViewChild('productLookup') productLookup!: PoLookupComponent;

  products: Array<ProductNode> = [];
  selectedProductId = '';
  components: Array<ProductComponent> = [];
  priceComponents: Array<PriceComponent> = [];
  values: Record<string, number | string | boolean> = {};
  resultValues: Record<string, number> = {};
  memory: Array<FormulaExecutionStep> = [];
  warning = '';

  readonly pageActions: Array<PoPageAction> = [
    { label: 'Selecionar Produto', icon: 'an an-magnifying-glass', action: () => this.openProductSelector() },
  ];
  readonly productLookupColumns: Array<PoLookupColumn> = [
    { property: 'code', label: 'Código', width: '24%' },
    { property: 'name', label: 'Produto ou serviço' },
    { property: 'type', label: 'Tipo', width: '18%' },
  ];
  readonly productLookupService = new ProductLookupService(() => this.catalog.getProducts());

  constructor(
    private readonly catalog: ProductCatalogService,
    private readonly formulaService: PricingFormulaService,
  ) {
    this.products = this.catalog.getProducts();
    this.selectedProductId = this.catalog.getSelectedProductId() || this.products[0]?.id || '';
    this.loadComposition();
  }

  get finalPrice(): number {
    return this.resultValues['finalPrice'] ?? 0;
  }

  get monthlyPrice(): number {
    return this.resultValues['monthlyPrice'] ?? this.finalPrice * (this.getContextValue('quantity') || 1);
  }

  get selectedProduct(): ProductNode | undefined {
    return this.products.find((product) => product.id === this.selectedProductId);
  }

  get selectedProductLabel(): string {
    const product = this.selectedProduct;
    return product ? this.displayText(`${product.code} - ${product.name}`) : '';
  }

  get groupedComponents(): Array<ComponentGroup> {
    const groups = new Map<string, Array<ProductComponent>>();

    for (const component of this.components) {
      const group = this.displayText(component.group || 'Geral');
      groups.set(group, [...(groups.get(group) ?? []), component]);
    }

    return [...groups.entries()].map(([name, groupComponents]) => ({
      name,
      components: groupComponents,
    }));
  }

  get componentCount(): number {
    return this.components.length;
  }

  get selectedComponentCount(): number {
    return this.components.filter((component) =>
      component.type !== 'select' || Boolean(this.values[component.id]),
    ).length;
  }

  get priceComponentCount(): number {
    return this.priceComponents.length;
  }

  get hasComposition(): boolean {
    return Boolean(this.selectedProductId && this.components.length);
  }

  get resultMetrics(): Array<ResultMetric> {
    return [
      { label: 'Preço unitário', value: this.formatCurrency(this.finalPrice), featured: true },
      { label: 'Preço mensal', value: this.formatCurrency(this.monthlyPrice), featured: true },
      { label: 'Alíquota total', value: this.formatPercent(this.resultValues['taxRate'] || 0) },
      { label: 'Custo', value: this.formatCurrency(this.resultValues['costTotal'] || 0) },
      { label: 'Preço líquido', value: this.formatCurrency(this.resultValues['netPrice'] || 0) },
      { label: 'Impostos', value: this.formatCurrency(this.resultValues['taxes'] || 0) },
      {
        label: 'Margem / EBITDA',
        value: this.formatPercent(this.resultValues['ebitdaRate'] || 0),
        muted: !this.hasResultValue('ebitdaRate'),
      },
    ];
  }

  get hasMemoryIssues(): boolean {
    return this.memory.some((step) => step.status !== 'ok');
  }

  openProductSelector(): void {
    this.products = this.catalog.getProducts();
    this.productLookup.openLookup();
  }

  onProductLookupSelected(product: ProductLookupItem | undefined): void {
    if (!product?.id) {
      return;
    }

    this.selectProduct(product.id);
  }

  onProductLookupChange(productId: string | undefined): void {
    if (!productId) {
      return;
    }

    this.selectProduct(productId);
  }

  selectProduct(productId: string): void {
    if (this.selectedProductId === productId) {
      return;
    }

    this.selectedProductId = productId;
    this.catalog.setSelectedProductId(productId);
    this.products = this.catalog.getProducts();
    this.loadComposition();
  }

  recalculate(): void {
    if (!this.selectedProductId) {
      this.warning = 'Selecione um produto para simular.';
      this.resultValues = {};
      this.memory = [];
      return;
    }

    if (!this.components.length) {
      this.warning = 'Produto sem composição. Vincule componentes na Árvore de Produto.';
      this.resultValues = {};
      this.memory = [];
      return;
    }

    const formulas = this.formulaService.getFormulas(this.selectedProductId);
    if (!formulas.some((formula) => formula.enabled)) {
      this.resultValues = {};
      this.memory = [];
      this.warning = '';
      return;
    }

    const context = this.buildFormulaContext();
    const execution = executePricingFormulas(context, formulas);

    this.resultValues = execution.values;
    this.memory = execution.memory;
    this.warning = execution.warning ? this.displayText(execution.warning) : '';
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatPercent(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
  }

  getSelectOptions(component: ProductComponent): Array<PoSelectOption> {
    return this.getEffectiveOptions(component).map((option) => ({
      label: this.displayText(option.description),
      value: option.code,
    }));
  }

  selectCatalogOption(component: ProductComponent, option: ProductComponentOption, kind: 'product' | 'price'): void {
    this.catalog.updateOptionSelection(kind, component.id, option.code, !option.selected);
    this.components = this.catalog.getCompositionComponents(this.selectedProductId);
    this.loadPriceComponents();
    this.applySelectedDefaults();
    this.recalculate();
  }

  displayText(value: string): string {
    return normalizeText(value);
  }

  componentMeta(component: ProductComponent): string {
    return [component.unit, component.varAPV].filter(Boolean).join(' · ');
  }

  optionValueLabel(option: ProductComponentOption): string {
    const value = option.calculatedValue;

    if (!Number.isFinite(value)) {
      return '';
    }

    return Math.abs(value) < 1 && value !== 0 ? this.formatPercent(value) : String(value).replace('.', ',');
  }

  memoryStatusLabel(step: FormulaExecutionStep): string {
    if (step.status === 'error') {
      return 'Erro';
    }

    if (step.status === 'disabled') {
      return 'Desabilitada';
    }

    return 'Ok';
  }

  trackByGroup(_: number, group: ComponentGroup): string {
    return group.name;
  }

  trackByComponent(_: number, component: ProductComponent): string {
    return component.id;
  }

  trackByOption(_: number, option: ProductComponentOption): string {
    return option.code;
  }

  trackByMetric(_: number, metric: ResultMetric): string {
    return metric.label;
  }

  trackByMemory(_: number, step: FormulaExecutionStep): string {
    return step.id;
  }

  private loadComposition(): void {
    this.components = this.catalog.getCompositionComponents(this.selectedProductId);
    this.loadPriceComponents();
    this.values = {};

    for (const component of this.components) {
      if (component.type === 'boolean') {
        this.values[component.id] = false;
      } else if (component.type === 'select') {
        const options = this.getEffectiveOptions(component);
        this.values[component.id] = options.find((option) => option.selected)?.code ?? options[0]?.code ?? '';
      } else {
        this.values[component.id] = this.defaultValueFor(component);
      }
    }

    this.applySelectedDefaults();
    this.recalculate();
  }

  private loadPriceComponents(): void {
    this.priceComponents = this.catalog.getCompositionPriceComponents(this.selectedProductId);
  }

  private applySelectedDefaults(): void {
    for (const component of this.components) {
      if (component.type === 'select' && !this.values[component.id]) {
        const options = this.getEffectiveOptions(component);
        this.values[component.id] = options.find((option) => option.selected)?.code ?? options[0]?.code ?? '';
      }
    }
  }

  private buildFormulaContext(): Record<string, number> {
    const context: Record<string, number> = {
      operationalExpensesRate: 0.14,
      indirectExpensesRate: 0.141,
      targetMarginRate: 0.2,
      pisCofinsRate: 0.141,
      mainTaxRate: 0.05,
      costBase: 1000,
      quantity: 1,
      SELIC: 0.1475,
    };

    for (const component of this.priceComponents) {
      context[component.varAPV] = this.normalizeRate(this.catalog.getSelectedComponentValue(component));
    }

    for (const component of this.components) {
      context[component.varAPV] = this.resolveComponentNumber(component);
    }

    return context;
  }

  private resolveComponentNumber(component: ProductComponent): number {
    const value = this.values[component.id];

    if (component.type === 'boolean') {
      return value === true ? 1 : 0;
    }

    if (component.type === 'select') {
      return this.findOption(component, String(value))?.calculatedValue ?? this.catalog.getSelectedComponentValue(component);
    }

    if (component.type === 'rate') {
      return this.normalizeRate(this.safeNumber(value));
    }

    if (component.type === 'text') {
      return 0;
    }

    return this.safeNumber(value);
  }

  private findOption(component: ProductComponent, value: string): ProductComponentOption | undefined {
    return this.getEffectiveOptions(component).find((option) => option.code === value);
  }

  private getEffectiveOptions(component: ProductComponent): Array<ProductComponentOption> {
    if (component.options.length) {
      return component.options;
    }

    if (!component.varAPV) {
      return [];
    }

    const optionSource = [...this.catalog.listComponents(false), ...this.priceComponents]
      .find((candidate) =>
        candidate.id !== component.id &&
        candidate.varAPV === component.varAPV &&
        candidate.options.length,
      );

    return optionSource?.options ?? [];
  }

  private defaultValueFor(component: ProductComponent): number | string {
    if (component.varAPV === 'costBase') {
      return 1000;
    }

    if (component.varAPV === 'quantity') {
      return 1;
    }

    if (component.type === 'rate') {
      return 0;
    }

    return component.type === 'text' ? '' : 0;
  }

  private safeNumber(value: unknown): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  private normalizeRate(value: number): number {
    return Math.abs(value) > 1 ? value / 100 : value;
  }

  private getContextValue(key: string): number {
    return this.buildFormulaContext()[key] ?? 0;
  }

  private hasResultValue(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.resultValues, key);
  }
}
