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
  commercialParametersMock,
  initialPricingSimulation,
  interstateTaxRates,
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
export class PricingComponent implements OnInit {
  readonly bases = pricingBases;
  readonly vehicleCosts = vehicleCosts;
  readonly cpeReferences = cpeReferences;
  readonly processingCosts = processingCosts;

  parameters: CommercialParameters = { ...commercialParametersMock };
  simulation: PricingSimulation = { ...initialPricingSimulation };
  selectedBaseId = initialPricingSimulation.baseId;
  syncStatus = 'Último sync: hoje, 08:14 - CD0704 / PD4000 / FT4001';
  result: PricingResult = this.emptyResult();

  operationOptions: Array<PoRadioGroupOption> = [
    { label: 'Transporte de valores', value: 'transport' },
    { label: 'Processamento', value: 'processing' },
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
    { label: 'Técnica', value: 'Tecnica' },
    { label: 'Ponta a ponta', value: 'Ponta a ponta' },
  ];

  routeTypeOptions: Array<PoSelectOption> = [
    { label: 'Semanal', value: 'Semanal' },
    { label: 'Sábado', value: 'Sabado' },
    { label: 'Domingo', value: 'Domingo' },
  ];

  ufOptions: Array<PoSelectOption> = ['AC', 'MG', 'MT', 'RJ', 'RO', 'RS', 'SP'].map((uf) => ({
    label: uf,
    value: uf,
  }));

  costColumns: Array<PoTableColumn> = [
    { property: 'vehicle', label: 'Veículo' },
    { property: 'normalHour', label: 'Hora normal' },
    { property: 'overtime50', label: 'HE 50%' },
    { property: 'overtime100', label: 'HE 100%' },
    { property: 'fixedCostPerHour', label: 'Fixo veíc./h' },
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

  ngOnInit(): void {
    this.recalculate();
  }

  get baseOptions(): Array<PoSelectOption> {
    return this.bases.map((base) => ({ label: `${base.name} (${base.uf})`, value: base.id }));
  }

  get vehicleOptions(): Array<PoSelectOption> {
    const vehicles = this.vehicleCosts
      .filter((cost) => cost.baseId === this.simulation.baseId)
      .map((cost) => cost.vehicle);

    return [...new Set(vehicles)].map((vehicle) => ({ label: vehicle, value: vehicle }));
  }

  get processingTypeOptions(): Array<PoSelectOption> {
    const types = this.processingCosts
      .filter((cost) => cost.baseId === this.simulation.baseId)
      .map((cost) => cost.type);

    return [...new Set(types)].map((type) => ({ label: type, value: type }));
  }

  get selectedBase() {
    return this.bases.find((base) => base.id === this.selectedBaseId) ?? this.bases[0];
  }

  get simulationBase() {
    return this.bases.find((base) => base.id === this.simulation.baseId) ?? this.bases[0];
  }

  get costItems(): Array<TableItem> {
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

  get processingItems(): Array<TableItem> {
    return this.processingCosts.map((cost) => ({
      type: cost.type,
      base: this.bases.find((base) => base.id === cost.baseId)?.name ?? cost.baseId,
      costPerThousand: this.formatCurrency(cost.costPerThousand),
      issRate: this.formatPercent(cost.issRate),
    }));
  }

  get monthlyLabel(): string {
    return this.simulation.operationMode === 'processing' ? 'volume mensal' : 'atendimentos/mês';
  }

  synchronizeErp(): void {
    const now = new Date();
    this.syncStatus = `Último sync: ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })} - CD0704 / PD4000 / FT4001`;
  }

  saveParameters(): void {
    this.recalculate();
    this.syncStatus = 'Parâmetros comerciais salvos localmente e aplicados na simulação.';
  }

  onParameterChange(): void {
    this.parameters = {
      operationalExpensesRate: this.normalizeRate(this.parameters.operationalExpensesRate),
      indirectExpensesRate: this.normalizeRate(this.parameters.indirectExpensesRate),
      targetMarginRate: this.normalizeRate(this.parameters.targetMarginRate),
      pisCofinsRate: this.normalizeRate(this.parameters.pisCofinsRate),
    };
    this.recalculate();
  }

  onBaseChange(): void {
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
        reference.city === this.normalizeText(this.simulation.city) &&
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

  private normalizeRate(value: number): number {
    const safeValue = this.safeNumber(value);
    return safeValue > 1 ? safeValue / 100 : safeValue;
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
