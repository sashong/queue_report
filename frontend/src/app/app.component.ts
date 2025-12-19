import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title(title: any) {
    throw new Error('Method not implemented.');
  }

  queues: any[] = [];
  selectedQueueId: string | null = null;

  report: any[] = [];
  validationFailures: any[] = [];
  summary: any = null;

  loading = false;
  error: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.fetchQueues();
  }

  fetchQueues() {
    this.loading = true;
    this.api.getQueues().subscribe({
      next: (res: any) => {
        this.queues = Array.isArray(res) ? res : [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load queues';
        this.loading = false;
      }
    });
  }

  loadReport() {
  if (!this.selectedQueueId) return;

  this.loading = true;

  this.api.getQueueReport(this.selectedQueueId).subscribe({
    next: (res) => {
      console.log('API RESPONSE:', res);

      this.report = res.records ?? [];
      this.validationFailures = res.validationFailures ?? [];
      this.summary = res.summary ?? null;

      this.loading = false;
    },
    error: (err) => {
      console.error(err);
      this.loading = false;
    }
  });
}
}
