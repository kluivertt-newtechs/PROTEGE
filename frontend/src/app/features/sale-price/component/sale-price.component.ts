import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PoSelectOption } from '@po-ui/ng-components';
import { CommercialParameters, FormulaExecutionStep } from 'src/app/core/mock';
import {
  ProductCatalogService,
  ProductComponent,
  ProductComponentOption,
} from 'src/app/core/product-catalog.service';
import { PricingFormulaService, executePricingFormulas } from 'src/app/core/pricing-formula.service';
import { PricingMockStateService } from 'src/app/core/pricing-mock-state.service';
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
  values: Record<string, number | string | boolean> = {};
  parameters: CommercialParameters;
  resultValues: Record<string, number> = {};
  memory: Array<FormulaExecutionStep> = [];
  warning = '';

  constructor(
    private readonly catalog: ProductCatalogService,
    private readonly formulaService: PricingFormulaService,
    private readonly mockState: PricingMockStateService,
  ) {
    this.parameters = this.mockState.getCommercialParameters();
    this.productOptions = this.catalog.getProducts().map((product) => ({
      label: `${product.code} - ${product.name}`,
      value: product.id,
    }));
    this.selectedProductId = this.catalog.getSelectedProductId() || String(this.productOptions[0]?.value ?? '');
    this.loadComposition();
  }

  get finalPrice(): number {
    return this.resultValues['finalPrice'] ?? 0;
  }

  get monthlyPrice(): number {
    return this.resultValues['monthlyPrice'] ?? this.finalPrice * (this.getContextValue('quantity') || 1);
  }

  onProductChange(productId: string): void {
    this.selectedProductId = productId;
    this.catalog.setSelectedProductId(productId);
    this.loadComposition();
  }

  recalculate(): void {
    this.parameters = this.mockState.getCommercialParameters();
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
    return component.options.map((option) => ({ label: option.label, value: option.value }));
  }

  private loadComposition(): void {
    this.components = this.catalog.getCompositionComponents(this.selectedProductId);
    this.values = {};

    for (const component of this.components) {
      if (component.type === 'boolean') {
        this.values[component.id] = false;
      } else if (component.type === 'select') {
        this.values[component.id] = component.options[0]?.value ?? '';
      } else {
        this.values[component.id] = this.defaultValueFor(component);
      }
    }

    this.recalculate();
  }

  private buildFormulaContext(): Record<string, number> {
    const context: Record<string, number> = {
      operationalExpensesRate: this.parameters.operationalExpensesRate,
      indirectExpensesRate: this.parameters.indirectExpensesRate,
      targetMarginRate: this.parameters.targetMarginRate,
      pisCofinsRate: this.parameters.pisCofinsRate,
      mainTaxRate: 0,
      costBase: 0,
      quantity: 1,
    };

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
      return this.findOption(component, String(value))?.numericValue ?? 0;
    }

    if (component.type === 'rate') {
      const numeric = this.safeNumber(value);
      return numeric > 1 ? numeric / 100 : numeric;
    }

    if (component.type === 'text') {
      return 0;
    }

    return this.safeNumber(value);
  }

  private findOption(component: ProductComponent, value: string): ProductComponentOption | undefined {
    return component.options.find((option) => option.value === value);
  }

  private defaultValueFor(component: ProductComponent): number | string {
    if (component.varAPV === 'costBase') {
      return 1000;
    }

    if (component.varAPV === 'quantity') {
      return 1;
    }

    if (component.type === 'rate') {
      return component.varAPV === 'mainTaxRate' ? 5 : 0;
    }

    return component.type === 'text' ? '' : 0;
  }

  private safeNumber(value: unknown): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  private getContextValue(key: string): number {
    return this.buildFormulaContext()[key] ?? 0;
  }
}
