import {
  CommercialParameters,
  ConsolidatedParameters,
  ConsolidatedResult,
  PricingResult,
  PricingSimulation,
  cpeReferences,
  commercialParametersMock,
  initialPricingSimulation,
  interstateTaxRates,
  pricingBases,
  processingCosts,
  vehicleCosts,
} from './mock';

const CORRECTION_TARGETS = {
  cpeReference: 'cpeReference',
  otherCosts: 'otherCosts',
  sopNormalHours: 'sopNormalHours',
  sopOvertime50Hours: 'sopOvertime50Hours',
  sopOvertime100Hours: 'sopOvertime100Hours',
  sopFixedVehicleHour: 'sopFixedVehicleHour',
  sopVariableKm: 'sopVariableKm',
  processingCostPerThousand: 'processingCostPerThousand',
} as const;

interface CostComponent {
  target: string;
  value: number;
}

export function calculatePricingResult(
  simulation: PricingSimulation,
  parameters: CommercialParameters = commercialParametersMock,
): PricingResult {
  const costTotal =
    simulation.operationMode === 'processing'
      ? calculateProcessingCost(simulation)
      : calculateTransportCost(simulation);

  const commercialLoad =
    parameters.operationalExpensesRate +
    parameters.indirectExpensesRate +
    parameters.targetMarginRate;
  const denominator = Math.max(0.01, 1 - commercialLoad);
  const netPrice = costTotal / denominator;
  const taxRate = resolveTaxRate(simulation, parameters);
  const finalPrice = netPrice / Math.max(0.01, 1 - taxRate);
  const quantity = resolveQuantity(simulation);

  return {
    costTotal,
    operationalExpenses: netPrice * parameters.operationalExpensesRate,
    indirectExpenses: netPrice * parameters.indirectExpensesRate,
    margin: netPrice * parameters.targetMarginRate,
    netPrice,
    taxRate,
    taxes: finalPrice - netPrice,
    finalPrice,
    monthlyPrice: finalPrice * quantity,
    ebitdaRate: parameters.targetMarginRate,
    warning: resolveWarning(simulation, costTotal),
  };
}

export function calculateConsolidatedResult(
  simulation: PricingSimulation = initialPricingSimulation,
  parameters: ConsolidatedParameters,
  savedCommercialParameters: CommercialParameters = commercialParametersMock,
): ConsolidatedResult {
  const commercialParameters: CommercialParameters = {
    ...savedCommercialParameters,
    targetMarginRate: normalizeRate(parameters.targetMarginRate),
  };
  const pricing = calculatePricingResult(simulation, commercialParameters);
  const quantity = resolveQuantity(simulation);
  const mainTaxRate = resolveMainTaxRate(simulation);
  const pisCofinsRate = commercialParameters.pisCofinsRate;
  const unitPriceBeforeIssIcms = parameters.issIcmsIncluded
    ? pricing.finalPrice * (1 - mainTaxRate)
    : pricing.finalPrice;
  const grossRevenue = pricing.finalPrice * quantity;
  const adjustedGrossRevenue = unitPriceBeforeIssIcms * quantity;
  const pisCofins = adjustedGrossRevenue * pisCofinsRate;
  const issIcms = parameters.issIcmsIncluded
    ? grossRevenue - adjustedGrossRevenue
    : grossRevenue * mainTaxRate;
  const netRevenue = adjustedGrossRevenue - pisCofins;
  const directCosts = pricing.costTotal * quantity;
  const operationalExpenses = pricing.operationalExpenses * quantity;
  const indirectExpenses = pricing.indirectExpenses * quantity;
  const adValorem = safeNumber(parameters.financialVolume) * normalizeRate(parameters.adValoremRate);
  const custody = safeNumber(parameters.financialVolume) * normalizeRate(parameters.custodyRate);
  const ebitda =
    netRevenue -
    directCosts -
    operationalExpenses -
    indirectExpenses -
    adValorem -
    custody;

  return {
    proposal: {
      baseName: pricingBases.find((base) => base.id === simulation.baseId)?.name ?? simulation.baseId,
      city: simulation.city,
      uf: simulation.uf,
      serviceType: simulation.operationMode === 'processing' ? 'Processamento' : 'Transporte de valores',
      operationLabel:
        simulation.operationMode === 'processing' ? simulation.processingType : simulation.vehicle,
      quantity,
      quantityLabel: simulation.operationMode === 'processing' ? 'volume mensal' : 'atendimentos/mes',
      unitPrice: pricing.finalPrice,
    },
    pricing,
    grossRevenue,
    adjustedGrossRevenue,
    netRevenue,
    pisCofins,
    issIcms,
    directCosts,
    operationalExpenses,
    indirectExpenses,
    adValorem,
    custody,
    ebitda,
    ebitdaRate: adjustedGrossRevenue > 0 ? ebitda / adjustedGrossRevenue : 0,
    finalUnitPrice: unitPriceBeforeIssIcms,
    finalMonthlyPrice: adjustedGrossRevenue,
    mainTaxRate,
    pisCofinsRate,
    warning: pricing.warning,
  };
}

