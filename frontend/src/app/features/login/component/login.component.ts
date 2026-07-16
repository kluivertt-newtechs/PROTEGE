import { Component, inject, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { PoLanguage, PoNotificationService } from '@po-ui/ng-components';
import { Login } from '../models/login';
import { LoginService } from '../services/login.service';
import { SHARED_MODULES } from 'src/app/shared/shared';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  standalone: true,
  imports: [SHARED_MODULES, CommonModule],
})
export class LoginComponent implements OnInit {
  private loginService: LoginService = inject(LoginService);
  private router = inject(Router);
  private poNotification = inject(PoNotificationService);
  public isLoading: boolean = false;

  languages: Array<PoLanguage> = [{ language: 'pt', description: 'Português' }];

  ngOnInit(): void {}

  onLogin(loginPage: any) {
    console.log('login', loginPage);
    this.loginService
      .sendLoginMock(loginPage.login, loginPage.password)
      .subscribe({
        next: (response: Login) => {
          if (response) {
            let loginNow: number = Date.now();

            localStorage.setItem('access_token', response?.access_token);
            localStorage.setItem('refresh_token', response?.refresh_token);
            localStorage.setItem(
              'expires_in',
              String(loginNow + response?.expires_in * 1000),
            );
            localStorage.setItem('token_type', response?.token_type);

            this.router.navigate(['home']);
          } else {
            this.poNotification.error('Acesso inválido');
          }
        },
        error: (err: any) => {
          this.poNotification.error('Erro ao efetuar o login');
        },
      });
  }
}
