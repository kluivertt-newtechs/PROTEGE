import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  PoRadioGroupOption,
  PoSelectOption,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  CommercialParameters,
  PricingResult,
  PricingSimulation,
  cpeReferences,
  pricingBases,
  processingCosts,
  vehicleCosts,
} from 'src/app/core/mock';
import { PricingMockStateService } from 'src/app/core/pricing-mock-state.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

type OperationMode = PricingSimulation['operationMode'];
type TableItem = Record<string, string | number>;

interface CostCorrectionOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-simulation',
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class SimulationComponent implements OnInit {
  readonly bases = pricingBases;
  readonly vehicleCosts = vehicleCosts;
  readonly cpeReferences = cpeReferences;
  readonly processingCosts = processingCosts;

  parameters: CommercialParameters;
  simulation: PricingSimulation;
  result: PricingResult = this.emptyResult();

  baseOptions: Array<PoSelectOption> = this.bases.map((base) => ({
    label: `${base.name} (${base.uf})`,
    value: base.id,
  }));
  vehicleOptions: Array<PoSelectOption> = [];
  processingTypeOptions: Array<PoSelectOption> = [];
  processingItems: Array<TableItem> = [];

  private readonly cpeCostCorrectionOptions: Array<CostCorrectionOption> = [
    { label: 'Custo de referência CPE', value: 'cpeReference' },
    { label: 'Pedágio/estadia/outros', value: 'otherCosts' },
  ];

  private readonly sopCostCorrectionOptions: Array<CostCorrectionOption> = [
    { label: 'Horas normais', value: 'sopNormalHours' },
    { label: 'Horas extra 50%', value: 'sopOvertime50Hours' },
    { label: 'Horas extra 100%', value: 'sopOvertime100Hours' },
    { label: 'Custo fixo veículo/hora', value: 'sopFixedVehicleHour' },
    { label: 'Custo variável por KM', value: 'sopVariableKm' },
    { label: 'Pedágio/estadia/outros', value: 'otherCosts' },
  ];

  private readonly processingCostCorrectionOptions: Array<CostCorrectionOption> = [
    { label: 'Custo padrão por milheiro', value: 'processingCostPerThousand' },
  ];

  costOriginOptions: Array<PoRadioGroupOption> = [
    { label: 'Custo por esforço (CPE)', value: 'CPE' },
    { label: 'Condição operacional (SOP)', value: 'SOP' },
  ];

  taxOperationOptions: Array<PoSelectOption> = [
    { label: 'Urbano (ISS)', value: 'URBAN' },
    { label: 'Interurbano (ICMS UF)', value: 'INTERURBAN' },
    { label: 'Interestadual (ICMS origem/destino)', value: 'INTERSTATE' },
  ];

  pointTypeOptions: Array<PoSelectOption> = [
    { label: 'Embarque', value: 'Embarque' },
    { label: 'Abastecimento', value: 'Abastecimento' },
    { label: 'Técnica', value: 'Técnica' },
    { label: 'Ponta a ponta', value: 'Ponta a ponta' },
  ];

  routeTypeOptions: Array<PoSelectOption> = [
    { label: 'Semanal', value: 'Semanal' },
    { label: 'Sábado', value: 'Sábado' },
    { label: 'Domingo', value: 'Domingo' },
  ];

  ufOptions: Array<PoSelectOption> = ['AC', 'MG', 'MT', 'RJ', 'RO', 'RS', 'SP'].map((uf) => ({
    label: uf,
    value: uf,
  }));

  processingColumns: Array<PoTableColumn> = [
    { property: 'type', label: 'Tipo' },
    { property: 'base', label: 'Base' },
    { property: 'costPerThousand', label: 'Custo/milheiro' },
    { property: 'issRate', label: 'ISS' },
  ];

  constructor(private readonly mockState: PricingMockStateService) {
    this.parameters = this.mockState.getCommercialParameters();
    this.simulation = this.mockState.getLastSimulation();
  }

  ngOnInit(): void {
    this.refreshBaseDependentOptions();
    this.recalculate();
  }

  get monthlyLabel(): string {
    return this.simulation.operationMode === 'processing' ? 'volume mensal' : 'atendimentos/mês';
  }

  get costCorrectionOptions(): Array<CostCorrectionOption> {
    if (this.simulation.operationMode === 'processing') {
      return this.processingCostCorrectionOptions;
    }

    return this.simulation.transportCostOrigin === 'CPE'
      ? this.cpeCostCorrectionOptions
      : this.sopCostCorrectionOptions;
  }

  setOperationMode(operationMode: OperationMode): void {
    if (this.simulation.operationMode === operationMode) {
      return;
    }

    this.simulation.operationMode = operationMode;
    this.syncCostCorrectionTargets();
    this.onBaseChange();
  }

  onBaseChange(): void {
    this.refreshBaseDependentOptions();

    const availableVehicle = this.vehicleOptions[0]?.value;
    const availableProcessingType = this.processingTypeOptions[0]?.value;

    if (availableVehicle && !this.vehicleOptions.some((option) => option.value === this.simulation.vehicle)) {
      this.simulation.vehicle = String(availableVehicle);
    }

    if (
      availableProcessingType &&
      !this.processingTypeOptions.some((option) => option.value === this.simulation.processingType)
    ) {
      this.simulation.processingType = String(availableProcessingType);
    }

    this.recalculate();
  }

  recalculate(): void {
    this.parameters = this.mockState.getCommercialParameters();
    this.result = this.mockState.updateSimulation(this.simulation);
  }

  onTransportCostOriginChange(transportCostOrigin: PricingSimulation['transportCostOrigin']): void {
    this.simulation.transportCostOrigin = transportCostOrigin;
    this.syncCostCorrectionTargets();
    this.recalculate();
  }

  onCostCorrectionEnabledChange(enabled: boolean): void {
    this.simulation.costCorrectionEnabled = enabled;
    this.syncCostCorrectionTargets(true);
    this.recalculate();
  }

  onCostCorrectionTargetChange(target: string, selected: boolean): void {
    const targets = new Set(this.simulation.costCorrectionTargets);

    if (selected) {
      targets.add(target);
    } else {
      targets.delete(target);
    }

    this.simulation.costCorrectionTargets = [...targets];
    this.recalculate();
  }

  isCostCorrectionTargetSelected(target: string): boolean {
    return this.simulation.costCorrectionTargets.includes(target);
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatPercent(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
  }

  private buildVehicleOptions(): Array<PoSelectOption> {
    const vehicles = this.vehicleCosts
      .filter((cost) => cost.baseId === this.simulation.baseId)
      .map((cost) => cost.vehicle);

    return [...new Set(vehicles)].map((vehicle) => ({ label: vehicle, value: vehicle }));
  }

  private buildProcessingTypeOptions(): Array<PoSelectOption> {
    const types = this.processingCosts
      .filter((cost) => cost.baseId === this.simulation.baseId)
      .map((cost) => cost.type);

    return [...new Set(types)].map((type) => ({ label: type, value: type }));
  }

  private buildProcessingItems(): Array<TableItem> {
    return this.processingCosts
      .filter((cost) => cost.baseId === this.simulation.baseId)
      .map((cost) => ({
        type: cost.type,
        base: this.bases.find((base) => base.id === cost.baseId)?.name ?? cost.baseId,
        costPerThousand: this.formatCurrency(cost.costPerThousand),
        issRate: this.formatPercent(cost.issRate),
      }));
  }

  private refreshBaseDependentOptions(): void {
    this.vehicleOptions = this.buildVehicleOptions();
    this.processingTypeOptions = this.buildProcessingTypeOptions();
    this.processingItems = this.buildProcessingItems();
  }

  private syncCostCorrectionTargets(forceSelectAll = false): void {
    if (!this.simulation.costCorrectionEnabled) {
      return;
    }

    const availableTargets = this.costCorrectionOptions.map((option) => option.value);
    const availableTargetSet = new Set(availableTargets);
    const currentTargets = this.simulation.costCorrectionTargets;
    const selectedAvailableTargets = currentTargets.filter((target) => availableTargetSet.has(target));
    const hasUnavailableTargets = currentTargets.some((target) => !availableTargetSet.has(target));

    this.simulation.costCorrectionTargets =
      forceSelectAll || hasUnavailableTargets || selectedAvailableTargets.length === 0
        ? availableTargets
        : selectedAvailableTargets;
  }

  private emptyResult(): PricingResult {
    return {
      costTotal: 0,
      operationalExpenses: 0,
      indirectExpenses: 0,
      margin: 0,
      netPrice: 0,
      taxRate: 0,
      taxes: 0,
      finalPrice: 0,
      monthlyPrice: 0,
      ebitdaRate: 0,
    };
  }
}
