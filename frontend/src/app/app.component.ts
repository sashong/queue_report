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
    this.report = [];
    this.validationFailures = [];
    this.summary = null;
    this.error = null;

    this.api.getQueueReport(this.selectedQueueId).subscribe({
      next: (res: any) => {
  console.log('API RESPONSE:', res);

  // 🔥 MAP BACKEND RESPONSE CORRECTLY
  this.report = Array.isArray(res.report) ? res.report : [];

  this.validationFailures = Array.isArray(res.validationFailedRecords)
    ? res.validationFailedRecords
    : [];

  this.summary = {
    recordsReported: res.recordsReported ?? 0,
    validationFailures: res.validationFailures ?? 0
  };

  this.loading = false;
}
    });
  }
}
