import { Injectable } from '@angular/core';
import {
  CommercialParameters,
  PricingResult,
  PricingSimulation,
  commercialParametersMock,
  initialPricingSimulation,
} from './mock';
import { calculatePricingResult } from './pricing-calculator';

const COMMERCIAL_PARAMETERS_KEY = 'protege.pricing.commercialParameters';
const LAST_SIMULATION_KEY = 'protege.pricing.lastSimulation';

@Injectable({ providedIn: 'root' })
export class PricingMockStateService {
  private commercialParameters: CommercialParameters = this.loadCommercialParameters();
  private simulation: PricingSimulation = this.loadSimulation();
  private result: PricingResult = calculatePricingResult(this.simulation, this.commercialParameters);

  getCommercialParameters(): CommercialParameters {
    return { ...this.commercialParameters };
  }

  updateCommercialParameters(parameters: CommercialParameters): PricingResult {
    this.commercialParameters = this.normalizeCommercialParameters(parameters);
    return this.recalculate();
  }

  saveCommercialParameters(): void {
    this.writeStorage(COMMERCIAL_PARAMETERS_KEY, this.commercialParameters);
  }

  getLastSimulation(): PricingSimulation {
    return {
      ...this.simulation,
      costCorrectionTargets: [...this.simulation.costCorrectionTargets],
    };
  }

  updateSimulation(simulation: PricingSimulation): PricingResult {
    this.simulation = this.normalizeSimulation(simulation);
    const result = this.recalculate();
    this.writeStorage(LAST_SIMULATION_KEY, this.simulation);
    return result;
  }

  getCurrentResult(): PricingResult {
    return { ...this.result };
  }

  resetMocks(): PricingResult {
    this.commercialParameters = { ...commercialParametersMock };
    this.simulation = {
      ...initialPricingSimulation,
      costCorrectionTargets: [...initialPricingSimulation.costCorrectionTargets],
    };
    this.removeStorage(COMMERCIAL_PARAMETERS_KEY);
    this.removeStorage(LAST_SIMULATION_KEY);
    return this.recalculate();
  }

  private recalculate(): PricingResult {
    this.result = calculatePricingResult(this.simulation, this.commercialParameters);
    return { ...this.result };
  }

  private loadCommercialParameters(): CommercialParameters {
    return this.normalizeCommercialParameters(
      this.readStorage<CommercialParameters>(COMMERCIAL_PARAMETERS_KEY) ?? commercialParametersMock,
    );
  }

  private loadSimulation(): PricingSimulation {
    return this.normalizeSimulation(
      this.readStorage<PricingSimulation>(LAST_SIMULATION_KEY) ?? initialPricingSimulation,
    );
  }

  private normalizeCommercialParameters(parameters: CommercialParameters): CommercialParameters {
    return {
      operationalExpensesRate: this.normalizeRate(parameters.operationalExpensesRate),
      indirectExpensesRate: this.normalizeRate(parameters.indirectExpensesRate),
      targetMarginRate: this.normalizeRate(parameters.targetMarginRate),
      pisCofinsRate: this.normalizeRate(parameters.pisCofinsRate),
    };
  }

  private normalizeSimulation(simulation: PricingSimulation): PricingSimulation {
    const costCorrectionTargets = Array.isArray(simulation.costCorrectionTargets)
      ? simulation.costCorrectionTargets.map((target) => String(target))
      : [];

    return {
      ...initialPricingSimulation,
      ...simulation,
      quantity: this.safeNumber(simulation.quantity),
      otherCosts: this.safeNumber(simulation.otherCosts),
      km: this.safeNumber(simulation.km),
      normalHours: this.safeNumber(simulation.normalHours),
      overtime50Hours: this.safeNumber(simulation.overtime50Hours),
      overtime100Hours: this.safeNumber(simulation.overtime100Hours),
      thousandsVolume: this.safeNumber(simulation.thousandsVolume),
      costCorrectionEnabled: simulation.costCorrectionEnabled === true,
      costCorrectionRate: this.normalizeRate(simulation.costCorrectionRate),
      costCorrectionTargets,
    };
  }

  private readStorage<T>(key: string): T | undefined {
    if (!this.canUseStorage()) {
      return undefined;
    }

    const value = localStorage.getItem(key);
    if (!value) {
      return undefined;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      this.removeStorage(key);
      return undefined;
    }
  }

  private writeStorage<T>(key: string, value: T): void {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  }

  private removeStorage(key: string): void {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.removeItem(key);
  }

  private canUseStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }

  private normalizeRate(value: number): number {
    const safeValue = this.safeNumber(value);
    return safeValue > 1 ? safeValue / 100 : safeValue;
  }

  private safeNumber(value: number): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }
}
