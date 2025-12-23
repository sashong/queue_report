import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc
} from 'firebase/firestore';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule,RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  showDashboard = false;

  /* ================= FIREBASE ================= */
  firebaseConfig = {
    apiKey: 'AIzaSyAeaYHkue2pxh6kDyTL8w6CSaF9LNbMZHc',
    authDomain: 'starlabs-test.firebaseapp.com',
    projectId: 'starlabs-test'
  };

  app = initializeApp(this.firebaseConfig);
  db = getFirestore(this.app);

  queues: any[] = [];
  selectedQueueId = '';
  loading = false;
  error = '';
  private lastQueueId = '';
  reportLoaded = false;


  allRecords: any[] = [];
  filteredRecords: any[] = [];
  paginatedRecords: any[] = [];
  validationFailures: any[] = [];

  /* ================= FILTERS ================= */
  selectedProductStatus = '';
  selectedIntegrationMode = '';
  selectedStage = '';
  searchText = '';

  productStatusOptions: { value: string; count: number }[] = [];
  integrationModeOptions: { value: string; count: number }[] = [];
  stageOptions: { value: string; count: number }[] = [];

  activeFilter: 'status' | 'mode' | 'stage' | null = null;

  activeKpiFilter:
  | 'total'
  | 'completed'
  | 'initiated'
  | 'ongoing'
  | 'cancelled'
  | 'failed'
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
    initiated:0,
    cancelled:0,
    ongoing: 0,
    valid:0,
    failed: 0
  };

  productStatusKpis: { key: string; count: number }[] = [];

