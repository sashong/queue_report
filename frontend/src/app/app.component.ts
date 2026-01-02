import { Component , HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';

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
  showModeFilter = false;
  showStageFilter = false;
  selectedProduct = '';
  productOptions: any[] = [];
  invalidByReasonCount = 0;
  invalidByProductCount = 0;
  invalidByEventStatusCount = 0;
  modeSearchText = '';
  stageSearchText = '';


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
  tokenUnsub: any;
  ppUnsub: any;
  allTokensRecords: any[] = [];
  liveEventParticipationDocs: any[] = [];
  epUnsub: any;

  liveTokens: any[] = [];
  livePpDocs: any[] = [];


  /* ================= FILTERS ================= */

  selectedProductStatus = '';
  selectedIntegrationMode = '';
  filteredIntegrationModeOptions: string[] = [];
  filteredStageOptions: string[] = [];
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
    | 'active'
    | 'inactive'
    | 'shifted'
    | 'invalid_reason'
    | 'invalid_product'
    | 'invalid_event_status'

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
    failed: 0,
    active: 0,
    inactive: 0,
    shifted:0
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
    integrationMode: string,
    eventParticipationStatus: string
  ): { passed: boolean; reason: string } {

    const status = (productStatus || '').toLowerCase();
    const stage = (tokenStage || '').toLowerCase();
    const mode = (integrationMode || '').toLowerCase();

    // HARD FAIL → INVALID if event participation status not found
    if (
      !eventParticipationStatus ||
      eventParticipationStatus === 'Not Found'
    ) {
      return {
        passed: false,
        reason: 'Invalid: event participation status not found'
      };
    }


    // CASE 1 → VALID
    if (
      status === 'completed' &&
      stage === 'completed' &&
      ['integration mode', 'extended mode', 'performance mode', 'after performance mode'].includes(mode)
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
  console.log('Clicked queue:', queue.queuename, queue.docid);
  this.selectedQueueId = queue.docid;
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

  this.dashboard.active = this.allRecords.filter(
    r => String(r.tokenStatus).trim().toLowerCase() === 'active'
  ).length;

  this.dashboard.inactive = this.allRecords.filter(
    r => String(r.tokenStatus).trim().toLowerCase() === 'inactive'
  ).length;

  this.dashboard.shifted = this.allRecords.filter(
    r => String(r.tokenStatus).trim().toLowerCase() === 'shifted'
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
    return;
  }

  const queueId = this.selectedQueueId; // 🔒 freeze
  this.lastQueueId = queueId;

  //console.log('Queue selected:', queueId);

  this.loadReport(queueId);
}

trackByQueueId(index: number, queue: any) {
  return queue.id;
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
      failed: 0,
      active: 0,
      inactive:0,
      shifted:0
    };
  }

  async handleEventParticipationForSelectedToken(selectedToken: any) {
    try {
      if (selectedToken.validationPassed === true) {
        return;
      }

      const ppid = selectedToken.participantproductid;
      if (!ppid) {
        console.warn('PPID missing, cannot proceed');
        return;
      }

      const selectedQueueRef = doc(
        this.db,
        'queue generation',
        this.selectedQueueId
      );

      const productRef = selectedToken.productref;

      if (!productRef) {
        console.warn('eventref or productref missing in token');
        return;
      }

      //Resolve arenaeventid using eventref + productref

      const arenaQuery = query(
        collection(this.db, 'arena events'),
        where('productref', '==', productRef),
        where('eventref', '==', selectedQueueRef),
        where("delete", "==", false)
      );


      const arenaSnap = await getDocs(arenaQuery);

      if (arenaSnap.empty) {
        console.warn('No arena event found for given eventref and productref');
        return;
      }

      // Assuming one arena per event + product
      const arenaDoc = arenaSnap.docs[0];
      const arenaeventid = arenaDoc.data()['docid'];

      /* ---------------------------------------
        Check existing event participation request
      ---------------------------------------- */

      const epQuery = query(
        collection(this.db, 'event participation request'),
        where('participantproductid', '==', ppid),
        where('arenaeventid', '==', arenaeventid)
      );

      const epSnap = await getDocs(epQuery);

      if (!epSnap.empty) {
        // Update timestamp
        await updateDoc(epSnap.docs[0].ref, {
          updateddate: serverTimestamp()
        });
        return;
      }

      //Decide status

      const productStatus = String(selectedToken.productStatus).toLowerCase();
      const participationStatus =
        ['ongoing', 'completed', 'shifted'].includes(productStatus)
          ? 'approved'
          : 'denied';

      //Create event participation request
      // Generate docID 
      const epRef = doc(
        collection(this.db, 'event participation request')
      );

      // SINGLE atomic write
      await setDoc(epRef, {
        docid: epRef.id,                     
        doccreateddate: serverTimestamp(),
        eventref: selectedQueueRef,
        productref: productRef,
        status: participationStatus,
        profileid: selectedToken.profileid,
        participantproductid: ppid,
        arenaeventid: arenaeventid,
        initiatedfrom: 'health'
      });


      // eventparticipationid into participantsproduct 
      const ppQuery = query(
        collection(this.db, 'participantsproduct'),
        where('docid', '==', ppid)
      );

      const ppSnap = await getDocs(ppQuery);

      if (!ppSnap.empty) {
        await updateDoc(ppSnap.docs[0].ref, {
          eventparticipationid: epRef.id,
          eventref: selectedQueueRef,  
          arenaeventid: arenaeventid
        });
      } else {
        console.warn('Participantsproduct document not found for ppid:', ppid);
      }



      // OPTIMISTIC UPDATE (this is the key)
      this.liveEventParticipationDocs.push({
        id: epRef.id,
        docid: epRef.id,
        status: participationStatus,
        participantproductid: ppid,
        arenaeventid: arenaeventid
      });

    } catch (error) {
      console.error('Failed to handle event participation request', error);
    }
  }

  async fixInvalidToken(record: any) {
    record.fixing = true;
    try {
      await this.handleEventParticipationForSelectedToken(record);
      this.buildLiveReport();
    } finally {
      record.fixing = false;
    }
  }

  async fixAllInvalidEventStatus() {
    // Only fix records with missing event participation
    const recordsToFix = this.filteredRecords.filter(
      r =>
        !r.validationPassed &&
        r.eventParticipationStatus === 'Not Found' &&
        !r.fixing
    );

    if (recordsToFix.length === 0) {
      return;
    }

    for (const record of recordsToFix) {
      record.fixing = true;

      try {
        await this.handleEventParticipationForSelectedToken(record);
      } catch (e) {
        console.error('Fix failed for token', record.TokenID, e);
      } finally {
        record.fixing = false;
      }
    }

    // Rebuild once after all fixes
    this.buildLiveReport();
  }


  calculateInvalidKpiCounts() {
  const reasons = new Set<string>();
  const products = new Set<string>();
  const eventStatuses = new Set<string>();

  for (const r of this.validationFailures) {
    if (r.validationReason) {
      reasons.add(r.validationReason);
    }

    if (r.productName) {
      products.add(r.productName);
    }

    if (r.eventParticipationStatus) {
      eventStatuses.add(r.eventParticipationStatus);
    }
  }

  this.invalidByReasonCount = this.validationFailures.filter(
    r => r.invalidGroup === 'FLOW_MISSING'
  ).length;

  this.invalidByProductCount = this.validationFailures.filter(
    r => r.invalidGroup === 'NO_PPID'
  ).length;

  this.invalidByEventStatusCount = this.validationFailures.filter(
    r => r.invalidGroup === 'NO_EVENT_PARTICIPATION'
  ).length;

}



  /* ================= LOAD QUEUES ================= */

  async loadQueues() { const snap = await getDocs(collection(this.db, 'queue generation')); 
    this.queues = snap.docs .map(d => ({ 
      id: d.id, ...d.data() })) .sort((a: any, b: any) => { 
        if (!a.queueenddate) return 1; 
        if (!b.queueenddate) return -1; 
        return b.queueenddate.toMillis() - a.queueenddate.toMillis(); }); }

  /* ================= LOAD REPORT ================= */

    loadReport(queueId: string) {
      this.loading = true;
      this.resetReport();

      // Stop previous listeners
      if (this.tokenUnsub) this.tokenUnsub();
      if (this.ppUnsub) this.ppUnsub();

      try {
        const queueRef = doc(this.db, 'queue generation', queueId);

        //  LIVE TOKEN LISTENER
        this.tokenUnsub = onSnapshot(
          query(
            collection(this.db, 'queue_token'),
            where('queueref', '==', queueRef),
            where('tokenstatus', '==', 'Active'), where('stagestatus', '==', 'Approved')
          ),
          (tokenSnap) => {
            this.liveTokens = tokenSnap.docs.map(d => d.data());
            this.buildLiveReport();
          }
        );

        //  LIVE PARTICIPANT PRODUCT LISTENER
        this.ppUnsub = onSnapshot(
          query(
            collection(this.db, 'participantsproduct'),
            where('eventref', '==', queueRef)
          ),
          (ppSnap) => {
            this.livePpDocs = ppSnap.docs.map(d => ({
              id: d.id,
              ...d.data()
            }));
            this.buildLiveReport();
          }
        );

        if (this.epUnsub) this.epUnsub();

        this.epUnsub = onSnapshot(
          collection(this.db, 'event participation request'),
          (epSnap) => {
            this.liveEventParticipationDocs = epSnap.docs.map(d => ({
              id: d.id,       
              ...d.data()      
            }));
            this.buildLiveReport();
          }
        );


      } catch (e) {
        console.error(e);
        this.error = 'Failed to load report';
        this.loading = false;
      }
    }

    

   buildLiveReport() {
  this.allRecords = [];
  this.validationFailures = [];
  this.allTokensRecords = [];

  for (const token of this.liveTokens) {

  const ppId = token['participantproductid'];
  const pp = ppId
    ? this.livePpDocs.find(p => p.id === ppId)
    : null;

    const eventParticipationId = pp?.eventparticipationid;

    const eventParticipation = eventParticipationId
      ? this.liveEventParticipationDocs.find(
          e => e.docid === eventParticipationId   
        )
      : null;

    const eventParticipationStatus =
      eventParticipation?.status ?? 'Not Found';


  const modeValue =
    typeof pp?.mode === 'string' && pp.mode.trim() !== ''
      ? pp.mode
      : 'null';

  // ---------------- CREATE RECORD (MISSING PIECE) ----------------
  const record = {
    participantName: token['profile_name'] ?? '-',
    participantproductid: token['participantproductid'], 
    eventref: token['eventref'],                           
    productref: token['productref'],                       
    profileid: token['profile_id'],                        
    productName: token['participantproductid']
    ? (token['productname'] ?? '-')
    : 'No Participant Product ID found',
    TokenID: token['tokennumber'] ?? '-',
    productStatus: pp?.status ?? '-',
    integrationMode: modeValue,
    stageStatus: token['stagestatus'] ?? '-',
    tokenStage: token['currentstage'] ?? '-',
    tokenStatus: token['tokenstatus'] ?? '-',
    eventParticipationStatus,
    validationPassed: false,
    validationReason: '',
    invalidGroup: null as 'FLOW_MISSING' | 'NO_PPID' | 'NO_EVENT_PARTICIPATION' | null
  };

  // ---------------- RUN VALIDATION ----------------
  const validation = this.validateRecord(
    record.productStatus,
    record.tokenStage,
    record.integrationMode,
    record.eventParticipationStatus
  );

  record.validationPassed = validation.passed;

  let invalidGroup:
  | 'FLOW_MISSING'
  | 'NO_PPID'
  | 'NO_EVENT_PARTICIPATION'
  | null = null;

if (!validation.passed) {

  // 2️⃣ No PPID found
  if (!record.participantproductid) {
    invalidGroup = 'NO_PPID';
  }

  // 3️⃣ No event participation status found
  else if (record.eventParticipationStatus === 'Not Found') {
    invalidGroup = 'NO_EVENT_PARTICIPATION';
  }

  // 1️⃣ Validation flow missing (fallback invalid)
  else {
    invalidGroup = 'FLOW_MISSING';
  }
}

record.invalidGroup = invalidGroup;


  if (!validation.passed) {
    this.validationFailures.push(record);
  }

  this.allRecords.push(record);

  // ---------------- ALL TOKENS TABLE (SEPARATE) ----------------
  this.allTokensRecords.push({
    participantName: record.participantName,
    TokenID: token['tokennumber'] ?? '-',
    productName: record.productName,
    tokenStatus: record.tokenStatus,
    eventParticipationStatus: record.eventParticipationStatus,
    currentStage: record.tokenStage,
    mode: record.integrationMode,
    productStatus: record.productStatus,
  });
}


  //  SAFE option building
  this.integrationModeOptions = Array.from(
    new Map(
      this.allRecords.map(r => [
        r.integrationMode,
        {
          value: r.integrationMode,
          count: this.allRecords.filter(
            x => x.integrationMode === r.integrationMode
          ).length
        }
      ])
    ).values()
  );

  this.productOptions = Array.from(
  new Map(
    this.allRecords.map(r => [
      r.productName,
      {
        value: r.productName,
        count: this.allRecords.filter(
          x => x.productName === r.productName
        ).length
      }
    ])
  ).values()
);


  this.stageOptions = Array.from(
    new Map(
      this.allRecords.map(r => [
        r.tokenStage,
        {
          value: r.tokenStage,
          count: this.allRecords.filter(
            x => x.tokenStage === r.tokenStage
          ).length
        }
      ])
    ).values()
  );

  // Build Mode options with count
    this.integrationModeOptions = Array.from(
      new Map(
        this.allRecords.map(r => [
          r.integrationMode,
          {
            value: r.integrationMode,
            count: this.allRecords.filter(
              x => x.integrationMode === r.integrationMode
            ).length
          }
        ])
      ).values()
    );

    // Build Stage options with count
    this.stageOptions = Array.from(
      new Map(
        this.allRecords.map(r => [
          r.tokenStage,
          {
            value: r.tokenStage,
            count: this.allRecords.filter(
              x => x.tokenStage === r.tokenStage
            ).length
          }
        ])
      ).values()
    );

  this.prepareDashboard();
  this.applyFilters();
  this.calculateDashboardCounts();
  this.reportLoaded = true;
  this.loading = false;
  this.calculateInvalidKpiCounts();
}

  /* ================= KPI CLICK ================= */

  onKpiClick(
    type: 'completed' | 'initiated' | 'active' | 'inactive' | 'shifted' | 'ongoing' | 'cancelled' | 'valid' | 'invalid' | 'invalid_reason' | 'invalid_product' | 'invalid_event_status'
  ) {
    this.activeKpiFilter = this.activeKpiFilter === type ? null : type;
    this.applyFilters();
  }

  /* ================= FILTERS ================= */

  applyFilters() {
  this.filteredRecords = this.allRecords.filter(r => {

    // Mode filter
    if (this.selectedIntegrationMode &&
        r.integrationMode !== this.selectedIntegrationMode) {
      return false;
    }

    // Product filter
    if (
      this.selectedProduct &&
      r.productName !== this.selectedProduct
    ) {
      return false;
    }


    // Stage filter
    if (this.selectedStage &&
        r.tokenStage !== this.selectedStage) {
      return false;
    }

    if (this.activeKpiFilter === 'invalid' && r.validationPassed) {
      return false;
    }


    // ---------- INVALID GROUP KPIs ----------
    if (this.activeKpiFilter === 'invalid_reason') {
      return r.invalidGroup === 'FLOW_MISSING';
    }

    if (this.activeKpiFilter === 'invalid_product') {
      return r.invalidGroup === 'NO_PPID';
    }

    if (this.activeKpiFilter === 'invalid_event_status') {
      return r.invalidGroup === 'NO_EVENT_PARTICIPATION';
    }


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

    if (
      this.activeKpiFilter === 'active' &&
      String(r.tokenStatus).trim().toLowerCase() !== 'active'
    ) {
      return false;
    } 

    if (
      this.activeKpiFilter === 'inactive' &&
      String(r.tokenStatus).trim().toLowerCase() !== 'inactive'
    ) {
      return false;
    }

    if (
      this.activeKpiFilter === 'shifted' &&
      String(r.tokenStatus).trim().toLowerCase() !== 'shifted'
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

  // GROUPING SORT (must be BEFORE pagination)
  if (
    this.activeKpiFilter === 'invalid_reason' ||
    this.activeKpiFilter === 'invalid_product' ||
    this.activeKpiFilter === 'invalid_event_status'
  ) {
    this.filteredRecords.sort((a, b) =>
      (a.validationReason || '').localeCompare(b.validationReason || '') ||
      (a.productName || '').localeCompare(b.productName || '') ||
      (a.eventParticipationStatus || '').localeCompare(b.eventParticipationStatus || '')
    );
  }

  // Pagination AFTER sorting
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
