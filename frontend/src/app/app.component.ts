import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private http: HttpClient) {}

  /* ---------------- STATE ---------------- */
  queues: any[] = [];
  allRecords: any[] = [];
  filteredRecords: any[] = [];
  validationFailures: any[] = [];
  summary: any = null;

  selectedQueueId = '';
  loading = false;
  error = '';
  searchText = '';

  /* ---------------- FILTERS ---------------- */
  selectedProductStatus = '';
  selectedIntegrationMode = '';
  selectedStage = '';

  productStatusOptions: any[] = [];
  integrationModeOptions: any[] = [];
  stageOptions: any[] = [];

  /* ---------------- INIT ---------------- */
  ngOnInit() {
    this.fetchQueues();
  }

  /* ---------------- API CALLS ---------------- */
  fetchQueues() {
    this.http.get<any[]>('http://localhost:3000/queues').subscribe({
      next: res => this.queues = res,
      error: () => this.error = 'Failed to load queues'
    });
  }

  resetFilters() {
  this.selectedProductStatus = '';
  this.selectedIntegrationMode = '';
  this.selectedStage = '';
  this.searchText = '';

  this.filteredRecords = [...this.allRecords];
}


  loadReport() {
    if (!this.selectedQueueId) return;

    this.loading = true;
    this.error = '';
    this.resetFilters();
    this.searchText = '';

    this.http
      .get<any>(`http://localhost:3000/queue-report/${this.selectedQueueId}`)
      .subscribe({
        next: res => {
          this.allRecords = res.records || [];
          this.validationFailures = res.validationFailures || [];
          this.summary = res.summary;

          this.buildFilterOptions();
          this.applyFilters();
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load report';
          this.loading = false;
        }
      });
  }

  /* ---------------- FILTER LOGIC ---------------- */
  buildFilterOptions() {

    const countBy = (key: string) => {
      const map = new Map<string, number>();
      this.allRecords.forEach(r => {
      const v = String(r?.[key] ?? 'N/A');
        map.set(v, (map.get(v) || 0) + 1);
      });
      
      return Array.from(map.entries()).map(([value, count]) => ({ value, count }));
    };

    this.productStatusOptions = countBy('productStatus');
    this.integrationModeOptions = countBy('integrationMode');
    this.stageOptions = countBy('tokenStage');
  }

  activeFilter: 'status' | 'mode' | 'stage' | null = null;

toggleFilter(type: 'status' | 'mode' | 'stage') {
  this.activeFilter = this.activeFilter === type ? null : type;
}

closeFilter() {
  this.activeFilter = null;
}


  applyFilters() {
  const search = this.searchText.toLowerCase().trim();

  this.filteredRecords = this.allRecords.filter(r => {

    // ---------- FILTERS ----------
    const productStatusMatch =
      !this.selectedProductStatus ||
      r.productStatus === this.selectedProductStatus;

    const integrationModeMatch =
      !this.selectedIntegrationMode ||
      r.integrationMode === this.selectedIntegrationMode;

    const stageMatch =
      !this.selectedStage ||
      r.tokenStage === this.selectedStage;

    // ---------- SEARCH ----------
    const searchMatch =
      !search ||
      (r.productName && r.productName.toLowerCase().includes(search)) ||
      (r.participantName && r.participantName.toLowerCase().includes(search));

    return (
      productStatusMatch &&
      integrationModeMatch &&
      stageMatch &&
      searchMatch
    );
  });
}


}