validCount = 0;
invalidCount = 0;

  constructor(
  private authService: AuthService,
  private router: Router
) {
  if (!this.authService.isLoggedIn()) {
    this.showDashboard = false;
    this.router.navigate(['/login']);
    return;
  }

  this.showDashboard = true;
  this.loadQueues();
}


  /* ================= LOGOUT ================= */
  logout() {
    this.showDashboard = false;
    this.authService.logout();
  }

  onKpiClick(type: 'completed' | 'ongoing' |'initiated'|'cancelled'| 'failed' | 'valid' | 'invalid') {
  this.activeKpiFilter = this.activeKpiFilter === type ? null : type;
  this.applyFilters();
}


  onQueueChange() {
   if (!this.selectedQueueId || this.selectedQueueId === this.lastQueueId) {
    this.reportLoaded = false;

    this.allRecords = [];
    this.filteredRecords = [];
    this.paginatedRecords = [];
    this.validationFailures = [];
    this.activeKpiFilter = null;


    this.dashboard = {
      total: 0,
      completed: 0,
      initiated:0,
      cancelled:0,
      ongoing: 0,
      valid:0,
      failed: 0
    };

    return;
  }
  this.lastQueueId = this.selectedQueueId;
  this.reportLoaded = false;
  this.loadReport();
}



  /* ================= LOAD QUEUES ================= */
  async loadQueues() {
    const snap = await getDocs(collection(this.db, 'queue generation'));

    this.queues = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => {
        if (!a.queueenddate) return 1;
        if (!b.queueenddate) return -1;
        return b.queueenddate.toMillis() - a.queueenddate.toMillis();
      });
  }

  /* ================= LOAD REPORT ================= */
  async loadReport() {
    if (!this.selectedQueueId) return;

    this.loading = true;
    this.error = '';

    this.allRecords = [];
    this.validationFailures = [];

    try {
      const queueRef = doc(this.db, 'queue generation', this.selectedQueueId);

      const tokenSnap = await getDocs(
        query(
          collection(this.db, 'queue_token'),
          where('queueref', '==', queueRef)
        )
      );

      for (const tokenDoc of tokenSnap.docs) {
        const token = tokenDoc.data();

        const ppSnap = await getDocs(
          query(
            collection(this.db, 'participantsproduct'),
            where('eventref', '==', queueRef),
            where('profileid', '==', token['profile_id']),
            where('productref', '==', token['productref'])
          )
        );

        let productStatus = '-';
        let integrationMode = '-';

        if (!ppSnap.empty) {
          const pp = ppSnap.docs[0].data();
          productStatus = pp['status'] ?? '-';
          integrationMode = pp['integrationMode'] ?? pp['mode'] ?? '-';
        }

        const record: any = {
          tokenId: tokenDoc.id,
          participantName: token['profile_name'] ?? '-',
          productName: token['productname'] ?? '-',
          productStatus,
          integrationMode,
          tokenStage: token['currentstage'] ?? '-',
          validationPassed: true,
          validationReason: null
        };

        const failures: string[] = [];

        if (record.tokenStage === 'Completed' && record.productStatus !== 'completed') {
          failures.push('Stage is completed but product status is not completed');
        }

        if (!record.productStatus || record.productStatus === '-') {
          failures.push('Product status is missing');
        }

        if (!record.integrationMode || record.integrationMode === '-') {
          failures.push('Integration mode is missing');
        }

        if (failures.length > 0) {
          record.validationPassed = false;
          record.validationReason = failures.join(' | ');
          this.validationFailures.push(record);
        }

        this.allRecords.push(record);
      }

      this.prepareFilters();
      this.applyFilters();
      this.prepareDashboard();
      this.reportLoaded = true;

    } catch (e) {
      console.error(e);
      this.error = 'Failed to load report';
    } finally {
      this.loading = false;
    }
  }

  /* ================= FILTERS ================= */
  prepareFilters() {
    const build = (key: string) => {
      const map: any = {};
      this.allRecords.forEach(r => {
        const v = r[key] ?? '-';
        map[v] = (map[v] || 0) + 1;
      });
      return Object.keys(map).map(k => ({ value: k, count: map[k] }));
    };

    this.productStatusOptions = build('productStatus');
    this.integrationModeOptions = build('integrationMode');
    this.stageOptions = build('tokenStage');
  }

  applyFilters() {
  this.filteredRecords = this.allRecords.filter(r => {

    /* ================= KPI FILTERS ================= */

    if (this.activeKpiFilter === 'completed' && r.productStatus !== 'completed') {
      return false;
    }

    if (this.activeKpiFilter === 'initiated' && r.productStatus !== 'initiated') {
      return false;
    }

    if (this.activeKpiFilter === 'ongoing' && r.productStatus !== 'ongoing') {
      return false;
    }

    if (this.activeKpiFilter === 'cancelled' && r.productStatus !== 'cancelled') {
      return false;
    }

    if (this.activeKpiFilter === 'failed' && r.validationPassed !== false) {
      return false;
    }

    if (this.activeKpiFilter === 'valid' && r.validationPassed !== true) {
      return false;
    }

    if (this.activeKpiFilter === 'invalid' && r.validationPassed !== false) {
      return false;
    }

    /* ================= EXISTING FILTERS ================= */

    if (this.selectedProductStatus && r.productStatus !== this.selectedProductStatus) {
      return false;
    }

    if (this.selectedIntegrationMode && r.integrationMode !== this.selectedIntegrationMode) {
      return false;
    }

    if (this.selectedStage && r.tokenStage !== this.selectedStage) {
      return false;
    }

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


  resetFilter(type: 'status' | 'mode' | 'stage') {
    if (type === 'status') this.selectedProductStatus = '';
    if (type === 'mode') this.selectedIntegrationMode = '';
    if (type === 'stage') this.selectedStage = '';
    this.applyFilters();
  }

  calculatePagination() {
    this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
    this.updatePage();
  }

  updatePage() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedRecords = this.filteredRecords.slice(start, start + this.pageSize);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePage();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePage();
    }
  }

  prepareDashboard() {
    this.dashboard.total = this.allRecords.length;
    this.dashboard.completed = this.allRecords.filter(r => r.productStatus === 'completed').length;
    this.dashboard.ongoing = this.allRecords.filter(r => r.productStatus === 'ongoing').length;
    this.dashboard.initiated = this.allRecords.filter(r => r.productStatus === 'initiated').length;
    this.dashboard.cancelled = this.allRecords.filter(r=>r.productStatus === 'cancelled').length;
    this.dashboard.valid = this.validCount;
    this.dashboard.failed = this.validationFailures.length;
  }

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

  toggleFilter(type: 'status' | 'mode' | 'stage') {
    this.activeFilter = this.activeFilter === type ? null : type;
  }

  closeFilter() {
    this.activeFilter = null;
  }
}
