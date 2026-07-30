import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { PoSelectOption } from '@po-ui/ng-components';
import {
  DEFAULT_PRICING_FORMULAS,
  PRICING_FORMULA_VARIABLES,
  PricingFormulaService,
} from 'src/app/core/pricing-formula.service';
import { PricingFormula, PricingFormulaCategory } from 'src/app/core/mock';
import { SHARED_MODULES } from 'src/app/shared/shared';

@Component({
  selector: 'app-formula-builder',
  templateUrl: './formula-builder.component.html',
  styleUrls: ['./formula-builder.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class FormulaBuilderComponent implements OnInit {
  formulas: Array<PricingFormula> = [];
  selectedFormula?: PricingFormula;
  private selectedFormulaOriginalId = '';
  statusMessage = '';
  statusType: 'success' | 'error' | 'info' = 'info';

  readonly variables = PRICING_FORMULA_VARIABLES;
  readonly defaultFormulaIds = DEFAULT_PRICING_FORMULAS.map((formula) => formula.id);
  readonly categoryOptions: Array<PoSelectOption> = [
    { label: 'Custo', value: 'custo' },
    { label: 'Comercial', value: 'comercial' },
    { label: 'Imposto', value: 'imposto' },
    { label: 'Resultado', value: 'resultado' },
  ];

  constructor(private readonly formulaService: PricingFormulaService) {}

  ngOnInit(): void {
    this.loadFormulas();
  }

  selectFormula(formula: PricingFormula): void {
    this.selectedFormula = { ...formula };
    this.selectedFormulaOriginalId = formula.id;
    this.statusMessage = '';
  }

  addFormula(): void {
    const nextOrder = Math.max(0, ...this.formulas.map((formula) => formula.order)) + 10;
    this.selectedFormula = {
      id: `formula${this.formulas.length + 1}`,
      label: 'Nova fórmula',
      description: '',
      expression: '0',
      order: nextOrder,
      enabled: true,
      category: 'resultado',
    };
    this.selectedFormulaOriginalId = '';
    this.statusMessage = '';
  }

  removeSelected(): void {
    if (!this.selectedFormula) {
      return;
    }

    const selectedId = this.selectedFormulaOriginalId || this.selectedFormula.id;
    this.formulas = this.formulas.filter((formula) => formula.id !== selectedId);
    this.selectedFormula = this.formulas[0] ? { ...this.formulas[0] } : undefined;
    this.selectedFormulaOriginalId = this.selectedFormula?.id ?? '';
    this.validate();
  }

  validate(): void {
    const validation = this.formulaService.validate(this.buildEditedCatalog());
    this.statusType = validation.valid ? 'success' : 'error';
    this.statusMessage = validation.valid
      ? 'Fórmulas válidas para execução.'
      : validation.messages.join(' ');
  }

  save(): void {
    const catalog = this.buildEditedCatalog();
    const validation = this.formulaService.saveFormulas(catalog);

    if (!validation.valid) {
      this.statusType = 'error';
      this.statusMessage = validation.messages.join(' ');
      return;
    }

    this.formulas = this.sortFormulas(catalog);
    const selected = this.formulas.find((formula) => formula.id === this.selectedFormula?.id);
    this.selectedFormula = selected ? { ...selected } : { ...this.formulas[0] };
    this.selectedFormulaOriginalId = this.selectedFormula?.id ?? '';
    this.statusType = 'success';
    this.statusMessage = 'Fórmulas salvas localmente.';
  }

  resetDefaults(): void {
    this.formulas = this.formulaService.resetToDefault();
    this.selectedFormula = { ...this.formulas[0] };
    this.selectedFormulaOriginalId = this.selectedFormula.id;
    this.statusType = 'info';
    this.statusMessage = 'Catálogo padrão restaurado.';
  }

  insertToken(token: string): void {
    if (!this.selectedFormula) {
      return;
    }

    this.selectedFormula.expression = `${this.selectedFormula.expression} ${token}`.trim();
  }

  updateSelectedCategory(category: string | number): void {
    if (!this.selectedFormula) {
      return;
    }

    this.selectedFormula.category = String(category) as PricingFormulaCategory;
  }

  getCategoryLabel(category: PricingFormulaCategory): string {
    return this.categoryOptions.find((option) => option.value === category)?.label ?? category;
  }

  formatOrder(order: number): string {
    return String(order).padStart(3, '0');
  }

  private loadFormulas(): void {
    this.formulas = this.sortFormulas(this.formulaService.getFormulas());
    this.selectedFormula = this.formulas[0] ? { ...this.formulas[0] } : undefined;
    this.selectedFormulaOriginalId = this.selectedFormula?.id ?? '';
  }

  private buildEditedCatalog(): Array<PricingFormula> {
    if (!this.selectedFormula) {
      return this.formulas;
    }

    const editedFormula: PricingFormula = { ...this.selectedFormula };
    const selectedId = this.selectedFormulaOriginalId || editedFormula.id;
    const exists = this.formulas.some((formula) => formula.id === selectedId);
    const catalog: Array<PricingFormula> = exists
      ? this.formulas.map((formula) =>
          formula.id === selectedId ? editedFormula : formula,
        )
      : [...this.formulas, editedFormula];

    return this.sortFormulas(catalog);
  }

  private sortFormulas(formulas: Array<PricingFormula>): Array<PricingFormula> {
    return [...formulas].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }
}
