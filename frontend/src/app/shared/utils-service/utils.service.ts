import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {
  private http: HttpClient = inject(HttpClient);

  constructor() { }

  validateForm(form: FormGroup) {
    Object.values(form.controls).forEach((control) => {
      control.markAsDirty();
      control.markAsTouched();
    });
  }

   searchZipCode(cep: string): Observable<any> {
    return this.http.get(`https://viacep.com.br/ws/${cep}/json/`);
  }
}
