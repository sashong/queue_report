import { Component , HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc } from 'firebase/firestore';
import { environment } from '../environments/environments';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  /* ================= FIREBASE (SINGLE INIT) ================= */

  firebaseApp = getApps().length === 0 ? initializeApp(environment.firebase) : getApps()[0];
  db = getFirestore(this.firebaseApp);

  /* ================= UI STATE ================= */

  showDashboard = false;
  loading = false;
  error = '';

  /* ================= QUEUE ================= */

  queues: any[] = [];
  filteredQueues: any[] = [];
  selectedQueueId = '';
  lastQueueId = '';

  showQueueDropdown = false;
  queueSearchText = '';
  reportLoaded = false;

  /* ================= DATA ================= */

  allRecords: any[] = [];
  filteredRecords: any[] = [];
  paginatedRecords: any[] = [];
  validationFailures: any[] = [];

  /* ================= FILTERS ================= */

  selectedProductStatus = '';
  selectedIntegrationMode = '';
  selectedStage = '';
  searchText = '';

  productStatusOptions: any[] = [];
  integrationModeOptions: any[] = [];
  stageOptions: any[] = [];

  activeFilter: 'status' | 'mode' | 'stage' | null = null;

  activeKpiFilter:
    | 'completed'
    | 'initiated'
    | 'ongoing'
    | 'cancelled'
    | 'valid'
    | 'invalid'
    | null = null;

  /* ================= PAGINATION ================= */

  pageSize = 10;
  currentPage = 1;
  totalPages = 1;

  /* ================= KPI ================= */

  dashboard = {
    total: 0,
    completed: 0,
    initiated: 0,
    ongoing: 0,
    cancelled: 0,
    valid: 0,
    failed: 0
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.showDashboard = true;
    this.loadQueues();
  }

  /* VALIDATION — ONLY 2 CASES ARE VALID */

  validateRecord(
    productStatus: string,
    tokenStage: string,
    integrationMode: string
  ): { passed: boolean; reason: string } {

    const status = (productStatus || '').toLowerCase();
    const stage = (tokenStage || '').toLowerCase();
    const mode = (integrationMode || '').toLowerCase();

    // CASE 1 → VALID
    if (
      status === 'completed' &&
      stage === 'completed' &&
      mode === 'integration mode'
    ) {
      return {
        passed: true,
        reason: 'Valid: completed via integration mode'
      };
    }


    // CASE 2 → VALID
    if (
      (status != 'completed')  &&
      stage !== 'completed' &&
      mode === 'event mode'
    ) {
      return {
        passed: true,
        reason: 'Valid: event mode in progress'
      };
    }

    // EVERYTHING ELSE → INVALID
    return {
      passed: false,
      reason: `product status is ${status || '-'}, current stage is ${stage || '-'}, mode is ${mode || 'N/A'}`
    };
  }

  /* ================= QUEUE DROPDOWN ================= */

  openQueueDropdown() {
    this.showQueueDropdown = true;
    this.queueSearchText = '';
    this.filteredQueues = [...this.queues];
  }

  filterQueues() {
    const text = this.queueSearchText.toLowerCase();
    this.filteredQueues = this.queues.filter(q =>
      q.queuename.toLowerCase().includes(text)
    );
  }


  selectQueue(queue: any) {
  this.selectedQueueId = queue.id;
  this.queueSearchText = queue.queuename;
  this.showQueueDropdown = false;
  this.onQueueChange();
}

  clearQueueIfSelected() {
    if (this.selectedQueueId) {
      this.selectedQueueId = '';
      this.queueSearchText = '';
      this.filteredQueues = [...this.queues];
      this.showQueueDropdown = true;
      this.resetReport();
    }
  }

  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // If click is inside queue selector → do nothing
    if (target.closest('.queue-select-container')) {
      return;
    }

    // Clicked outside
    this.showQueueDropdown = false;

    // If no queue selected, clear search text
    if (!this.selectedQueueId) {
      this.queueSearchText = '';
    }
  }


  calculateDashboardCounts() {
  this.dashboard.total = this.allRecords.length;

  this.dashboard.completed = this.allRecords.filter(
    r => r.productStatus?.toLowerCase() === 'completed'
  ).length;

  this.dashboard.initiated = this.allRecords.filter(
    r => r.productStatus?.toLowerCase() === 'initiated'
  ).length;

  this.dashboard.ongoing = this.allRecords.filter(
    r => r.productStatus?.toLowerCase() === 'ongoing'
  ).length;

  this.dashboard.cancelled = this.allRecords.filter(
    r => r.productStatus?.toLowerCase() === 'cancelled'
  ).length;

  this.dashboard.valid = this.allRecords.filter(
    r => r.validationPassed === true
  ).length;

  this.dashboard.failed = this.allRecords.filter(
    r => r.validationPassed === false
  ).length;
}


  /* ================= QUEUE CHANGE ================= */

  onQueueChange() {
    if (!this.selectedQueueId || this.selectedQueueId === this.lastQueueId) {
      this.resetReport();
      return;
    }

    this.lastQueueId = this.selectedQueueId;
    this.loadReport();
  }

  resetReport() {
    this.reportLoaded = false;
    this.allRecords = [];
    this.filteredRecords = [];
    this.paginatedRecords = [];
    this.validationFailures = [];
    this.activeKpiFilter = null;

    this.dashboard = {
      total: 0,
      completed: 0,
      initiated: 0,
      ongoing: 0,
      cancelled: 0,
      valid: 0,
      failed: 0
    };
  }

  /* ================= LOAD QUEUES ================= */

  async loadQueues() { const snap = await getDocs(collection(this.db, 'queue generation')); 
    this.queues = snap.docs .map(d => ({ 
      id: d.id, ...d.data() })) .sort((a: any, b: any) => { 
        if (!a.queueenddate) return 1; 
        if (!b.queueenddate) return -1; 
        return b.queueenddate.toMillis() - a.queueenddate.toMillis(); }); }

  /* ================= LOAD REPORT ================= */

  async loadReport() {
    this.loading = true;
    this.resetReport();

    try {
      const queueRef = doc(this.db, 'queue generation', this.selectedQueueId);
      const tokenSnap = await getDocs(
        query(
          collection(this.db, 'queue_token'),where('queueref', '==', queueRef),where('tokenstatus', '==', 'Active'), where('stagestatus', '==', 'Approved')
        )
      );
      const ppSnap = await getDocs(
        query(
          collection(this.db, 'participantsproduct'), where('eventref', '==', queueRef)
        )
      );

      for (const tokenDoc of tokenSnap.docs) {
        const token = tokenDoc.data();
        //console.log(token);
        const matchedPpDoc = ppSnap.docs.find(ppDoc => {
          const pp = ppDoc.data();
          //console.log(pp);
          return (
            token['profile_id'] === pp['profileid'] &&
            token['productref'] === pp['productref']
          );
        });

        if (!matchedPpDoc) {
          continue;
        }

        const pp = matchedPpDoc.data();
        //console.log(pp);

        const record: any = {
          participantName: token['profile_name'] ?? '-',
          productName: token['productname'] ?? '-',
          productStatus: pp['status'] ?? '-',
          integrationMode: pp['mode'] ?? '-',
          tokenStage: token['currentstage'] ?? '-'
        };

        const validation = this.validateRecord(
          record.productStatus,
          record.tokenStage,
          record.integrationMode
        );

        record.validationPassed = validation.passed;
        record.validationReason = validation.reason;

        if (!validation.passed) {
          this.validationFailures.push(record);
        }

        this.allRecords.push(record);
      }

      // ===== Final updates =====
      this.prepareDashboard();
      this.applyFilters();
      this.calculateDashboardCounts();
      this.reportLoaded = true;

    } catch (e) {
      console.error(e);
      this.error = 'Failed to load report';
    } finally {
      this.loading = false;
    }

  }

  /* ================= KPI CLICK ================= */

  onKpiClick(
    type: 'completed' | 'initiated' | 'ongoing' | 'cancelled' | 'valid' | 'invalid'
  ) {
    this.activeKpiFilter = this.activeKpiFilter === type ? null : type;
    this.applyFilters();
  }

  /* ================= FILTERS ================= */

  applyFilters() {
  this.filteredRecords = this.allRecords.filter(r => {

    /* ================= KPI FILTERS ================= */

    if (
      this.activeKpiFilter === 'completed' &&
      r.productStatus?.toLowerCase() !== 'completed'
    ) {
      return false;
    }

    if (
      this.activeKpiFilter === 'initiated' &&
      r.productStatus?.toLowerCase() !== 'initiated'
    ) {
      return false;
    }

    if (
      this.activeKpiFilter === 'ongoing' &&
      r.productStatus?.toLowerCase() !== 'ongoing'
    ) {
      return false;
    }

    if (
      this.activeKpiFilter === 'cancelled' &&
      r.productStatus?.toLowerCase() !== 'cancelled'
    ) {
      return false;
    }

    if (this.activeKpiFilter === 'valid' && !r.validationPassed) {
      return false;
    }

    if (this.activeKpiFilter === 'invalid' && r.validationPassed) {
      return false;
    }

    /* ================= SEARCH ================= */

    if (
      this.searchText &&
      !Object.values(r)
        .join(' ')
        .toLowerCase()
        .includes(this.searchText.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  this.currentPage = 1;
  this.calculatePagination();
}


  toggleFilter(type: 'status' | 'mode' | 'stage') {
    this.activeFilter = this.activeFilter === type ? null : type;
  }

  closeFilter() {
    this.activeFilter = null;
  }

  /* ================= PAGINATION ================= */

  calculatePagination() {
    this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
    this.updatePage();
  }

  updatePage() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedRecords = this.filteredRecords.slice(start, start + this.pageSize);
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePage();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePage();
    }
  }

  /* ================= KPI ================= */

  prepareDashboard() {
    this.dashboard.total = this.allRecords.length;
    this.dashboard.valid = this.allRecords.filter(r => r.validationPassed).length;
    this.dashboard.failed = this.allRecords.filter(r => !r.validationPassed).length;
  }

  /* ================= EXPORT ================= */

  exportCSV() {
    const rows = this.filteredRecords.map(r =>
      `${r.participantName},${r.productName},${r.productStatus},${r.integrationMode},${r.tokenStage},${r.validationPassed ? 'Valid' : 'Invalid'}`
    );

    const csv = [
      'Participant,Product,Status,Mode,Stage,Validation',
      ...rows
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'queue_report.csv';
    a.click();
  }

  /* ================= LOGOUT ================= */

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