export function resolveMainTaxRate(simulation: PricingSimulation): number {
  if (simulation.operationMode === 'processing') {
    return (
      processingCosts.find(
        (cost) => cost.baseId === simulation.baseId && cost.type === simulation.processingType,
      )?.issRate ?? 0
    );
  }

  const vehicleCost = findVehicleCost(simulation);

  if (simulation.taxOperation === 'URBAN') {
    return vehicleCost?.issRate ?? 0;
  }

  if (simulation.taxOperation === 'INTERSTATE') {
    return (
      interstateTaxRates.find(
        (rate) => rate.originUf === simulation.uf && rate.destinationUf === simulation.destinationUf,
      )?.rate ?? 0.12
    );
  }

  return vehicleCost?.icmsRate ?? 0;
}

function calculateTransportCost(simulation: PricingSimulation): number {
  if (simulation.transportCostOrigin === 'CPE') {
    const reference = findCpeReference(simulation);
    return sumCorrectedCostComponents(simulation, [
      { target: CORRECTION_TARGETS.cpeReference, value: reference?.cost ?? 0 },
      { target: CORRECTION_TARGETS.otherCosts, value: safeNumber(simulation.otherCosts) },
    ]);
  }

  const vehicleCost = findVehicleCost(simulation);
  if (!vehicleCost) {
    return sumCorrectedCostComponents(simulation, [
      { target: CORRECTION_TARGETS.otherCosts, value: safeNumber(simulation.otherCosts) },
    ]);
  }

  const totalHours =
    safeNumber(simulation.normalHours) +
    safeNumber(simulation.overtime50Hours) +
    safeNumber(simulation.overtime100Hours);

  return sumCorrectedCostComponents(simulation, [
    {
      target: CORRECTION_TARGETS.sopNormalHours,
      value: safeNumber(simulation.normalHours) * vehicleCost.normalHour,
    },
    {
      target: CORRECTION_TARGETS.sopOvertime50Hours,
      value: safeNumber(simulation.overtime50Hours) * vehicleCost.overtime50,
    },
    {
      target: CORRECTION_TARGETS.sopOvertime100Hours,
      value: safeNumber(simulation.overtime100Hours) * vehicleCost.overtime100,
    },
    {
      target: CORRECTION_TARGETS.sopFixedVehicleHour,
      value: totalHours * vehicleCost.fixedCostPerHour,
    },
    {
      target: CORRECTION_TARGETS.sopVariableKm,
      value: safeNumber(simulation.km) * vehicleCost.variableCostPerKm,
    },
    { target: CORRECTION_TARGETS.otherCosts, value: safeNumber(simulation.otherCosts) },
  ]);
}

function calculateProcessingCost(simulation: PricingSimulation): number {
  return sumCorrectedCostComponents(simulation, [
    {
      target: CORRECTION_TARGETS.processingCostPerThousand,
      value:
        processingCosts.find(
          (cost) => cost.baseId === simulation.baseId && cost.type === simulation.processingType,
        )?.costPerThousand ?? 0,
    },
  ]);
}

function sumCorrectedCostComponents(
  simulation: PricingSimulation,
  components: Array<CostComponent>,
): number {
  return components.reduce(
    (total, component) => total + applyCostCorrection(simulation, component),
    0,
  );
}

function applyCostCorrection(simulation: PricingSimulation, component: CostComponent): number {
  if (
    !simulation.costCorrectionEnabled ||
    !simulation.costCorrectionTargets.includes(component.target)
  ) {
    return component.value;
  }

  return component.value * (1 + normalizeRate(simulation.costCorrectionRate));
}

function resolveTaxRate(simulation: PricingSimulation, parameters: CommercialParameters): number {
  return parameters.pisCofinsRate + resolveMainTaxRate(simulation);
}

function resolveQuantity(simulation: PricingSimulation): number {
  return simulation.operationMode === 'processing'
    ? Math.max(0, safeNumber(simulation.thousandsVolume))
    : Math.max(0, safeNumber(simulation.quantity));
}

function findCpeReference(simulation: PricingSimulation) {
  return cpeReferences.find(
    (reference) =>
      reference.baseId === simulation.baseId &&
      normalizeText(reference.city) === normalizeText(simulation.city) &&
      reference.uf === simulation.uf &&
      reference.routeType === simulation.routeType &&
      reference.vehicle === simulation.vehicle &&
      reference.pointType === simulation.pointType,
  );
}

function findVehicleCost(simulation: PricingSimulation) {
  return vehicleCosts.find(
    (cost) => cost.baseId === simulation.baseId && cost.vehicle === simulation.vehicle,
  );
}

function resolveWarning(simulation: PricingSimulation, costTotal: number): string | undefined {
  if (simulation.operationMode === 'transport' && simulation.transportCostOrigin === 'CPE' && costTotal === 0) {
    return 'Nao ha referencia CPE para a combinacao informada. O custo foi zerado para sinalizar cadastro pendente.';
  }

  if (simulation.operationMode === 'processing' && costTotal === 0) {
    return 'Nao ha custo de processamento cadastrado para a base e tipo selecionados.';
  }

  return undefined;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function normalizeRate(value: number): number {
  const safeValue = safeNumber(value);
  return safeValue > 1 ? safeValue / 100 : safeValue;
}

function safeNumber(value: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}
