export interface PricingBase {
  id: string;
  name: string;
  city: string;
  uf: string;
  erpBranch: string;
  taxRegime: string;
}

export interface VehicleCost {
  baseId: string;
  vehicle: string;
  normalHour: number;
  overtime50: number;
  overtime100: number;
  fixedCostPerHour: number;
  variableCostPerKm: number;
  issRate: number;
  icmsRate: number;
}

export interface CommercialParameters {
  operationalExpensesRate: number;
  indirectExpensesRate: number;
  targetMarginRate: number;
  pisCofinsRate: number;
}

export interface CpeReference {
  baseId: string;
  city: string;
  uf: string;
  routeType: string;
  vehicle: string;
  pointType: string;
  cost: number;
}

export interface ProcessingCost {
  type: string;
  baseId: string;
  costPerThousand: number;
  issRate: number;
}

export interface PricingSimulation {
  operationMode: 'transport' | 'processing';
  transportCostOrigin: 'CPE' | 'SOP';
  baseId: string;
  city: string;
  uf: string;
  destinationUf: string;
  pointType: string;
  vehicle: string;
  routeType: string;
  taxOperation: 'URBAN' | 'INTERURBAN' | 'INTERSTATE';
  quantity: number;
  otherCosts: number;
  km: number;
  normalHours: number;
  overtime50Hours: number;
  overtime100Hours: number;
  processingType: string;
  thousandsVolume: number;
}

export interface PricingResult {
  costTotal: number;
  operationalExpenses: number;
  indirectExpenses: number;
  margin: number;
  netPrice: number;
  taxRate: number;
  taxes: number;
  finalPrice: number;
  monthlyPrice: number;
  ebitdaRate: number;
  warning?: string;
}

export interface InterstateTaxRate {
  originUf: string;
  destinationUf: string;
  rate: number;
}

export const pricingBases: Array<PricingBase> = [
  { id: 'base-oeste', name: 'Base Oeste', city: 'São Paulo', uf: 'SP', erpBranch: '1.01 - Matriz SP', taxRegime: 'Lucro Presumido' },
  { id: 'rio-branco', name: 'Rio Branco', city: 'Rio Branco', uf: 'AC', erpBranch: '2.04 - Filial AC', taxRegime: 'Lucro Presumido' },
  { id: 'campinas', name: 'Campinas', city: 'Campinas', uf: 'SP', erpBranch: '1.03 - Campinas', taxRegime: 'Lucro Presumido' },
  { id: 'bauru', name: 'Bauru', city: 'Bauru', uf: 'SP', erpBranch: '1.05 - Bauru', taxRegime: 'Lucro Presumido' },
  { id: 'cuiaba', name: 'Cuiabá', city: 'Cuiabá', uf: 'MT', erpBranch: '3.02 - Cuiabá', taxRegime: 'Lucro Presumido' },
];

export const vehicleCosts: Array<VehicleCost> = [
  { baseId: 'base-oeste', vehicle: 'Carro Forte', normalHour: 248.74, overtime50: 373.11, overtime100: 497.48, fixedCostPerHour: 158.22, variableCostPerKm: 9.86, issRate: 0.05, icmsRate: 0.12 },
  { baseId: 'base-oeste', vehicle: 'Carro Leve', normalHour: 152.32, overtime50: 228.48, overtime100: 304.64, fixedCostPerHour: 86.7, variableCostPerKm: 4.88, issRate: 0.05, icmsRate: 0.12 },
  { baseId: 'base-oeste', vehicle: 'T-REX', normalHour: 318.9, overtime50: 478.35, overtime100: 637.8, fixedCostPerHour: 204.12, variableCostPerKm: 12.42, issRate: 0.05, icmsRate: 0.12 },
  { baseId: 'rio-branco', vehicle: 'Carro Forte', normalHour: 271.15, overtime50: 406.72, overtime100: 542.3, fixedCostPerHour: 169.8, variableCostPerKm: 10.54, issRate: 0.04, icmsRate: 0.12 },
  { baseId: 'rio-branco', vehicle: 'Carro Leve', normalHour: 166.4, overtime50: 249.6, overtime100: 332.8, fixedCostPerHour: 93.25, variableCostPerKm: 5.44, issRate: 0.04, icmsRate: 0.12 },
  { baseId: 'campinas', vehicle: 'Carro Forte', normalHour: 235.6, overtime50: 353.4, overtime100: 471.2, fixedCostPerHour: 149.12, variableCostPerKm: 8.97, issRate: 0.03, icmsRate: 0.12 },
  { baseId: 'bauru', vehicle: 'Troodon', normalHour: 201.75, overtime50: 302.62, overtime100: 403.5, fixedCostPerHour: 132.54, variableCostPerKm: 7.18, issRate: 0.03, icmsRate: 0.12 },
  { baseId: 'cuiaba', vehicle: 'Carro Forte', normalHour: 289.3, overtime50: 433.95, overtime100: 578.6, fixedCostPerHour: 181.7, variableCostPerKm: 11.22, issRate: 0.05, icmsRate: 0.12 },
];

