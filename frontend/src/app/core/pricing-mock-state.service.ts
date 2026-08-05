import { Injectable } from '@angular/core';
import {
  CommercialParameters,
  PricingResult,
  PricingSimulation,
  ProcessingCost,
  VehicleCost,
  commercialParametersMock,
  initialPricingSimulation,
  processingCosts,
  vehicleCosts,
} from './mock';
import { calculatePricingResult } from './pricing-calculator';

const COMMERCIAL_PARAMETERS_KEY = 'protege.pricing.commercialParameters';
const LAST_SIMULATION_KEY = 'protege.pricing.lastSimulation';
const VEHICLE_COSTS_KEY = 'protege.pricing.vehicleCosts';
const PROCESSING_COSTS_KEY = 'protege.pricing.processingCosts';

@Injectable({ providedIn: 'root' })
export class PricingMockStateService {
  private commercialParameters: CommercialParameters = this.loadCommercialParameters();
  private vehicleCostCatalog: Array<VehicleCost> = this.loadVehicleCosts();
  private processingCostCatalog: Array<ProcessingCost> = this.loadProcessingCosts();
  private simulation: PricingSimulation = this.loadSimulation();
  private result: PricingResult = calculatePricingResult(
    this.simulation,
    this.commercialParameters,
    this.getCostCatalogs(),
  );

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

  getVehicleCosts(): Array<VehicleCost> {
    return this.vehicleCostCatalog.map((cost) => ({ ...cost }));
  }

  getProcessingCosts(): Array<ProcessingCost> {
    return this.processingCostCatalog.map((cost) => ({ ...cost }));
  }

  updateVehicleCost(updatedCost: VehicleCost): PricingResult {
    const normalizedCost = this.normalizeVehicleCost(updatedCost);

    this.vehicleCostCatalog = this.vehicleCostCatalog.map((cost) =>
      cost.baseId === normalizedCost.baseId && cost.vehicle === normalizedCost.vehicle
        ? normalizedCost
        : cost,
    );
    this.writeStorage(VEHICLE_COSTS_KEY, this.vehicleCostCatalog);

    return this.recalculate();
  }

  updateProcessingCost(updatedCost: ProcessingCost): PricingResult {
    const normalizedCost = this.normalizeProcessingCost(updatedCost);

    this.processingCostCatalog = this.processingCostCatalog.map((cost) =>
      cost.baseId === normalizedCost.baseId && cost.type === normalizedCost.type
        ? normalizedCost
        : cost,
    );
    this.writeStorage(PROCESSING_COSTS_KEY, this.processingCostCatalog);

    return this.recalculate();
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
    this.vehicleCostCatalog = this.cloneVehicleCosts(vehicleCosts);
    this.processingCostCatalog = this.cloneProcessingCosts(processingCosts);
    this.removeStorage(COMMERCIAL_PARAMETERS_KEY);
    this.removeStorage(LAST_SIMULATION_KEY);
    this.removeStorage(VEHICLE_COSTS_KEY);
    this.removeStorage(PROCESSING_COSTS_KEY);
    return this.recalculate();
  }

  private recalculate(): PricingResult {
    this.result = calculatePricingResult(
      this.simulation,
      this.commercialParameters,
      this.getCostCatalogs(),
    );
    return { ...this.result };
  }

  private getCostCatalogs() {
    return {
      vehicleCosts: this.vehicleCostCatalog,
      processingCosts: this.processingCostCatalog,
    };
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

  private loadVehicleCosts(): Array<VehicleCost> {
    const storedCosts = this.readStorage<Array<VehicleCost>>(VEHICLE_COSTS_KEY);
    const sourceCosts = Array.isArray(storedCosts) ? storedCosts : vehicleCosts;

    return sourceCosts.map((cost) => this.normalizeVehicleCost(cost));
  }

  private loadProcessingCosts(): Array<ProcessingCost> {
    const storedCosts = this.readStorage<Array<ProcessingCost>>(PROCESSING_COSTS_KEY);
    const sourceCosts = Array.isArray(storedCosts) ? storedCosts : processingCosts;

    return sourceCosts.map((cost) => this.normalizeProcessingCost(cost));
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

  private normalizeVehicleCost(cost: VehicleCost): VehicleCost {
    return {
      baseId: String(cost.baseId),
      vehicle: String(cost.vehicle),
      normalHour: this.safeNumber(cost.normalHour),
      overtime50: this.safeNumber(cost.overtime50),
      overtime100: this.safeNumber(cost.overtime100),
      fixedCostPerHour: this.safeNumber(cost.fixedCostPerHour),
      variableCostPerKm: this.safeNumber(cost.variableCostPerKm),
      issRate: this.normalizeRate(cost.issRate),
      icmsRate: this.normalizeRate(cost.icmsRate),
    };
  }

  private normalizeProcessingCost(cost: ProcessingCost): ProcessingCost {
    return {
      baseId: String(cost.baseId),
      type: String(cost.type),
      costPerThousand: this.safeNumber(cost.costPerThousand),
      issRate: this.normalizeRate(cost.issRate),
    };
  }

  private cloneVehicleCosts(costs: Array<VehicleCost>): Array<VehicleCost> {
    return costs.map((cost) => ({ ...cost }));
  }

  private cloneProcessingCosts(costs: Array<ProcessingCost>): Array<ProcessingCost> {
    return costs.map((cost) => ({ ...cost }));
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
