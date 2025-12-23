import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async login() {
    this.error = '';
    this.loading = true;

    try {
      await this.authService.login(this.email, this.password);
      this.router.navigate(['/']);
    } catch (err: any) {
      this.error = err.message || 'Login failed';
    } finally {
      this.loading = false;
    }
  }
}
