import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc} from 'firebase/firestore';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title(title: any) {
    throw new Error('Method not implemented.');
  }

  /* ================= FIREBASE ================= */
  firebaseConfig = {
    // api key
  };

  app = initializeApp(this.firebaseConfig);
  db = getFirestore(this.app);

  /* ================= STATE ================= */
  queues: any[] = [];
  selectedQueueId = '';
  loading = false;
  error = '';

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

  /* ================= PAGINATION ================= */
  pageSize = 10;
  currentPage = 1;
  totalPages = 1;

  /* ================= KPI ================= */
  dashboard = {
    total: 0,
    completed: 0,
    ongoing: 0,
    failed: 0
  };

  constructor() {
    this.loadQueues();
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

        /* ---------- FETCH PARTICIPANT PRODUCT ---------- */
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

        const record = {
          tokenId: tokenDoc.id,
          participantName: token['profile_name'] ?? '-',
          productName: token['productname'] ?? '-',
          productStatus,
          integrationMode,
          tokenStage: token['currentstage'] ?? '-',
          validationPassed: true,
          validationReason: null as string | null
        };

        const failures: string[] = [];

/* ---------- CHECK 1: CURRENT STAGE ---------- */
if (record.tokenStage === 'Completed' && record.productStatus !== 'completed') {
  failures.push(
    'Stage is completed but product status is not completed'
  );
}

/* ---------- CHECK 2: PRODUCT STATUS ---------- */
if (!record.productStatus || record.productStatus === '-') {
  failures.push('Product status is missing');
}

/* ---------- CHECK 3: INTEGRATION MODE ---------- */
if (!record.integrationMode || record.integrationMode === '-') {
  failures.push('Integration mode is missing');
}

/* ---------- FINAL DECISION ---------- */
if (failures.length > 0) {
  record.validationPassed = false;
  record.validationReason = failures.join(' | ');
  this.validationFailures.push(record);
} else {
  record.validationPassed = true;
  record.validationReason = null;
}


        this.allRecords.push(record);
      }

      this.prepareFilters();
      this.applyFilters();
      this.prepareDashboard();

    } catch (e) {
      console.error(e);
      this.error = 'Failed to load report';
    } finally {
      this.loading = false;
    }
  }

  /* ================= FILTER OPTIONS ================= */
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

  /* ================= APPLY FILTERS ================= */
  applyFilters() {
    this.filteredRecords = this.allRecords.filter(r =>
      (!this.selectedProductStatus || r.productStatus === this.selectedProductStatus) &&
      (!this.selectedIntegrationMode || r.integrationMode === this.selectedIntegrationMode) &&
      (!this.selectedStage || r.tokenStage === this.selectedStage) &&
      (!this.searchText ||
        Object.values(r)
          .join(' ')
          .toLowerCase()
          .includes(this.searchText.toLowerCase()))
    );

    this.currentPage = 1;
    this.calculatePagination();
  }

  resetFilter(type: 'status' | 'mode' | 'stage') {
    if (type === 'status') this.selectedProductStatus = '';
    if (type === 'mode') this.selectedIntegrationMode = '';
    if (type === 'stage') this.selectedStage = '';
    this.applyFilters();
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

  /* ================= KPI ================= */
  prepareDashboard() {
    this.dashboard.total = this.allRecords.length;
    this.dashboard.completed = this.allRecords.filter(r => r.productStatus === 'completed').length;
    this.dashboard.ongoing = this.allRecords.filter(r => r.productStatus === 'ongoing').length;
    this.dashboard.failed = this.validationFailures.length;
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

  /* ================= FILTER UI ================= */
  toggleFilter(type: 'status' | 'mode' | 'stage') {
    this.activeFilter = this.activeFilter === type ? null : type;
  }

  closeFilter() {
    this.activeFilter = null;
  }
}

