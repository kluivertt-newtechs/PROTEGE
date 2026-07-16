import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  PoRadioGroupOption,
  PoSelectOption,
  PoTableColumn,
} from '@po-ui/ng-components';
import {
  PricingResult,
  PricingSimulation,
  cpeReferences,
  commercialParametersMock,
  initialPricingSimulation,
  interstateTaxRates,
  pricingBases,
  processingCosts,
  vehicleCosts,
} from 'src/app/core/mock';
import { SHARED_MODULES } from 'src/app/shared/shared';

type OperationMode = PricingSimulation['operationMode'];
type TableItem = Record<string, string | number>;

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
  readonly parameters = { ...commercialParametersMock };

  simulation: PricingSimulation = { ...initialPricingSimulation };
  result: PricingResult = this.emptyResult();
  baseOptions: Array<PoSelectOption> = this.bases.map((base) => ({
    label: `${base.name} (${base.uf})`,
    value: base.id,
  }));
  vehicleOptions: Array<PoSelectOption> = [];
  processingTypeOptions: Array<PoSelectOption> = [];
  processingItems: Array<TableItem> = [];

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

  ngOnInit(): void {
    this.refreshBaseDependentOptions();
    this.recalculate();
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

  get monthlyLabel(): string {
    return this.simulation.operationMode === 'processing' ? 'volume mensal' : 'atendimentos/mês';
  }

  setOperationMode(operationMode: OperationMode): void {
    if (this.simulation.operationMode === operationMode) {
      return;
    }

    this.simulation.operationMode = operationMode;
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
    const costTotal =
      this.simulation.operationMode === 'processing'
        ? this.calculateProcessingCost()
        : this.calculateTransportCost();

    const commercialLoad =
      this.parameters.operationalExpensesRate +
      this.parameters.indirectExpensesRate +
      this.parameters.targetMarginRate;
    const denominator = Math.max(0.01, 1 - commercialLoad);
    const netPrice = costTotal / denominator;
    const taxRate = this.resolveTaxRate();
    const finalPrice = netPrice / Math.max(0.01, 1 - taxRate);
    const quantity =
      this.simulation.operationMode === 'processing'
        ? Math.max(0, this.simulation.thousandsVolume)
        : Math.max(0, this.simulation.quantity);

    this.result = {
      costTotal,
      operationalExpenses: netPrice * this.parameters.operationalExpensesRate,
      indirectExpenses: netPrice * this.parameters.indirectExpensesRate,
      margin: netPrice * this.parameters.targetMarginRate,
      netPrice,
      taxRate,
      taxes: finalPrice - netPrice,
      finalPrice,
      monthlyPrice: finalPrice * quantity,
      ebitdaRate: this.parameters.targetMarginRate,
      warning: this.resolveWarning(costTotal),
    };
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatPercent(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
  }

  private calculateTransportCost(): number {
    if (this.simulation.transportCostOrigin === 'CPE') {
      const reference = this.findCpeReference();
      return (reference?.cost ?? 0) + this.safeNumber(this.simulation.otherCosts);
    }

    const vehicleCost = this.findVehicleCost();
    if (!vehicleCost) {
      return this.safeNumber(this.simulation.otherCosts);
    }

    return (
      this.safeNumber(this.simulation.normalHours) * vehicleCost.normalHour +
      this.safeNumber(this.simulation.overtime50Hours) * vehicleCost.overtime50 +
      this.safeNumber(this.simulation.overtime100Hours) * vehicleCost.overtime100 +
      this.safeNumber(this.simulation.normalHours) * vehicleCost.fixedCostPerHour +
      this.safeNumber(this.simulation.km) * vehicleCost.variableCostPerKm +
      this.safeNumber(this.simulation.otherCosts)
    );
  }

  private calculateProcessingCost(): number {
    const processingCost = this.processingCosts.find(
      (cost) => cost.baseId === this.simulation.baseId && cost.type === this.simulation.processingType,
    );

    return processingCost?.costPerThousand ?? 0;
  }

  private findCpeReference() {
    return this.cpeReferences.find(
      (reference) =>
        reference.baseId === this.simulation.baseId &&
        this.normalizeText(reference.city) === this.normalizeText(this.simulation.city) &&
        reference.uf === this.simulation.uf &&
        reference.routeType === this.simulation.routeType &&
        reference.vehicle === this.simulation.vehicle &&
        reference.pointType === this.simulation.pointType,
    );
  }

  private findVehicleCost() {
    return this.vehicleCosts.find(
      (cost) => cost.baseId === this.simulation.baseId && cost.vehicle === this.simulation.vehicle,
    );
  }

  private resolveTaxRate(): number {
    if (this.simulation.operationMode === 'processing') {
      const processingCost = this.processingCosts.find(
        (cost) => cost.baseId === this.simulation.baseId && cost.type === this.simulation.processingType,
      );
      return this.parameters.pisCofinsRate + (processingCost?.issRate ?? 0);
    }

    const vehicleCost = this.findVehicleCost();

    if (this.simulation.taxOperation === 'URBAN') {
      return this.parameters.pisCofinsRate + (vehicleCost?.issRate ?? 0);
    }

    if (this.simulation.taxOperation === 'INTERSTATE') {
      const interstateRate =
        interstateTaxRates.find(
          (rate) =>
            rate.originUf === this.simulation.uf && rate.destinationUf === this.simulation.destinationUf,
        )?.rate ?? 0.12;

      return this.parameters.pisCofinsRate + interstateRate;
    }

    return this.parameters.pisCofinsRate + (vehicleCost?.icmsRate ?? 0);
  }

  private resolveWarning(costTotal: number): string | undefined {
    if (this.simulation.operationMode === 'transport' && this.simulation.transportCostOrigin === 'CPE' && costTotal === 0) {
      return 'Não há referência CPE para a combinação informada. O custo foi zerado para sinalizar cadastro pendente.';
    }

    if (this.simulation.operationMode === 'processing' && costTotal === 0) {
      return 'Não há custo de processamento cadastrado para a base e tipo selecionados.';
    }

    return undefined;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private safeNumber(value: number): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
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
