import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private BASE_URL = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getQueues() {
    return this.http.get(`${this.BASE_URL}/queues`);
  }

  getQueueReport(queueId: string) {
    return this.http.get(`${this.BASE_URL}/report/${queueId}`);
  }
}
