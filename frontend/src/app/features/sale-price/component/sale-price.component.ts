import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PoSelectOption } from '@po-ui/ng-components';
import { FormulaExecutionStep } from 'src/app/core/mock';
import {
  PriceComponent,
  ProductCatalogService,
  ProductComponent,
  ProductComponentOption,
} from 'src/app/core/product-catalog.service';
import { PricingFormulaService, executePricingFormulas } from 'src/app/core/pricing-formula.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

@Component({
  selector: 'app-sale-price',
  templateUrl: './sale-price.component.html',
  styleUrls: ['./sale-price.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class SalePriceComponent {
  productOptions: Array<PoSelectOption> = [];
  selectedProductId = '';
  components: Array<ProductComponent> = [];
  priceComponents: Array<PriceComponent> = [];
  values: Record<string, number | string | boolean> = {};
  resultValues: Record<string, number> = {};
  memory: Array<FormulaExecutionStep> = [];
  warning = '';

  constructor(
    private readonly catalog: ProductCatalogService,
    private readonly formulaService: PricingFormulaService,
  ) {
    this.productOptions = this.catalog.getProducts().map((product) => ({
      label: `${product.code} - ${product.name}`,
      value: product.id,
    }));
    this.selectedProductId = this.catalog.getSelectedProductId() || String(this.productOptions[0]?.value ?? '');
    this.priceComponents = this.catalog.listPriceComponents(false);
    this.loadComposition();
  }

  get finalPrice(): number {
    return this.resultValues['finalPrice'] ?? 0;
  }

  get monthlyPrice(): number {
    return this.resultValues['monthlyPrice'] ?? this.finalPrice * (this.getContextValue('quantity') || 1);
  }

  get selectedProductLabel(): string {
    return String(this.productOptions.find((option) => option.value === this.selectedProductId)?.label ?? '');
  }

  onProductChange(productId: string): void {
    this.selectedProductId = productId;
    this.catalog.setSelectedProductId(productId);
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

    const context = this.buildFormulaContext();
    const execution = executePricingFormulas(context, this.formulaService.getFormulas());

    this.resultValues = execution.values;
    this.memory = execution.memory;
    this.warning = execution.warning ?? '';
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatPercent(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
  }

  getSelectOptions(component: ProductComponent): Array<PoSelectOption> {
    return component.options.map((option) => ({ label: option.description, value: option.code }));
  }

  selectCatalogOption(component: ProductComponent, option: ProductComponentOption, kind: 'product' | 'price'): void {
    this.catalog.updateOptionSelection(kind, component.id, option.code, !option.selected);
    this.components = this.catalog.getCompositionComponents(this.selectedProductId);
    this.priceComponents = this.catalog.listPriceComponents(false);
    this.applySelectedDefaults();
    this.recalculate();
  }

  private loadComposition(): void {
    this.components = this.catalog.getCompositionComponents(this.selectedProductId);
    this.values = {};

    for (const component of this.components) {
      if (component.type === 'boolean') {
        this.values[component.id] = false;
      } else if (component.type === 'select') {
        this.values[component.id] = component.options.find((option) => option.selected)?.code ?? component.options[0]?.code ?? '';
      } else {
        this.values[component.id] = this.defaultValueFor(component);
      }
    }

    this.applySelectedDefaults();
    this.recalculate();
  }

  private applySelectedDefaults(): void {
    for (const component of this.components) {
      if (component.type === 'select' && !this.values[component.id]) {
        this.values[component.id] = component.options.find((option) => option.selected)?.code ?? component.options[0]?.code ?? '';
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
    return component.options.find((option) => option.code === value);
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
}
