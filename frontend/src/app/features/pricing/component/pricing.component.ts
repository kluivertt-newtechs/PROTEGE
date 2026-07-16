import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PoSelectOption, PoTableColumn } from '@po-ui/ng-components';
import {
  CommercialParameters,
  commercialParametersMock,
  pricingBases,
  processingCosts,
  vehicleCosts,
} from 'src/app/core/mock';
import { SHARED_MODULES } from 'src/app/shared/shared';

type TableItem = Record<string, string | number>;

@Component({
  selector: 'app-pricing',
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class PricingComponent {
  readonly bases = pricingBases;
  readonly vehicleCosts = vehicleCosts;
  readonly processingCosts = processingCosts;

  parameters: CommercialParameters = { ...commercialParametersMock };
  selectedBaseId = this.bases[0]?.id ?? '';
  baseOptions: Array<PoSelectOption> = this.bases.map((base) => ({
    label: `${base.name} (${base.uf})`,
    value: base.id,
  }));
  costItems: Array<TableItem> = this.buildCostItems();
  processingItems: Array<TableItem> = this.processingCosts.map((cost) => ({
    type: cost.type,
    base: this.bases.find((base) => base.id === cost.baseId)?.name ?? cost.baseId,
    costPerThousand: this.formatCurrency(cost.costPerThousand),
    issRate: this.formatPercent(cost.issRate),
  }));
  syncStatus = 'Última sincronização: hoje, 08:14 - CD0704 / PD4000 / FT4001';

  costColumns: Array<PoTableColumn> = [
    { property: 'vehicle', label: 'Veículo' },
    { property: 'normalHour', label: 'Hora normal' },
    { property: 'overtime50', label: 'HE 50%' },
    { property: 'overtime100', label: 'HE 100%' },
    { property: 'fixedCostPerHour', label: 'Fixo veículo/h' },
    { property: 'variableCostPerKm', label: 'Variável/km' },
    { property: 'issRate', label: 'ISS' },
    { property: 'icmsRate', label: 'ICMS' },
  ];

  processingColumns: Array<PoTableColumn> = [
    { property: 'type', label: 'Tipo' },
    { property: 'base', label: 'Base' },
    { property: 'costPerThousand', label: 'Custo/milheiro' },
    { property: 'issRate', label: 'ISS' },
  ];

  get selectedBase() {
    return this.bases.find((base) => base.id === this.selectedBaseId) ?? this.bases[0];
  }

  onBaseChange(baseId: string): void {
    this.selectedBaseId = baseId;
    this.costItems = this.buildCostItems();
  }

  private buildCostItems(): Array<TableItem> {
    return this.vehicleCosts
      .filter((cost) => cost.baseId === this.selectedBaseId)
      .map((cost) => ({
        vehicle: cost.vehicle,
        normalHour: this.formatCurrency(cost.normalHour),
        overtime50: this.formatCurrency(cost.overtime50),
        overtime100: this.formatCurrency(cost.overtime100),
        fixedCostPerHour: this.formatCurrency(cost.fixedCostPerHour),
        variableCostPerKm: this.formatCurrency(cost.variableCostPerKm),
        issRate: this.formatPercent(cost.issRate),
        icmsRate: this.formatPercent(cost.icmsRate),
      }));
  }

  synchronizeErp(): void {
    const now = new Date();
    this.syncStatus = `Última sincronização: ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })} - CD0704 / PD4000 / FT4001`;
  }

  saveParameters(): void {
    this.syncStatus = 'Parâmetros comerciais salvos localmente.';
  }

  onParameterChange(): void {
    this.parameters = {
      operationalExpensesRate: this.normalizeRate(this.parameters.operationalExpensesRate),
      indirectExpensesRate: this.normalizeRate(this.parameters.indirectExpensesRate),
      targetMarginRate: this.normalizeRate(this.parameters.targetMarginRate),
      pisCofinsRate: this.normalizeRate(this.parameters.pisCofinsRate),
    };
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatPercent(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
  }

  private normalizeRate(value: number): number {
    const safeValue = this.safeNumber(value);
    return safeValue > 1 ? safeValue / 100 : safeValue;
  }

  private safeNumber(value: number): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }
}
