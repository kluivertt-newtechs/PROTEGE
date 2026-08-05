import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import {
  PoModalComponent,
  PoSelectOption,
  PoTableAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  CommercialParameters,
  ProcessingCost,
  VehicleCost,
  pricingBases,
} from 'src/app/core/mock';
import { PricingMockStateService } from 'src/app/core/pricing-mock-state.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

type TableItem = Record<string, string | number>;
type EditableNumber = number | string;

interface VehicleCostEditModel {
  baseId: string;
  vehicle: string;
  normalHour: EditableNumber;
  overtime50: EditableNumber;
  overtime100: EditableNumber;
  fixedCostPerHour: EditableNumber;
  variableCostPerKm: EditableNumber;
  issRate: EditableNumber;
  icmsRate: EditableNumber;
}

interface ProcessingCostEditModel {
  baseId: string;
  type: string;
  costPerThousand: EditableNumber;
  issRate: EditableNumber;
}

@Component({
  selector: 'app-pricing',
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class PricingComponent {
  @ViewChild('costEditModal') costEditModal!: PoModalComponent;

  readonly bases = pricingBases;

  parameters: CommercialParameters;
  selectedBaseId = this.bases[0]?.id ?? '';
  baseOptions: Array<PoSelectOption> = this.bases.map((base) => ({
    label: `${base.name} (${base.uf})`,
    value: base.id,
  }));
  costItems: Array<TableItem> = [];
  processingItems: Array<TableItem> = [];
  editMode: 'vehicle' | 'processing' = 'vehicle';
  vehicleEditModel?: VehicleCostEditModel;
  processingEditModel?: ProcessingCostEditModel;

  readonly costActions: Array<PoTableAction> = [
    {
      label: '',
      icon: 'an an-pencil-simple',
      action: (item: TableItem) => this.editVehicleCost(item),
    },
  ];

  readonly processingActions: Array<PoTableAction> = [
    {
      label: '',
      icon: 'an an-pencil-simple',
      action: (item: TableItem) => this.editProcessingCost(item),
    },
  ];
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

  constructor(private readonly mockState: PricingMockStateService) {
    this.parameters = this.mockState.getCommercialParameters();
    this.costItems = this.buildCostItems();
    this.processingItems = this.buildProcessingItems();
  }

  get selectedBase() {
    return this.bases.find((base) => base.id === this.selectedBaseId) ?? this.bases[0];
  }

  onBaseChange(baseId: string): void {
    this.selectedBaseId = baseId;
    this.costItems = this.buildCostItems();
  }

  private buildCostItems(): Array<TableItem> {
    return this.mockState
      .getVehicleCosts()
      .filter((cost) => cost.baseId === this.selectedBaseId)
      .map((cost) => ({
        baseId: cost.baseId,
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

  private buildProcessingItems(): Array<TableItem> {
    return this.mockState.getProcessingCosts().map((cost) => ({
      baseId: cost.baseId,
      type: cost.type,
      base: this.getBaseName(cost.baseId),
      costPerThousand: this.formatCurrency(cost.costPerThousand),
      issRate: this.formatPercent(cost.issRate),
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
    this.mockState.updateCommercialParameters(this.parameters);
    this.parameters = this.mockState.getCommercialParameters();
    this.mockState.saveCommercialParameters();
    this.syncStatus = 'Parâmetros comerciais salvos localmente.';
  }

  onParameterChange(): void {
    this.mockState.updateCommercialParameters(this.parameters);
    this.parameters = this.mockState.getCommercialParameters();
  }

  editVehicleCost(item: TableItem): void {
    const cost = this.mockState
      .getVehicleCosts()
      .find(
        (vehicleCost) =>
          vehicleCost.baseId === item['baseId'] && vehicleCost.vehicle === item['vehicle'],
      );

    if (!cost) {
      return;
    }

    this.editMode = 'vehicle';
    this.vehicleEditModel = { ...cost };
    this.processingEditModel = undefined;
    this.costEditModal.open();
  }

  editProcessingCost(item: TableItem): void {
    const cost = this.mockState
      .getProcessingCosts()
      .find(
        (processingCost) =>
          processingCost.baseId === item['baseId'] && processingCost.type === item['type'],
      );

    if (!cost) {
      return;
    }

    this.editMode = 'processing';
    this.processingEditModel = { ...cost };
    this.vehicleEditModel = undefined;
    this.costEditModal.open();
  }

  saveCostEdit(): void {
    if (this.editMode === 'vehicle' && this.vehicleEditModel) {
      this.mockState.updateVehicleCost(this.normalizeVehicleCost(this.vehicleEditModel));
      this.costItems = this.buildCostItems();
    }

    if (this.editMode === 'processing' && this.processingEditModel) {
      this.mockState.updateProcessingCost(this.normalizeProcessingCost(this.processingEditModel));
      this.processingItems = this.buildProcessingItems();
    }

    this.syncStatus = 'Custos salvos localmente.';
    this.costEditModal.close();
  }

  cancelCostEdit(): void {
    this.costEditModal.close();
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatPercent(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
  }

  getBaseName(baseId: string): string {
    return this.bases.find((base) => base.id === baseId)?.name ?? baseId;
  }

  private normalizeVehicleCost(cost: VehicleCostEditModel): VehicleCost {
    return {
      baseId: cost.baseId,
      vehicle: cost.vehicle,
      normalHour: this.safeNumber(cost.normalHour),
      overtime50: this.safeNumber(cost.overtime50),
      overtime100: this.safeNumber(cost.overtime100),
      fixedCostPerHour: this.safeNumber(cost.fixedCostPerHour),
      variableCostPerKm: this.safeNumber(cost.variableCostPerKm),
      issRate: this.normalizeRate(cost.issRate),
      icmsRate: this.normalizeRate(cost.icmsRate),
    };
  }

  private normalizeProcessingCost(cost: ProcessingCostEditModel): ProcessingCost {
    return {
      baseId: cost.baseId,
      type: cost.type,
      costPerThousand: this.safeNumber(cost.costPerThousand),
      issRate: this.normalizeRate(cost.issRate),
    };
  }

  private normalizeRate(value: EditableNumber): number {
    const safeValue = this.safeNumber(value);
    return safeValue > 1 ? safeValue / 100 : safeValue;
  }

  private safeNumber(value: EditableNumber): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }
}
