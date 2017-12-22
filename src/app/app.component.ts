import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DxDataGridComponent } from 'devextreme-angular';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import * as Pusher from 'pusher-js'

const SecretStorageKey = 'secret'
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

  registered: boolean
  activated: boolean
  readonly priceObservable = new BehaviorSubject<number>(void 0)
  readonly currency: string = 'EUR'
  thresholdsLoaded: boolean = false
  _secret: string
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
    this.secret = (location.href.match(/\/user\/([a-z0-9]+)$/) || [])[1] || localStorage.getItem(SecretStorageKey)
    this.loadThresholds()
    liveTradesChannel.bind('trade', trade => {
      this.priceObservable.next(trade.price)
      this.changeDetectorRef.detectChanges()
    })
  }

  async loadThresholds() {
    const baseUrl: string = this.baseUrl
    if(baseUrl) {
      try {
        const thresholds: ReadonlyArray<Threshold> = await this.httpClient.get(`${baseUrl}/thresholds`).toPromise<any>()
        this._thresholds = thresholds
        this.thresholdsLoaded = true
        this.activated = true
      } catch(e) {
        this.activated = false
      }
    } else {
      this.thresholdsLoaded = false
    }
  }

  get secret(): string {
    return this._secret
  }
  set secret(secret: string) {
    this._secret = secret
    if(secret) {
      localStorage.setItem(SecretStorageKey, secret)
    }
  }

  get emailAddress(): string {
    return this._emailAddress
  }
  get baseUrl(): string {
    const emailAddress = this.emailAddress
    const secret = this.secret
    if(emailAddress && secret) {
      return `/api/users/${emailAddress}/${secret}`
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

  async onRegisterButtonClicked() {
    const emailAddress: string = this.emailAddress
    if(emailAddress) {
      await this.httpClient.get(`/api/register/${emailAddress}`).toPromise()
      this.registered = true
    }
  }
  onAddThresholdButtonClicked() {
    this.thresholdGrid.instance.addRow()
  }
  onRowUpdated() {
    this.thresholds = this._thresholds // call the setter
  }

}
