import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  doc
} from '@angular/fire/firestore';

@Component({
  selector: 'app-all-tokens',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './all-tokens.component.html',
  styleUrls: ['./all-tokens.component.css']
})
export class AllTokensComponent implements OnInit {

  queues: any[] = [];
  selectedQueueId = '';
  records: any[] = [];
  loading = false;
  error = '';

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadQueues();
  }

  /* ================= LOAD QUEUES ================= */

  async loadQueues() {
    try {
      const snap = await getDocs(
        collection(this.firestore, 'queue generation')
      );

      this.queues = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
    } catch (e) {
      console.error(e);
      this.error = 'Failed to load queues';
    }
  }

  /* ================= QUEUE CHANGE ================= */

  async onQueueChange() {
    if (!this.selectedQueueId) return;

    this.loading = true;
    this.records = [];
    this.error = '';

    try {
      const queueRef = doc(
        this.firestore,
        'queue generation',
        this.selectedQueueId
      );

      /* -------- FETCH TOKENS -------- */
      const tokenSnap = await getDocs(
        query(
          collection(this.firestore, 'queue_token'),
          where('queueref', '==', queueRef)
        )
      );

      /* -------- FETCH PARTICIPANTS PRODUCT -------- */
      const ppSnap = await getDocs(
        query(
          collection(this.firestore, 'participantsproduct'),
          where('eventref', '==', queueRef)
        )
      );

      // Map participantsproduct by document ID
      const ppMap = new Map<string, any>();
      ppSnap.docs.forEach(d => {
        ppMap.set(d.id, d.data());
      });

      /* -------- BUILD RECORDS -------- */
      for (const tokenDoc of tokenSnap.docs) {
        const token = tokenDoc.data();
        const ppId = token['participantproductid'];

        if (!ppId) continue;

        const pp = ppMap.get(ppId);
        if (!pp) continue;

        this.records.push({
          profileName: token['profile_name'] ?? '-',
          productName: token['productname'] ?? '-',
          tokenStatus: token['tokenstatus'] ?? '-',
          stageStatus: token['stagestatus'] ?? '-',
          currentStage: token['currentstage'] ?? '-',
          mode: pp['mode'] ?? '-',
          productStatus: pp['status'] ?? '-'
        });
      }

    } catch (e) {
      console.error(e);
      this.error = 'Failed to load token data';
    } finally {
      this.loading = false;
    }
  }
  logout() {
  this.authService.logout();
  this.router.navigate(['/login']);
}

}