export const commercialParametersMock: CommercialParameters = {
  operationalExpensesRate: 0.14,
  indirectExpensesRate: 0.141,
  targetMarginRate: 0.08,
  pisCofinsRate: 0.0365,
};

export const cpeReferences: Array<CpeReference> = [
  { baseId: 'base-oeste', city: 'SAO PAULO', uf: 'SP', routeType: 'Semanal', vehicle: 'Carro Forte', pointType: 'Embarque', cost: 612.35 },
  { baseId: 'base-oeste', city: 'SAO PAULO', uf: 'SP', routeType: 'Semanal', vehicle: 'Carro Leve', pointType: 'Embarque', cost: 398.72 },
  { baseId: 'base-oeste', city: 'SAO PAULO', uf: 'SP', routeType: 'Sábado', vehicle: 'Carro Forte', pointType: 'Abastecimento', cost: 733.28 },
  { baseId: 'rio-branco', city: 'ACRELANDIA', uf: 'AC', routeType: 'Semanal', vehicle: 'Carro Forte', pointType: 'Embarque', cost: 815.9 },
  { baseId: 'rio-branco', city: 'RIO BRANCO', uf: 'AC', routeType: 'Semanal', vehicle: 'Carro Leve', pointType: 'Técnica', cost: 455.4 },
  { baseId: 'campinas', city: 'CAMPINAS', uf: 'SP', routeType: 'Semanal', vehicle: 'Carro Forte', pointType: 'Ponta a ponta', cost: 582.13 },
  { baseId: 'base-oeste', city: 'SANTA CRUZ DO SUL', uf: 'RS', routeType: 'Semanal', vehicle: 'Carro Forte', pointType: 'Embarque', cost: 1048.67 },
];

export const processingCosts: Array<ProcessingCost> = [
  { type: 'AGÊNCIA', baseId: 'base-oeste', costPerThousand: 12.42, issRate: 0.05 },
  { type: 'AGÊNCIA - BBD', baseId: 'base-oeste', costPerThousand: 10.88, issRate: 0.05 },
  { type: 'ATM', baseId: 'base-oeste', costPerThousand: 17.36, issRate: 0.05 },
  { type: 'ATM - ITAÚ', baseId: 'base-oeste', costPerThousand: 15.97, issRate: 0.05 },
  { type: 'AGÊNCIA', baseId: 'rio-branco', costPerThousand: 14.2, issRate: 0.04 },
  { type: 'ATM', baseId: 'rio-branco', costPerThousand: 19.4, issRate: 0.04 },
  { type: 'AGÊNCIA', baseId: 'campinas', costPerThousand: 11.95, issRate: 0.03 },
  { type: 'ATM - ITAÚ', baseId: 'cuiaba', costPerThousand: 18.75, issRate: 0.05 },
];

export const interstateTaxRates: Array<InterstateTaxRate> = [
  { originUf: 'SP', destinationUf: 'RJ', rate: 0.12 },
  { originUf: 'SP', destinationUf: 'MG', rate: 0.12 },
  { originUf: 'SP', destinationUf: 'RS', rate: 0.12 },
  { originUf: 'SP', destinationUf: 'AC', rate: 0.07 },
  { originUf: 'AC', destinationUf: 'SP', rate: 0.12 },
  { originUf: 'AC', destinationUf: 'RS', rate: 0.12 },
  { originUf: 'RS', destinationUf: 'SP', rate: 0.12 },
  { originUf: 'MT', destinationUf: 'SP', rate: 0.12 },
];

export const initialPricingSimulation: PricingSimulation = {
  operationMode: 'transport',
  transportCostOrigin: 'CPE',
  baseId: 'base-oeste',
  city: 'São Paulo',
  uf: 'SP',
  destinationUf: 'RJ',
  pointType: 'Embarque',
  vehicle: 'Carro Forte',
  routeType: 'Semanal',
  taxOperation: 'URBAN',
  quantity: 22,
  otherCosts: 0,
  km: 18,
  normalHours: 2,
  overtime50Hours: 0,
  overtime100Hours: 0,
  processingType: 'AGÊNCIA',
  thousandsVolume: 120,
};
