import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment.hml';
import { Login } from '../models/login';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private http: HttpClient = inject(HttpClient);
  private url: string = environment.url;

  constructor() {}

  public sendLogin(username: string, password: string): Observable<Login> {
    let urlLogin: string = `${this.url}/api/oauth2/v1/token?grant_type=password&username=${username}&password=${password}`;
    return this.http.post<Login>(urlLogin, null);
  }

  public refreshLogin(refresh_token: string): Observable<Login> {
    let urlRefresh: string = `${this.url}/api/oauth2/v1/token?grant_type=refresh_token&refresh_token=${refresh_token}`;
    return this.http.post<Login>(urlRefresh, null);
  }

  public sendLoginMock(username: string, password: string): Observable<any> {
    return username === 'admin' && password === '2' ? of(true) : of(false);
  }

  public refreshLoginMock(refresh_token: string): Observable<any> {
    return refresh_token === 'refresh_token' ? of(true) : of(false);
  }
}
