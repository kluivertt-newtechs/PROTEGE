import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Login } from '../login/models/login';
import { LoginService } from '../login/services/login.service';

export const authGuard: CanActivateFn = (route, state) => {
  let loginService: LoginService = inject(LoginService);
  let router = inject(Router);
  let access_token = localStorage.getItem('access_token');
  let refresh_token = localStorage.getItem('refresh_token');
  let expires_in = localStorage.getItem('expires_in');

  if (!access_token) {
    router.navigate(['login']);
    return false;
  }

  if (typeof expires_in === 'string') {
    if (Number(expires_in) > Date.now()) {
      return true;
    }
  }

  if (typeof refresh_token === 'string') {
    loginService.refreshLoginMock('refresh_token').subscribe({
      next: (response: Login) => {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('refresh_token', response.refresh_token);
        localStorage.setItem(
          'expires_in',
          String(Date.now() + response.expires_in * 1000),
        );
        localStorage.setItem('token_type', response.token_type);
        return true;
      },
      error: () => {
        localStorage.clear();
        router.navigate(['login']);
        return false;
      },
    });
  }

  return true;
};
