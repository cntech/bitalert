import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DxDataGridComponent } from 'devextreme-angular';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import * as Pusher from 'pusher-js'

const EmailAddressStorageKey = 'emailAddress'
const bitstamprAppKey = 'de504dc5763aeef9ff52'
const pusher = new Pusher(bitstamprAppKey)
const liveTradesChannel: Pusher.Channel = pusher.subscribe('live_trades_btceur')

interface Threshold {
  readonly orientation: 'up' | 'down';
  readonly price: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  @ViewChild(DxDataGridComponent) thresholdGrid: DxDataGridComponent

  readonly priceObservable = new BehaviorSubject<number>(void 0)
  readonly currency: string = 'EUR'
  thresholdsLoaded: boolean = false
  _emailAddress: string = localStorage.getItem(EmailAddressStorageKey)
  _thresholds: ReadonlyArray<Threshold> = []
  readonly upDownOptions: ReadonlyArray<{ readonly value: 'up'|'down', readonly text: string }> = [
    {
      value: 'up',
      text: 'Up Threshold'
    },
    {
      value: 'down',
      text: 'Down Threshold'
    }
  ]
  readonly pricePattern = /^[0-9]+$/

  constructor(readonly httpClient: HttpClient, readonly changeDetectorRef: ChangeDetectorRef) {
    this.loadThresholds()
    liveTradesChannel.bind('trade', trade => {
      this.priceObservable.next(trade.price)
      this.changeDetectorRef.detectChanges()
    })
  }

  async loadThresholds() {
    const baseUrl: string = this.baseUrl
    if(baseUrl) {
      const thresholds: ReadonlyArray<Threshold> = await this.httpClient.get(`${baseUrl}/thresholds`).toPromise<any>()
      this._thresholds = thresholds
      this.thresholdsLoaded = true
    } else {
      this.thresholdsLoaded = false
    }
  }

  get emailAddress(): string {
    return this._emailAddress
  }
  get baseUrl(): string {
    const emailAddress = this.emailAddress
    if(emailAddress) {
      return `/users/${emailAddress}`
    }
  }
  set emailAddress(emailAddress: string) {
    this._emailAddress = emailAddress
    localStorage.setItem(EmailAddressStorageKey, emailAddress)
    this.loadThresholds()
  }
  get thresholds(): ReadonlyArray<Threshold> {
    return this._thresholds
  }
  set thresholds(thresholds: ReadonlyArray<Threshold>) {
    const baseUrl: string = this.baseUrl
    if(baseUrl) {
      this.httpClient.post(`${baseUrl}/thresholds`, this.thresholds).toPromise()
    }
    this._thresholds = thresholds
  }

  onAddThresholdButtonClicked() {
    this.thresholdGrid.instance.addRow()
  }
  onRowUpdated() {
    this.thresholds = this._thresholds // call the setter
  }

}
