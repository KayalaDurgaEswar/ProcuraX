import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  forkJoin,
  map,
  switchMap,
  tap,
  throwError
} from 'rxjs';
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

  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  clearError(): void {
    this.errorSubject.next(null);
  }

  private messageFromError(error: any, fallback: string): string {
    const apiMessage = error?.error?.error;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }

    if (error?.status === 0) {
      return 'ProcuraX backend is unavailable. Start the backend service and try again.';
    }

    if (
      error?.status === 200 &&
      typeof error?.error?.text === 'string' &&
      error.error.text.trim().startsWith('<')
    ) {
      return 'Backend API is not connected to this frontend session.';
    }

    if (typeof error?.message === 'string' && !error.message.includes('Http failure during parsing')) {
      return error.message;
    }

    return fallback;
  }

  private refreshWorkspace(id: string): Observable<void> {
    return forkJoin({
      requests: this.http.get<ProcurementRequest[]>(`${this.apiUrl}/procurements`),
      detail: this.http.get<ProcurementDetail>(`${this.apiUrl}/procurements/${id}`)
    }).pipe(
      tap(({ requests, detail }) => {
        this.requestsSubject.next(requests);
        this.activeDetailSubject.next(detail);
      }),
      map(() => undefined)
    );
  }

  loadProcurements(): Observable<ProcurementRequest[]> {
    this.errorSubject.next(null);
    return this.http.get<ProcurementRequest[]>(`${this.apiUrl}/procurements`).pipe(
      tap(requests => this.requestsSubject.next(requests)),
      catchError(error => {
        this.errorSubject.next(this.messageFromError(error, 'Unable to load procurement history.'));
        return throwError(() => error);
      })
    );
  }

  createProcurement(prompt: string): Observable<ProcurementRequest> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<ProcurementRequest>(`${this.apiUrl}/procurements`, { prompt })
      .pipe(
        switchMap(newRequest =>
          this.refreshWorkspace(newRequest.id).pipe(map(() => newRequest))
        ),
        catchError(error => {
          this.errorSubject.next(
            this.messageFromError(error, 'Unable to launch the procurement workflow.')
          );
          return throwError(() => error);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  loadProcurementDetail(id: string): Observable<ProcurementDetail> {
    this.errorSubject.next(null);
    return this.http.get<ProcurementDetail>(`${this.apiUrl}/procurements/${id}`).pipe(
      tap(detail => this.activeDetailSubject.next(detail)),
      catchError(error => {
        this.errorSubject.next(
          this.messageFromError(error, 'Unable to load procurement details.')
        );
        return throwError(() => error);
      })
    );
  }

  approveProcurement(
    id: string,
    approverId: string = 'user_procurement_lead',
    comments: string = 'Approved via Angular Enterprise Dashboard'
  ): Observable<any> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post(`${this.apiUrl}/procurements/${id}/approve`, {
        approverId,
        comments
      })
      .pipe(
        switchMap(result => this.refreshWorkspace(id).pipe(map(() => result))),
        catchError(error => {
          this.errorSubject.next(
            this.messageFromError(error, 'Unable to approve this procurement.')
          );
          return throwError(() => error);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  rejectProcurement(
    id: string,
    actorId: string = 'user_procurement_lead',
    reason: string = 'Rejected by authorized approver'
  ): Observable<any> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post(`${this.apiUrl}/procurements/${id}/reject`, {
        actorId,
        reason
      })
      .pipe(
        switchMap(result => this.refreshWorkspace(id).pipe(map(() => result))),
        catchError(error => {
          this.errorSubject.next(
            this.messageFromError(error, 'Unable to reject this procurement.')
          );
          return throwError(() => error);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }
}
