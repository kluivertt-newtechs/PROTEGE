import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-required-field-warning',
  standalone: false,
  templateUrl: './required-field-warning.component.html',
  styleUrl: './required-field-warning.component.css'
})
export class RequiredFieldWarningComponent {
 @Input() isInput = true;
 @Input() form!: FormGroup;
 @Input() field!: string;

  canValidateRequiredField() {
    return (
      this.form.controls[this.field] &&
      this.form.controls[this.field].invalid &&
      (this.form.controls[this.field].dirty ||
        this.form.controls[this.field].touched)
    );
  }
}
