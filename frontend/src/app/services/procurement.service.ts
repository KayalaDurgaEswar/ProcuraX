import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ProcurementRequest, ProcurementDetail } from '../models/procurement.model';

@Injectable({
  providedIn: 'root'
})
export class ProcurementService {
  private apiUrl = '/api';

  private requestsSubject = new BehaviorSubject<ProcurementRequest[]>([]);
  public requests$ = this.requestsSubject.asObservable();

  private activeDetailSubject = new BehaviorSubject<ProcurementDetail | null>(null);
  public activeDetail$ = this.activeDetailSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Fetches list of all procurement requests
   */
  loadProcurements(): Observable<ProcurementRequest[]> {
    return this.http.get<ProcurementRequest[]>(`${this.apiUrl}/procurements`).pipe(
      tap(requests => this.requestsSubject.next(requests))
    );
  }

  /**
   * Creates new procurement request from natural language prompt
   */
  createProcurement(prompt: string): Observable<ProcurementRequest> {
    this.loadingSubject.next(true);
    return this.http.post<ProcurementRequest>(`${this.apiUrl}/procurements`, { prompt }).pipe(
      tap((newReq) => {
        this.loadProcurements().subscribe();
        this.loadProcurementDetail(newReq.id).subscribe();
        this.loadingSubject.next(false);
      })
    );
  }

  /**
   * Loads composite details for selected procurement ID
   */
  loadProcurementDetail(id: string): Observable<ProcurementDetail> {
    return this.http.get<ProcurementDetail>(`${this.apiUrl}/procurements/${id}`).pipe(
      tap(detail => this.activeDetailSubject.next(detail))
    );
  }

  /**
   * Grants human approval
   */
  approveProcurement(id: string, comments: string = 'Approved via Angular Enterprise Dashboard'): Observable<any> {
    return this.http.post(`${this.apiUrl}/procurements/${id}/approve`, {
      approverId: 'user_procurement_lead',
      comments
    }).pipe(
      tap(() => {
        this.loadProcurementDetail(id).subscribe();
        this.loadProcurements().subscribe();
      })
    );
  }

  /**
   * Rejects procurement request
   */
  rejectProcurement(id: string, reason: string = 'Rejected by Manager'): Observable<any> {
    return this.http.post(`${this.apiUrl}/procurements/${id}/reject`, {
      actorId: 'user_procurement_lead',
      reason
    }).pipe(
      tap(() => {
        this.loadProcurementDetail(id).subscribe();
        this.loadProcurements().subscribe();
      })
    );
  }
}
