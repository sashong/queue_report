import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  // ✅ Get all queues
  getQueues(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/queues`);
  }

  // ✅ Get report for selected queue
  getQueueReport(queueId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/queue-report/${queueId}`);
  }
}
