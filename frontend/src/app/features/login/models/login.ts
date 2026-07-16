export class Login {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;

  constructor() {
    ((this.access_token = ''),
      (this.refresh_token = ''),
      (this.expires_in = 0),
      (this.token_type = ''));
  }
}
