import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { PoRadioGroupOption } from '@po-ui/ng-components';
import {
  CommercialParameters,
  ConsolidatedParameters,
  ConsolidatedResult,
  PricingSimulation,
  commercialParametersMock,
} from 'src/app/core/mock';
import { PricingMockStateService } from 'src/app/core/pricing-mock-state.service';
import { calculateConsolidatedResult } from 'src/app/core/pricing-calculator';
import { SHARED_MODULES } from 'src/app/shared/shared';

interface DreRow {
  label: string;
  value: number;
  detail?: string;
  total?: boolean;
  negative?: boolean;
}

@Component({
  selector: 'app-consolidated',
  templateUrl: './consolidated.component.html',
  styleUrls: ['./consolidated.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class ConsolidatedComponent implements OnInit {
  commercialParameters: CommercialParameters;
  simulation: PricingSimulation;
  parameters: ConsolidatedParameters = {
    targetMarginRate: commercialParametersMock.targetMarginRate,
    issIcmsIncluded: false,
    adValoremRate: 0,
    custodyRate: 0,
    financialVolume: 250000,
  };

  result: ConsolidatedResult;
  dreRows: Array<DreRow> = [];

  issIcmsOptions: Array<PoRadioGroupOption> = [
    { label: 'Nao', value: 'false' },
    { label: 'Sim', value: 'true' },
  ];

  constructor(private readonly mockState: PricingMockStateService) {
    this.commercialParameters = this.mockState.getCommercialParameters();
    this.simulation = this.mockState.getLastSimulation();
    this.parameters.targetMarginRate = this.commercialParameters.targetMarginRate;
    this.result = calculateConsolidatedResult(
      this.simulation,
      this.parameters,
      this.commercialParameters,
    );
  }

  ngOnInit(): void {
    this.recalculate();
  }

  recalculate(): void {
    this.commercialParameters = this.mockState.getCommercialParameters();
    this.simulation = this.mockState.getLastSimulation();
    this.parameters = {
      targetMarginRate: this.normalizeRate(this.parameters.targetMarginRate),
      issIcmsIncluded: Boolean(this.parameters.issIcmsIncluded),
      adValoremRate: this.normalizeRate(this.parameters.adValoremRate),
      custodyRate: this.normalizeRate(this.parameters.custodyRate),
      financialVolume: this.safeNumber(this.parameters.financialVolume),
    };
    this.result = calculateConsolidatedResult(
      this.simulation,
      this.parameters,
      this.commercialParameters,
    );
    this.dreRows = this.buildDreRows();
  }

  setIssIcmsIncluded(value: string | number): void {
    this.parameters.issIcmsIncluded = value === 'true';
    this.recalculate();
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatPercent(value: number): string {
    return value.toLocaleString('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private buildDreRows(): Array<DreRow> {
    return [
      { label: 'Receita bruta', value: this.result.grossRevenue },
      {
        label: this.parameters.issIcmsIncluded ? 'Preco antes de ISS/ICMS' : 'Base tributada',
        value: this.result.adjustedGrossRevenue,
        detail: this.parameters.issIcmsIncluded ? this.formatPercent(this.result.mainTaxRate) : undefined,
      },
      {
        label: 'PIS/COFINS',
        value: this.result.pisCofins,
        detail: this.formatPercent(this.result.pisCofinsRate),
        negative: true,
      },
      {
        label: 'ISS/ICMS',
        value: this.result.issIcms,
        detail: this.formatPercent(this.result.mainTaxRate),
        negative: true,
      },
      { label: 'Receita liquida', value: this.result.netRevenue, total: true },
      { label: 'Custos diretos', value: this.result.directCosts, negative: true },
      { label: 'Despesas operacionais', value: this.result.operationalExpenses, negative: true },
      { label: 'Despesas indiretas', value: this.result.indirectExpenses, negative: true },
      {
        label: 'Ad valorem',
        value: this.result.adValorem,
        detail: this.formatPercent(this.parameters.adValoremRate),
        negative: true,
      },
      {
        label: 'Custodia',
        value: this.result.custody,
        detail: this.formatPercent(this.parameters.custodyRate),
        negative: true,
      },
      {
        label: 'EBITDA',
        value: this.result.ebitda,
        detail: this.formatPercent(this.result.ebitdaRate),
        total: true,
      },
    ];
  }

  private normalizeRate(value: number): number {
    const safeValue = this.safeNumber(value);
    return safeValue > 1 ? safeValue / 100 : safeValue;
  }

  private safeNumber(value: number): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }
}
