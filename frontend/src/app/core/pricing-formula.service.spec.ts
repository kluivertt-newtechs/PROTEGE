import { PricingFormula } from './mock';
import { executePricingFormulas } from './pricing-formula.service';

function formula(id: string, expression: string, enabled = true): PricingFormula {
  return {
    id,
    label: id,
    description: '',
    expression,
    enabled,
    category: 'resultado',
    businessBranches: ['transport', 'processing'],
  };
}

function warningFor(formulas: Array<PricingFormula>, context: Record<string, number> = { costBase: 10 }): string {
  return executePricingFormulas(context, formulas).warning ?? '';
}

describe('executePricingFormulas', () => {
  it('executes arithmetic operators and parentheses', () => {
    const result = executePricingFormulas(
      { costBase: 20, quantity: 7, otherCost: 3 },
      [formula('total', '((costBase + quantity - otherCost) * 2 / 3) % 5')],
    );

    expect(result.warning).toBeUndefined();
    expect(result.values['total']).toBeCloseTo(1);
  });

  it('executes decimal numbers', () => {
    const result = executePricingFormulas(
      { costBase: 10 },
      [formula('decimalTotal', 'costBase * 1.5 + 0.25')],
    );

    expect(result.values['decimalTotal']).toBeCloseTo(15.25);
  });

  it('executes allowed Math functions', () => {
    const result = executePricingFormulas(
      {},
      [
        formula(
          'mathTotal',
          'Math.pow(2, 3) + Math.sqrt(9) + Math.max(5, 2) + Math.min(5, 2) + Math.round(1.6) + Math.ceil(1.2) + Math.floor(1.8) + Math.abs(-4)',
        ),
      ],
    );

    expect(result.warning).toBeUndefined();
    expect(result.values['mathTotal']).toBe(27);
  });

  it('executes formula references after dependencies', () => {
    const result = executePricingFormulas(
      { costBase: 10 },
      [
        formula('total', 'subtotal + 3'),
        formula('subtotal', 'costBase * 2'),
      ],
    );

    expect(result.warning).toBeUndefined();
    expect(result.values['subtotal']).toBe(20);
    expect(result.values['total']).toBe(23);
  });

  it('reports missing references with the formula id', () => {
    expect(warningFor([formula('marginValue', 'margem + 1')]))
      .toContain('marginValue: referencia inexistente: margem.');
  });

  it('reports disallowed Math functions', () => {
    expect(warningFor([formula('taxRate', 'Math.random()')]))
      .toContain('taxRate: funcao Math.random nao permitida.');
  });

  it('reports unbalanced parentheses', () => {
    expect(warningFor([formula('taxRate', 'costBase + )')]))
      .toContain('taxRate: parentese ")" sem abertura.');
  });

  it('reports duplicated or incomplete operators', () => {
    const warning = warningFor([formula('netPrice', 'costBase + * 2')]);

    expect(warning).toContain('netPrice: operador "*" sem operando anterior.');
  });

  it('reports expressions ending with an operator', () => {
    expect(warningFor([formula('netPrice', 'costBase +')]))
      .toContain('netPrice: expressao termina com operador "+".');
  });

  it('reports non-finite division and modulo results', () => {
    expect(warningFor([formula('divided', 'costBase / 0')]))
      .toContain('divided: Resultado nao numerico, Infinity ou NaN.');
    expect(warningFor([formula('modulo', 'costBase % 0')]))
      .toContain('modulo: Resultado nao numerico, Infinity ou NaN.');
  });

  it('reports variable values that can cause non-finite results', () => {
    const divisionWarning = warningFor(
      [formula('formula11', 'costBase / divisor')],
      { costBase: 10, divisor: 0 },
    );

    expect(divisionWarning).toContain('divisao por zero em divisor');
    expect(divisionWarning).toContain('Variaveis usadas: costBase=10, divisor=0.');

    const sqrtWarning = warningFor(
      [formula('formula12', 'Math.sqrt(marginValue)')],
      { marginValue: -1 },
    );

    expect(sqrtWarning).toContain('Math.sqrt recebeu valor negativo em marginValue');
    expect(sqrtWarning).toContain('Variaveis usadas: marginValue=-1.');
  });

  it('reports circular references', () => {
    const warning = warningFor([
      formula('a', 'b + 1'),
      formula('b', 'a + 1'),
    ]);

    expect(warning).toContain('Refer');
    expect(warning).toContain('a -> b -> a');
  });

  it('reports references to disabled formulas', () => {
    const warning = warningFor([
      formula('netPrice', 'baseDisabled + 1'),
      formula('baseDisabled', 'costBase', false),
    ]);

    expect(warning).toContain('netPrice:');
    expect(warning).toContain('baseDisabled.');
  });
});
